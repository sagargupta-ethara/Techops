"""Live POD Operations Dashboard — FastAPI backend.

Reads a Google Sheets 'Master' tab (read-only, service account), preserves daily
history + append-only detected-change audit, and serves a role-scoped leadership
dashboard API.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import asyncio
import csv
import io
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

import domain as D
import delivery as DL
import operations as O
from daily_progress_routes import create_router as create_daily_progress_router, seed_historical
from analysis import analyze_blockers
from sheets_adapter import SheetsAdapter
from history_sources import prefer_backup_snapshot

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pod-dashboard")

IST = timezone(timedelta(hours=5, minutes=30))
BACKUP_HOUR_IST = 4

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
FRESH_THRESHOLD_SECONDS = 130  # ~2 poll cycles

adapter = SheetsAdapter()
_sync_lock = asyncio.Lock()

app = FastAPI(title="Live POD Operations Dashboard")
api = APIRouter(prefix="/api")


# ----------------------------- Auth helpers -----------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class LoginBody(BaseModel):
    email: str
    password: str


# ----------------------------- Sync engine -----------------------------
async def latest_snapshot():
    return await db.snapshots.find_one({}, sort=[("reporting_date", -1), ("revision", -1)])


def normalize_backup_values(values: list[list[str]]) -> list[list[str]]:
    if len(values) < 2:
        return values
    headers = [header.strip() for header in values[1]]
    legacy_completed_header = "Number of Task Completed"
    if legacy_completed_header not in headers or D.FIELD_LABEL["tasks_approved_after_crucible"] in headers:
        return values
    source_index = {header: index for index, header in enumerate(headers)}
    normalized_rows = [[""] * len(D.COLUMNS), D.HEADER_LABELS]
    for row in values[2:]:
        normalized_row = []
        for field_key, header, _group in D.COLUMNS:
            source_header = legacy_completed_header if field_key == "tasks_approved_after_crucible" else header
            index = source_index.get(source_header)
            normalized_row.append(row[index] if index is not None and index < len(row) else "")
        normalized_rows.append(normalized_row)
    return normalized_rows


def backup_doc_to_snapshot(doc: dict) -> dict | None:
    values = list(csv.reader(io.StringIO(doc.get("csv", ""))))
    parsed = D.parse_rows(normalize_backup_values(values))
    if not parsed["header_ok"] or not parsed["people"]:
        return None
    reporting_date = doc["backup_date"]
    people = [build_person_doc({**person, "reporting_date": reporting_date}) for person in parsed["people"]]
    return {
        "id": f"backup:{reporting_date}", "reporting_date": reporting_date,
        "revision": 0, "created_at": doc.get("created_at"), "person_count": len(people),
        "people": people, "source": "backup",
        "backup_trigger": doc.get("trigger"),
        "backup_created_at": doc.get("created_at"),
    }


async def snapshot_for_date(date: str | None):
    if not date:
        return await latest_snapshot()
    backup = await db.csv_backups.find_one({"backup_date": date})
    backup_snapshot = backup_doc_to_snapshot(backup) if backup else None
    snapshot = await db.snapshots.find_one({"reporting_date": date}, sort=[("revision", -1)])
    if snapshot:
        snapshot["source"] = "snapshot"
    return prefer_backup_snapshot(snapshot, backup_snapshot)


def reporting_date_options(snapshot_dates: list[str], backup_dates: list[str]) -> list[dict[str, str]]:
    snapshots = set(snapshot_dates)
    backups = set(backup_dates)
    return [
        {
            "date": date,
            "source": "snapshot+backup" if date in snapshots and date in backups
            else "snapshot" if date in snapshots else "backup",
        }
        for date in sorted(snapshots | backups, reverse=True)
    ]


def build_person_doc(rec: dict) -> dict:
    doc = {k: rec.get(k, "") for k in D.FIELD_KEYS}
    doc["reporting_date"] = rec.get("reporting_date")
    doc["status_tokens"] = rec.get("status_tokens", [])
    doc["status_tokens_lower"] = [t.lower() for t in rec.get("status_tokens", [])]
    doc["semantic_hash"] = D.semantic_hash(rec)
    doc["is_attention"] = D.is_attention(rec)
    doc["completeness"] = D.completeness_pct(rec)
    doc["has_trinity"] = D.has_any(rec, D.TRINITY_FIELDS)
    doc["has_manual"] = D.has_any(rec, D.MANUAL_FIELDS)
    doc["pod"] = rec.get("pod_lead", "")
    prog = D.derive_progress(rec)
    doc["progress"] = prog
    doc["completion_state"] = prog["completion_state"]
    doc["absent"] = prog["absent"]
    doc["workstream_label"] = prog["label"]
    return doc


def diff_people(prev_people: list[dict], new_people: list[dict], meta: dict) -> list[dict]:
    prev = {p["email"]: p for p in prev_people}
    new = {p["email"]: p for p in new_people}
    events = []
    detected = D.now_iso()

    def base(p):
        return {
            "id": str(uuid.uuid4()), "detected_at": detected,
            "reporting_date": meta["reporting_date"], "revision": meta["revision"],
            "run_id": meta["run_id"], "email": p["email"], "name": p.get("name", ""),
            "tpm": p.get("tpm", ""), "pod": p.get("pod", ""),
        }

    for email, p in new.items():
        if email not in prev:
            e = base(p)
            e.update({"field": "_person", "field_label": "Person", "group": "identity",
                      "before": "", "after": "Added", "classification": "added"})
            events.append(e)
    for email, p in prev.items():
        if email not in new:
            e = base(p)
            e.update({"field": "_person", "field_label": "Person", "group": "identity",
                      "before": "Present", "after": "Removed", "classification": "removed"})
            events.append(e)
    for email, p in new.items():
        if email not in prev:
            continue
        old = prev[email]
        if old.get("semantic_hash") == p.get("semantic_hash") and \
           old.get("tasking_status", "") == p.get("tasking_status", ""):
            continue
        for f in D.FIELD_KEYS:
            if f == "date":
                continue
            bv, av = (old.get(f) or "").strip(), (p.get(f) or "").strip()
            if bv == av:
                continue
            if f == "tasking_status":
                same = sorted(old.get("status_tokens_lower", [])) == sorted(p.get("status_tokens_lower", []))
                cls = "raw-only" if same else "semantic"
            else:
                cls = "raw-only" if bv.lower() == av.lower() else "semantic"
            e = base(p)
            e.update({"field": f, "field_label": D.FIELD_LABEL[f], "group": D.FIELD_GROUP[f],
                      "before": bv, "after": av, "classification": cls})
            events.append(e)
    return events


async def run_sync(trigger: str = "scheduled") -> dict:
    if _sync_lock.locked():
        return {"status": "skipped", "reason": "sync already running"}
    async with _sync_lock:
        run_id = str(uuid.uuid4())
        started = D.now_iso()
        run = {"id": run_id, "trigger": trigger, "started_at": started,
               "status": "running", "finished_at": None}
        await db.sync_runs.insert_one({**run})
        try:
            raw = await adapter.read_master()
        except Exception as exc:  # transient / auth / network
            reason = f"Sheets read failed: {type(exc).__name__}"
            logger.error("%s: %s", reason, exc)
            await _finish_run(run_id, "failed", reason)
            return {"status": "failed", "reason": reason}

        parsed = D.parse_rows(raw["values"])
        reason = _validate_candidate(parsed, raw)
        if reason:
            await _finish_run(run_id, "quarantined", reason, extra={
                "workbook_title": raw.get("title"),
                "row_count": parsed["row_count"],
                "distinct_dates": parsed["distinct_dates"],
                "schema_hash": parsed["schema_hash"],
            })
            return {"status": "quarantined", "reason": reason}

        result = await _accept(parsed, run_id, raw)
        await _finish_run(run_id, "success", None, extra=result)
        return {"status": "success", **result}


def _validate_candidate(parsed: dict, raw: dict) -> str | None:
    if not parsed["header_ok"]:
        return "Schema drift: Master header row does not match the expected 30 columns"
    if raw.get("formula_error"):
        return "Formula error token detected in Master range"
    if not parsed["reporting_date"]:
        if len(parsed["distinct_dates"]) > 1:
            return f"Mixed reporting dates detected: {', '.join(parsed['distinct_dates'])}"
        return "No valid reporting date found in Date column"
    if parsed["duplicate_email"]:
        return "Duplicate canonical Email values detected"
    if parsed["row_count"] == 0:
        return "No data rows returned"
    return None


async def _accept(parsed: dict, run_id: str, raw: dict) -> dict:
    reporting_date = parsed["reporting_date"]
    new_people = [build_person_doc(r) for r in parsed["people"]]

    prev_same = await db.snapshots.find_one({"reporting_date": reporting_date}, sort=[("revision", -1)])
    prev_overall = await latest_snapshot()

    # No-op detection vs latest revision of the same date.
    if prev_same:
        old_hashes = {p["email"]: p.get("semantic_hash") for p in prev_same["people"]}
        new_hashes = {p["email"]: p.get("semantic_hash") for p in new_people}
        if old_hashes == new_hashes:
            return {"reporting_date": reporting_date, "revision": prev_same["revision"],
                    "person_count": len(new_people), "change_count": 0, "noop": True,
                    "workbook_title": raw.get("title")}

    revision = (prev_same["revision"] + 1) if prev_same else 1
    is_baseline = prev_same is None and prev_overall is None
    compare_base = prev_same if prev_same else (prev_overall if prev_overall else None)
    prev_people = compare_base["people"] if compare_base else []

    meta = {"reporting_date": reporting_date, "revision": revision, "run_id": run_id}
    events = [] if is_baseline else diff_people(prev_people, new_people, meta)

    added = sum(1 for e in events if e["classification"] == "added")
    removed = sum(1 for e in events if e["classification"] == "removed")
    changed = len({e["email"] for e in events if e["classification"] in ("semantic", "raw-only")})

    snapshot = {
        "id": str(uuid.uuid4()), "reporting_date": reporting_date, "revision": revision,
        "created_at": D.now_iso(), "run_id": run_id, "schema_hash": parsed["schema_hash"],
        "person_count": len(new_people), "is_baseline": is_baseline,
        "people": new_people,
        "change_summary": {"added": added, "removed": removed, "changed": changed},
    }
    await db.snapshots.insert_one(snapshot)
    if events:
        await db.change_events.insert_many(events)

    return {"reporting_date": reporting_date, "revision": revision,
            "person_count": len(new_people), "change_count": added + removed + changed,
            "added": added, "removed": removed, "changed": changed,
            "baseline": is_baseline, "workbook_title": raw.get("title")}


async def _finish_run(run_id: str, status: str, reason: str | None, extra: dict | None = None):
    upd = {"status": status, "finished_at": D.now_iso(), "reason": reason}
    if extra:
        upd.update({k: v for k, v in extra.items() if k != "people"})
    await db.sync_runs.update_one({"id": run_id}, {"$set": upd})


async def poller():
    interval = int(os.environ.get("SYNC_INTERVAL_SECONDS", "60"))
    await asyncio.sleep(3)
    while True:
        try:
            res = await run_sync("scheduled")
            logger.info("Poll sync: %s", res.get("status"))
        except Exception as exc:
            logger.error("Poller error: %s", exc)
        await asyncio.sleep(interval)


# ----------------------------- Query helpers -----------------------------
def filter_people(people: list[dict], q: dict) -> list[dict]:
    out = []
    for p in people:
        if q.get("tpm") and p.get("tpm") != q["tpm"]:
            continue
        if q.get("pod") and p.get("pod") != q["pod"]:
            continue
        if q.get("role") and p.get("role") != q["role"]:
            continue
        if q.get("employment") and p.get("employment") != q["employment"]:
            continue
        if q.get("project") and p.get("project_name") != q["project"]:
            continue
        if q.get("status") and q["status"].lower() not in p.get("status_tokens_lower", []):
            continue
        if q.get("operation") and not O.matches_operation(p, q["operation"]):
            continue
        if q.get("attention") and not p.get("is_attention"):
            continue
        band = q.get("completeness")
        if band:
            state = p.get("completion_state", "incomplete")
            if band != state:
                continue
        s = q.get("search")
        if s:
            s = s.strip().lower()
            if s not in p.get("name", "").lower() and s not in p.get("email", "").lower():
                continue
        out.append(p)
    return out


def parse_filters(**kwargs) -> dict:
    return {k: v for k, v in kwargs.items() if v not in (None, "", "all")}


def count_by(people, key):
    counts = {}
    for p in people:
        v = (p.get(key) or "").strip() or "Unknown"
        counts[v] = counts.get(v, 0) + 1
    return sorted(({"label": k, "count": v} for k, v in counts.items()),
                  key=lambda x: (-x["count"], x["label"]))


def status_distribution(people):
    counts = {}
    for p in people:
        for t in p.get("status_tokens", []):
            counts[t] = counts.get(t, 0) + 1
    return sorted(({"label": k, "count": v} for k, v in counts.items()),
                  key=lambda x: (-x["count"], x["label"]))


def compute_metrics(people: list[dict]) -> dict:
    n = len(people)
    operational_people = [p for p in people if not O.is_operational_lead(p)]
    operational_count = len(operational_people)
    target = sum(1 for p in operational_people if (p.get("assigned_target") or "").strip())
    trinity = sum(1 for p in operational_people if p.get("has_trinity"))
    manual = sum(1 for p in operational_people if p.get("has_manual"))
    attention = sum(1 for p in operational_people if p.get("is_attention"))
    complete = sum(1 for p in operational_people if p.get("completion_state") == "complete")
    incomplete = sum(1 for p in operational_people if p.get("completion_state") == "incomplete")
    absent = sum(1 for p in operational_people if p.get("completion_state") == "absent")
    no_remark = sum(1 for p in operational_people if "no remark" in (p.get("progress", {}).get("flags") or []))
    return {
        "headcount": n,
        "target_coverage": {"num": target, "den": operational_count, "pct": D.pct(target, operational_count)},
        "trinity_coverage": {"num": trinity, "den": operational_count, "pct": D.pct(trinity, operational_count)},
        "manual_coverage": {"num": manual, "den": operational_count, "pct": D.pct(manual, operational_count)},
        "attention": attention,
        "no_remark": no_remark,
        "completion": {"complete": complete, "incomplete": incomplete, "absent": absent,
                       "pct": D.pct(complete, operational_count - absent) if (operational_count - absent) else None},
        "role_mix": count_by(people, "role"),
        "employment_mix": count_by(people, "employment"),
        "project_mix": count_by(people, "project_name"),
        "workstream_mix": count_by(operational_people, "workstream_label"),
        "status_distribution": status_distribution(operational_people),
    }


def strip_person(p: dict, full: bool = False) -> dict:
    out = {k: p.get(k, "") for k in D.FIELD_KEYS}
    out.update({
        "pod": p.get("pod", ""),
        "status_tokens": p.get("status_tokens", []),
        "is_attention": p.get("is_attention", False),
        "completeness": p.get("completeness", 0),
        "completion_state": p.get("completion_state", "incomplete"),
        "absent": p.get("absent", False),
        "workstream_label": p.get("workstream_label", ""),
        "progress": p.get("progress", {}),
        "has_trinity": p.get("has_trinity", False),
        "has_manual": p.get("has_manual", False),
    })
    if not full:
        for lf in D.LONG_TEXT_FIELDS:
            val = out.get(lf, "")
            out[lf] = (val[:80] + "…") if len(val) > 80 else val
    return out


# ----------------------------- Auth routes -----------------------------
@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user)
    return {"access_token": token, "user": {"id": user["id"], "email": user["email"],
                                            "name": user["name"], "role": user["role"]}}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ----------------------------- Dashboard routes -----------------------------
FILTER_PARAMS = dict(
    date=Query(None), tpm=Query(None), pod=Query(None), role=Query(None),
    employment=Query(None), project=Query(None), status=Query(None),
    search=Query(None), attention=Query(None), completeness=Query(None),
)


async def _people_and_snap(date):
    snap = await snapshot_for_date(date)
    if not snap:
        return None, []
    return snap, snap["people"]


@api.get("/meta")
async def meta(user: dict = Depends(get_current_user)):
    snapshot_dates = await db.snapshots.distinct("reporting_date")
    backup_dates = await db.csv_backups.distinct("backup_date")
    date_options = reporting_date_options(snapshot_dates, backup_dates)
    snap = await latest_snapshot()
    tpms = pods = roles = projects = employments = statuses = []
    if snap:
        people = snap["people"]
        tpms = sorted({p["tpm"] for p in people if p.get("tpm")})
        pods = sorted({p["pod"] for p in people if p.get("pod")})
        roles = sorted({p["role"] for p in people if p.get("role")})
        projects = sorted({p["project_name"] for p in people if p.get("project_name")})
        employments = sorted({p["employment"] for p in people if p.get("employment")})
        statuses = sorted({t for p in people for t in p.get("status_tokens", [])})
    return {
        "dates": [option["date"] for option in date_options],
        "date_options": date_options,
        "latest_date": snap["reporting_date"] if snap else None,
        "options": {"tpms": tpms, "pods": pods, "roles": roles, "projects": projects,
                    "employments": employments, "statuses": statuses},
    }


def _ws_counts(people):
    trinity = manual = harness = manual_qc = on_leave = 0
    t_target = trinity_staged = trinity_completed = m_target = bundles_created = tasks_qced = 0
    for p in people:
        if O.is_operational_lead(p):
            continue
        ws = p.get("progress", {}).get("workstreams", [])
        raw = (p.get("tasking_status") or "").lower()
        at = D.to_int(p.get("assigned_target"))
        is_trinity = O.matches_operation(p, "trinity")
        is_manual = O.matches_operation(p, "manual")
        is_leave = "leave" in raw
        trinity += int(is_trinity)
        manual += int(is_manual)
        harness += int(O.matches_operation(p, "harness"))
        manual_qc += int("manual qc" in raw or "manual_qc" in ws)
        on_leave += int("leave" in raw)
        if at and is_trinity and not is_leave:
            t_target += at
        if is_trinity and not is_leave:
            trinity_staged += D.to_int(p.get("tasks_created_after_forge")) or 0
            trinity_completed += D.to_int(p.get("tasks_approved_after_crucible")) or 0
        if at and is_manual and not is_leave:
            m_target += at
        if is_manual and not is_leave:
            bundles_created += D.to_int(p.get("input_bundles_created")) or 0
            tasks_qced += D.to_int(p.get("tasks_qced")) or 0
    denom = t_target + m_target
    overall = D.pct(trinity_completed + bundles_created + tasks_qced, denom) if denom else 0
    return {
        "members": len(people), "trinity": trinity, "manual": manual, "harness": harness,
        "manual_qc": manual_qc, "on_leave": on_leave,
        "trinity_target": t_target,
        "trinity_staged": trinity_staged,
        "trinity_staged_pct": D.pct(trinity_staged, t_target) if t_target else 0,
        "trinity_completed": trinity_completed,
        "trinity_completed_pct": D.pct(trinity_completed, t_target) if t_target else 0,
        "manual_target": m_target, "manual_staged": bundles_created,
        "bundles_created": bundles_created,
        "tasks_qced": tasks_qced,
        "overall_pct": overall,
    }


def _mode(people, key):
    counts = {}
    for p in people:
        v = (p.get(key) or "").strip()
        if v:
            counts[v] = counts.get(v, 0) + 1
    return max(counts, key=counts.get) if counts else ""


@api.get("/summary")
async def summary(user: dict = Depends(get_current_user), date: str = Query(None)):
    snap, people = await _people_and_snap(date)
    if not snap:
        return {"empty": True}
    groups = {}
    for p in people:
        groups.setdefault(p.get("pod") or "Unknown", []).append(p)

    rows = []
    for name, members in groups.items():
        c = _ws_counts(members)
        ps = compute_phase_summary(members)
        rows.append({
            "name": name,
            "internal_project": _mode(members, "internal_name"),
            "project_category": _mode(members, "project_name"),
            "tpm": members[0].get("tpm", ""),
            "runs": ps["trinity"]["runs_summary"],
            "status": ps["trinity"]["total_row"]["buckets"],
            "funnel": ps["manual"],
            **c,
        })
    rows.sort(key=lambda r: -r["members"])

    tot = _ws_counts(people)
    kpis = {
        "pods": len(groups),
        "members": tot["members"],
        "trinity": tot["trinity"],
        "manual": tot["manual"],
        "harness": tot["harness"],
        "manual_qc": tot["manual_qc"],
        "on_leave": tot["on_leave"],
        "trinity_target": tot["trinity_target"],
        "trinity_staged": tot["trinity_staged"],
        "trinity_staged_pct": tot["trinity_staged_pct"],
        "trinity_completed": tot["trinity_completed"],
        "trinity_completed_pct": tot["trinity_completed_pct"],
        "manual_target": tot["manual_target"],
        "manual_staged": tot["manual_staged"],
        "bundles_created": tot["bundles_created"],
        "tasks_qced": tot["tasks_qced"],
        "overall_pct": tot["overall_pct"],
    }
    return {"reporting_date": snap["reporting_date"], "source": snap.get("source", "snapshot"),
            "backup_trigger": snap.get("backup_trigger"),
            "backup_created_at": snap.get("backup_created_at"),
            "backup_policy": "04:00 IST for the previous reporting day",
            "kpis": kpis, "pods": rows}


@api.get("/delivery")
async def delivery_dashboard(
    user: dict = Depends(get_current_user),
    date_from: str = Query(None), date_to: str = Query(None),
    project: str = Query(None), category: str = Query(None), task_type: str = Query(None),
    pod_lead: str = Query(None), quality_lead: str = Query(None), tpm: str = Query(None),
    author: str = Query(None), feedback: str = Query(None), client: str = Query(None),
    search: str = Query(None),
):
    raw = await adapter.read_deliveries()
    if raw.get("formula_error"):
        raise HTTPException(status_code=503, detail="Formula error detected in Deliveries sheet")
    tasks = DL.parse_delivery_rows(raw.get("values", []))
    filters = parse_filters(
        date_from=date_from, date_to=date_to, project=project, category=category,
        task_type=task_type, pod_lead=pod_lead, quality_lead=quality_lead, tpm=tpm,
        author=author, feedback=feedback, client=client, search=search,
    )
    return DL.build_delivery_dashboard(tasks, filters)




@api.get("/overview")
async def overview(user: dict = Depends(get_current_user), date: str = Query(None),
                   tpm: str = Query(None), pod: str = Query(None), role: str = Query(None),
                   employment: str = Query(None), project: str = Query(None),
                   status: str = Query(None), search: str = Query(None),
                   attention: str = Query(None), completeness: str = Query(None)):
    snap, people = await _people_and_snap(date)
    if not snap:
        return {"empty": True}
    q = parse_filters(tpm=tpm, pod=pod, role=role, employment=employment, project=project,
                      status=status, search=search,
                      attention=(attention == "true") or None, completeness=completeness)
    fp = filter_people(people, q)
    metrics = compute_metrics(fp)
    operations = O.build_operations_snapshot(fp)

    # TPM / POD hierarchy summary
    tpm_summary, pod_summary = {}, {}
    for p in fp:
        tpm_summary.setdefault(p["tpm"] or "Unknown", set()).add(p["email"])
        pod_summary.setdefault(p["pod"] or "Unknown", set()).add(p["email"])
    hierarchy = {
        "tpms": sorted(({"name": k, "headcount": len(v)} for k, v in tpm_summary.items()),
                       key=lambda x: -x["headcount"]),
        "pods": sorted(({"name": k, "headcount": len(v)} for k, v in pod_summary.items()),
                       key=lambda x: -x["headcount"]),
    }

    # Insights (baseline aware)
    dates = await db.snapshots.distinct("reporting_date")
    prior = sorted([d for d in dates if d < snap["reporting_date"]])
    insights = []
    if not prior:
        insights.append({"kind": "baseline", "text": "Baseline captured; day-over-day comparison available after the next reporting date."})
    for cov_key, label in [("target_coverage", "Assigned Target"),
                           ("trinity_coverage", "Trinity"), ("manual_coverage", "Manual")]:
        c = metrics[cov_key]
        if c["pct"] is not None and c["pct"] < 60:
            insights.append({"kind": "low-coverage",
                             "text": f"Low {label} coverage: {c['pct']}% ({c['num']}/{c['den']})",
                             "url": f"/users?completeness=&{cov_key}=missing"})
    return {
        "reporting_date": snap["reporting_date"], "revision": snap["revision"],
        "is_baseline": snap.get("is_baseline", False),
        "change_summary": snap.get("change_summary", {}),
        "metrics": metrics, "operations": operations,
        "hierarchy": hierarchy, "insights": insights,
    }


@api.get("/tpms")
async def tpms(user: dict = Depends(get_current_user), date: str = Query(None),
               tpm: str = Query(None), pod: str = Query(None), role: str = Query(None),
               employment: str = Query(None), project: str = Query(None),
               status: str = Query(None), search: str = Query(None),
               attention: str = Query(None), completeness: str = Query(None)):
    snap, people = await _people_and_snap(date)
    if not snap:
        return {"tpms": []}
    filters = parse_filters(tpm=tpm, pod=pod, role=role, employment=employment,
                            project=project, status=status,
                            attention=(attention == "true") or None,
                            completeness=completeness)
    people = filter_people(people, filters)
    if search:
        term = search.strip().lower()
        people = [p for p in people if term in (p.get("tpm") or "").lower()
                  or term in (p.get("name") or "").lower()
                  or term in (p.get("email") or "").lower()]
    groups = {}
    for p in people:
        groups.setdefault(p["tpm"] or "Unknown", []).append(p)
    rows = []
    for name, members in groups.items():
        m = compute_metrics(members)
        c = _ws_counts(members)
        rows.append({
            "name": name, "headcount": m["headcount"],
            "pod_count": len({p["pod"] for p in members if p.get("pod")}),
            "project_count": len({p["project_name"] for p in members if p.get("project_name")}),
            "attention": m["attention"],
            "trinity": c["trinity"], "manual": c["manual"], "harness": c["harness"],
            "manual_qc": c["manual_qc"], "absent": c["on_leave"],
        })
    rows.sort(key=lambda x: -x["headcount"])
    return {"reporting_date": snap["reporting_date"], "tpms": rows}


@api.get("/tpms/{name}")
async def tpm_detail(name: str, user: dict = Depends(get_current_user), date: str = Query(None)):
    snap, people = await _people_and_snap(date)
    members = [p for p in people if (p.get("tpm") or "Unknown") == name]
    if not members:
        raise HTTPException(status_code=404, detail="Not found")
    pods = {}
    for p in members:
        pods.setdefault(p["pod"] or "Unknown", []).append(p)
    pod_rows = []
    for pn, pm in pods.items():
        m = compute_metrics(pm)
        pod_rows.append({"name": pn, "headcount": m["headcount"], "attention": m["attention"],
                         "target_coverage": m["target_coverage"]["pct"],
                         "trinity_coverage": m["trinity_coverage"]["pct"],
                         "manual_coverage": m["manual_coverage"]["pct"],
                         "insight": _pod_overview_insight(pn, pm, m)})
    pod_rows.sort(key=lambda x: -x["headcount"])
    tm = compute_metrics(members)
    overall = (
        f"{name} leads {len(pod_rows)} PODs and {tm['headcount']} people — "
        f"{tm['completion']['complete']} complete, {tm['completion']['incomplete']} in progress, "
        f"{tm['completion']['absent']} on leave; {tm['attention']} flagged for attention."
    )
    return {"name": name, "reporting_date": snap["reporting_date"],
            "metrics": tm, "counts": _ws_counts(members),
            "overview_insight": overall, "pods": pod_rows}


@api.get("/pods")
async def pods(user: dict = Depends(get_current_user), date: str = Query(None)):
    snap, people = await _people_and_snap(date)
    if not snap:
        return {"pods": []}
    groups = {}
    for p in people:
        groups.setdefault(p["pod"] or "Unknown", []).append(p)
    rows = []
    for name, members in groups.items():
        m = compute_metrics(members)
        rows.append({"name": name, "tpm": members[0].get("tpm", ""), "headcount": m["headcount"],
                     "attention": m["attention"], "target_coverage": m["target_coverage"]["pct"],
                     "trinity_coverage": m["trinity_coverage"]["pct"],
                     "manual_coverage": m["manual_coverage"]["pct"]})
    rows.sort(key=lambda x: -x["headcount"])
    return {"reporting_date": snap["reporting_date"], "pods": rows}


@api.get("/pods/{name}")
async def pod_detail(name: str, user: dict = Depends(get_current_user), date: str = Query(None),
                     search: str = Query(None), status: str = Query(None),
                     role: str = Query(None), completeness: str = Query(None)):
    snap, people = await _people_and_snap(date)
    members = [p for p in people if (p.get("pod") or "Unknown") == name]
    if not members:
        raise HTTPException(status_code=404, detail="Not found")
    q = parse_filters(search=search, status=status, role=role, completeness=completeness)
    filtered = filter_people(members, q)

    # Changes for this POD (current date/revision)
    events = await db.change_events.find(
        {"pod": name, "reporting_date": snap["reporting_date"], "revision": snap["revision"]},
        {"_id": 0}
    ).to_list(2000)

    # Last-updated per member (max detected time across all recorded change events for this POD).
    last_map = {}
    async for e in db.change_events.find({"pod": name}, {"_id": 0, "email": 1, "detected_at": 1}):
        cur = last_map.get(e["email"])
        if not cur or e["detected_at"] > cur:
            last_map[e["email"]] = e["detected_at"]

    m = compute_metrics(members)
    member_insights = [
        {
            "email": p["email"], "name": p.get("name", ""), "role": p.get("role", ""),
            "status": p.get("tasking_status", "") or "No data",
            "workstream": p.get("workstream_label", ""),
            "completion_state": p.get("completion_state", "incomplete"),
            "insight": p.get("progress", {}).get("insight", ""),
            "flags": p.get("progress", {}).get("flags", []),
            "is_attention": p.get("is_attention", False),
            "last_updated": last_map.get(p["email"]),
        }
        for p in sorted(members, key=lambda x: x.get("name", ""))
    ]
    overview_insight = _pod_overview_insight(name, members, m)
    cached = await db.blocker_analyses.find_one(
        {"pod": name, "reporting_date": snap["reporting_date"]},
        {"_id": 0})
    phase_summary = compute_phase_summary(members)

    return {
        "name": name, "reporting_date": snap["reporting_date"], "revision": snap["revision"],
        "tpm": members[0].get("tpm", ""),
        "metrics": m,
        "counts": _ws_counts(members),
        "overview_insight": overview_insight,
        "member_insights": member_insights,
        "people": [strip_person(p) for p in filtered],
        "changes": events,
        "phase_summary": phase_summary,
        "blocker_analysis": cached,
    }


@api.post("/pods/{name}/analyze")
async def pod_analyze(name: str, user: dict = Depends(get_current_user), date: str = Query(None)):
    snap, people = await _people_and_snap(date)
    members = [p for p in people if (p.get("pod") or "Unknown") == name]
    if not members:
        raise HTTPException(status_code=404, detail="Not found")
    m = compute_metrics(members)
    try:
        result = await analyze_blockers(name, members, m)
    except Exception as exc:
        logger.error("Blocker analysis failed for %s: %s", name, exc)
        raise HTTPException(status_code=502, detail=f"Analysis failed: {type(exc).__name__}")
    doc = {
        "pod": name, "reporting_date": snap["reporting_date"], "revision": snap["revision"],
        "generated_at": D.now_iso(), "generated_by": user["email"], "result": result,
    }
    await db.blocker_analyses.update_one(
        {"pod": name, "reporting_date": snap["reporting_date"]},
        {"$set": doc}, upsert=True)
    return doc


PHASE_BUCKETS = ["block", "run", "ship", "hold", "stale", "idle"]

TRINITY_AREAS = [
    ("engram", "Engram", "engram_phase", "directive_disposition", "engram_run_count"),
    ("forge", "Forge", "forge_phase", "edict_disposition", "forge_run_count"),
    ("crucible", "Crucible", "crucible_phase", "verdict_disposition", "crucible_run_count"),
]


def _phase_bucket(phase):
    p = (phase or "").strip().lower()
    if not p:
        return None
    if "not started" in p:
        return "idle"
    # Lifecycle: G→R→0→0.5 sign-off→0.5 signed→1→2→3→4→H→S(publication).
    # Only S - publication counts as shipped.
    if p.startswith("s -") or p.startswith("s-") or "publication" in p:
        return "ship"
    return "run"


def _disp_bucket(disp):
    d = (disp or "").strip().upper()
    if not d:
        return None
    if d.startswith("BLOCK") or d.startswith("BROKEN"):
        return "block"
    if d.startswith("STALE"):
        return "stale"
    if d.startswith("HOLD"):
        return "hold"
    if d.startswith("CURRENT"):
        return "run"
    if "NOT RUN" in d:
        return "idle"
    return None


def _classify(phase, disp):
    """Status = health disposition first (BLOCK/STALE/HOLD are separate from the
    phase milestone), else the phase itself: publication -> Ship, in-progress
    stages -> Run, Not started -> Idle."""
    db = _disp_bucket(disp)
    if db:
        return db
    return _phase_bucket(phase)


def _area_row(key, label, members, phase_f, disp_f, run_f):
    buckets = {b: 0 for b in PHASE_BUCKETS}
    run_sum = total = 0
    for p in members:
        bucket = _classify(p.get(phase_f), p.get(disp_f))
        if bucket is None:
            continue
        buckets[bucket] += 1
        total += 1
        run_sum += D.to_int(p.get(run_f)) or 0
    return {"area": label, "key": key, "total": total, "run_count": run_sum, "buckets": buckets}


def compute_phase_summary(members):
    operational_members = [p for p in members if not O.is_operational_lead(p)]
    active_members = [p for p in operational_members if "leave" not in (p.get("tasking_status") or "").lower()]
    trinity_people = [p for p in active_members if O.matches_operation(p, "trinity")]
    manual_people = [p for p in active_members if O.matches_operation(p, "manual")]
    rows = [_area_row(k, l, active_members, pf, df, rf) for k, l, pf, df, rf in TRINITY_AREAS]
    total_row = {
        "area": "Total", "key": "total",
        "total": sum(r["total"] for r in rows),
        "run_count": sum(r["run_count"] for r in rows),
        "buckets": {b: sum(r["buckets"][b] for r in rows) for b in PHASE_BUCKETS},
    }
    runs_summary = {"engram": rows[0]["total"], "forge": rows[1]["total"], "crucible": rows[2]["total"]}
    trinity_assigned = sum(D.to_int(p.get("assigned_target")) or 0 for p in trinity_people if "leave" not in (p.get("tasking_status") or "").lower())
    trinity_staged = sum(D.to_int(p.get("tasks_created_after_forge")) or 0 for p in trinity_people if "leave" not in (p.get("tasking_status") or "").lower())
    trinity_completed = sum(D.to_int(p.get("tasks_approved_after_crucible")) or 0 for p in trinity_people if "leave" not in (p.get("tasking_status") or "").lower())

    # Per-person area classification for cell drilldown.
    detail = []
    for p in active_members:
        areas = {}
        for k, _l, pf, df, _rf in TRINITY_AREAS:
            b = _classify(p.get(pf), p.get(df))
            if b:
                areas[k] = {"bucket": b, "phase": (p.get(pf) or "").strip(),
                            "disposition": (p.get(df) or "").strip()}
        if areas:
            detail.append({"email": p["email"], "name": p.get("name", ""),
                           "role": p.get("role", ""), "areas": areas})

    manual = {
        "people": len(manual_people),
        "assigned": sum(D.to_int(p.get("assigned_target")) or 0 for p in manual_people),
        "bundles_created": sum(D.to_int(p.get("input_bundles_created")) or 0 for p in manual_people),
        "bundles_approved": sum(D.to_int(p.get("input_bundles_approved")) or 0 for p in manual_people),
        "trajectory": sum(D.to_int(p.get("trajectory_generated")) or 0 for p in manual_people),
        "qced": sum(D.to_int(p.get("tasks_qced")) or 0 for p in manual_people),
    }
    return {
        "statuses": PHASE_BUCKETS,
        "trinity": {"people": len(trinity_people), "assigned": trinity_assigned,
                    "staged": trinity_staged,
                    "staged_pct": D.pct(trinity_staged, trinity_assigned) if trinity_assigned else 0,
                    "completed": trinity_completed,
                    "completed_pct": D.pct(trinity_completed, trinity_assigned) if trinity_assigned else 0,
                    "rows": rows, "total_row": total_row,
                    "runs_summary": runs_summary, "detail": detail},
        "manual": manual,
    }


def _pod_overview_insight(name, members, m):
    n = len(members)
    ws_counts = {}
    for p in (member for member in members if not O.is_operational_lead(member)):
        for w in p.get("progress", {}).get("workstreams", []):
            ws_counts[w] = ws_counts.get(w, 0) + 1
    top = sorted(ws_counts.items(), key=lambda x: -x[1])
    ws_txt = ", ".join(f"{D.WS_LABELS.get(w, w)} {c}" for w, c in top[:4])
    comp = m["completion"]
    return (
        f"POD {name}: {n} people — {ws_txt or 'no workstream data'}. "
        f"{comp['complete']} complete, {comp['incomplete']} in progress, {comp['absent']} on leave. "
        f"{m['attention']} flagged for attention" + (f", {m['no_remark']} with no remark." if m['no_remark'] else ".")
    )


@api.get("/users")
async def users(user: dict = Depends(get_current_user), date: str = Query(None),
                tpm: str = Query(None), pod: str = Query(None), role: str = Query(None),
                employment: str = Query(None), project: str = Query(None),
                status: str = Query(None), search: str = Query(None),
                attention: str = Query(None), completeness: str = Query(None),
                operation: O.OperationFilter | None = Query(None),
                limit: int = Query(500), offset: int = Query(0)):
    snap, people = await _people_and_snap(date)
    if not snap:
        return {"users": [], "total": 0}
    q = parse_filters(tpm=tpm, pod=pod, role=role, employment=employment, project=project,
                      status=status, search=search,
                      attention=(attention == "true") or None, completeness=completeness,
                      operation=operation)
    fp = filter_people(people, q)
    fp.sort(key=lambda p: p.get("email", ""))
    total = len(fp)
    page = fp[offset:offset + limit]
    return {"reporting_date": snap["reporting_date"], "total": total,
            "users": [strip_person(p) for p in page]}


@api.get("/users/{email}")
async def user_detail(email: str, user: dict = Depends(get_current_user)):
    email = email.strip().lower()
    snaps = await db.snapshots.find({}, {"_id": 0}).sort([("reporting_date", 1), ("revision", 1)]).to_list(1000)
    history = []
    current = None
    for s in snaps:
        match = next((p for p in s["people"] if p["email"] == email), None)
        if match:
            history.append({"reporting_date": s["reporting_date"], "revision": s["revision"],
                            "person": strip_person(match, full=True)})
            current = match
    if not current:
        raise HTTPException(status_code=404, detail="User not found")
    events = await db.change_events.find({"email": email}, {"_id": 0}).sort("detected_at", -1).to_list(2000)
    return {
        "email": email,
        "current": strip_person(current, full=True),
        "history": history,
        "audit": events,
        "last_changed_at": events[0]["detected_at"] if events else None,
        "change_count": len(events),
    }


@api.get("/audit")
async def audit(user: dict = Depends(get_current_user), date: str = Query(None),
                pod: str = Query(None), tpm: str = Query(None), classification: str = Query(None),
                group: str = Query(None), field: str = Query(None), search: str = Query(None),
                limit: int = Query(500), offset: int = Query(0)):
    query = {}
    if date:
        query["reporting_date"] = date
    if pod:
        query["pod"] = pod
    if tpm:
        query["tpm"] = tpm
    if classification and classification != "all":
        query["classification"] = classification
    if group and group != "all":
        query["group"] = group
    if field:
        query["field"] = field
    if search:
        pattern = re.escape(search.strip())
        query["$or"] = [
            {"name": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
        ]
    total = await db.change_events.count_documents(query)
    cur = db.change_events.find(query, {"_id": 0}).sort("detected_at", -1).skip(offset).limit(limit)
    page = await cur.to_list(length=limit)
    grouped = await db.change_events.aggregate([
        {"$match": query},
        {"$group": {"_id": "$classification", "count": {"$sum": 1}}},
    ]).to_list(length=10)
    counts = {row["_id"]: row["count"] for row in grouped}
    summary = {
        "added": counts.get("added", 0),
        "removed": counts.get("removed", 0),
        "semantic": counts.get("semantic", 0),
        "raw_only": counts.get("raw-only", 0),
    }
    return {"total": total, "summary": summary, "events": page}


@api.get("/data-health")
async def data_health(user: dict = Depends(get_current_user)):
    runs = await db.sync_runs.find({}, {"_id": 0}).sort("started_at", -1).to_list(50)
    last_success = next((r for r in runs if r["status"] == "success"), None)
    last_attempt = runs[0] if runs else None
    snap = await latest_snapshot()

    state, seconds_since = "unavailable", None
    if last_success and last_success.get("finished_at"):
        finished = datetime.fromisoformat(last_success["finished_at"])
        seconds_since = (datetime.now(timezone.utc) - finished).total_seconds()
        if last_attempt and last_attempt["status"] in ("failed", "quarantined"):
            state = "sync_failed"
        elif seconds_since <= FRESH_THRESHOLD_SECONDS:
            state = "fresh"
        else:
            state = "stale"

    quarantined = [r for r in runs if r["status"] in ("quarantined", "failed")][:10]
    return {
        "state": state,
        "seconds_since_success": seconds_since,
        "last_success": last_success,
        "last_attempt": last_attempt,
        "reporting_date": snap["reporting_date"] if snap else None,
        "person_count": snap["person_count"] if snap else 0,
        "pod_count": len({p["pod"] for p in snap["people"] if p.get("pod")}) if snap else 0,
        "recent_runs": runs[:15],
        "quarantined": quarantined,
        "interval_seconds": int(os.environ.get("SYNC_INTERVAL_SECONDS", "60")),
        "admin_controls": user.get("role") == "admin",
    }


@api.post("/sync")
async def manual_sync(user: dict = Depends(require_admin)):
    return await run_sync("manual")


@api.get("/health/live")
async def live():
    return {"status": "ok"}


# ----------------------------- Daily CSV backup -----------------------------
def _rows_to_csv(values: list[list[str]]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    for row in values:
        w.writerow(row)
    return buf.getvalue()


def latest_due_backup_date(now: datetime | None = None) -> str:
    current = (now or datetime.now(IST)).astimezone(IST)
    latest_run = current.replace(hour=BACKUP_HOUR_IST, minute=0, second=0, microsecond=0)
    if current < latest_run:
        latest_run -= timedelta(days=1)
    return (latest_run.date() - timedelta(days=1)).isoformat()


def next_backup_at(now: datetime | None = None) -> datetime:
    current = (now or datetime.now(IST)).astimezone(IST)
    next_run = current.replace(hour=BACKUP_HOUR_IST, minute=0, second=0, microsecond=0)
    if next_run <= current:
        next_run += timedelta(days=1)
    return next_run


def _snapshot_csv_values(snapshot: dict) -> list[list[str]]:
    values = [[""] * len(D.COLUMNS), D.HEADER_LABELS]
    values.extend([[person.get(key, "") for key in D.FIELD_KEYS] for person in snapshot["people"]])
    return values


async def backup_now(trigger: str = "scheduled", backup_date: str | None = None) -> dict:
    target_date = backup_date
    raw = None
    try:
        raw = await adapter.read_master()
    except Exception as exc:
        logger.error("CSV backup sheet read failed: %s", exc)

    values = raw.get("values", []) if raw else []
    parsed = D.parse_rows(values)
    sheet_date = parsed.get("reporting_date")
    if not target_date:
        target_date = sheet_date or datetime.now(IST).strftime("%Y-%m-%d")

    source = "sheet"
    if not values or sheet_date != target_date:
        snapshot = await db.snapshots.find_one(
            {"reporting_date": target_date}, sort=[("revision", -1)]
        )
        if not snapshot:
            reason = f"No sheet or snapshot data available for reporting date {target_date}"
            logger.error("CSV backup failed: %s", reason)
            return {"status": "failed", "backup_date": target_date, "reason": reason}
        values = _snapshot_csv_values(snapshot)
        source = "snapshot"

    csv_text = _rows_to_csv(values)
    doc = {
        "backup_date": target_date, "reporting_date": target_date,
        "created_at": D.now_iso(), "trigger": trigger, "source": source,
        "sheet_reporting_date": sheet_date,
        "workbook_title": raw.get("title") if raw else None,
        "row_count": max(len(values) - 2, 0), "size_bytes": len(csv_text.encode()),
        "csv": csv_text,
    }
    await db.csv_backups.update_one({"backup_date": target_date}, {"$set": doc}, upsert=True)
    logger.info("CSV backup stored for reporting date %s from %s (%d rows)",
                target_date, source, doc["row_count"])
    return {"status": "ok", "backup_date": target_date, "row_count": doc["row_count"],
            "size_bytes": doc["size_bytes"], "source": source}


async def backup_scheduler():
    await asyncio.sleep(5)
    due_date = latest_due_backup_date()
    if not await db.csv_backups.find_one({"backup_date": due_date}):
        await backup_now("startup-catchup", due_date)
    while True:
        now = datetime.now(IST)
        nxt = next_backup_at(now)
        await asyncio.sleep((nxt - now).total_seconds())
        try:
            await backup_now("scheduled", latest_due_backup_date(datetime.now(IST)))
        except Exception as exc:
            logger.error("Scheduled CSV backup failed: %s", exc)


@api.get("/backups")
async def list_backups(user: dict = Depends(get_current_user)):
    docs = await db.csv_backups.find({}, {"_id": 0, "csv": 0}).sort("backup_date", -1).to_list(400)
    return {"backups": docs, "backup_hour_ist": BACKUP_HOUR_IST,
            "policy": "Previous reporting day", "timezone": "Asia/Kolkata"}


@api.get("/backups/{backup_date}/download")
async def download_backup(backup_date: str, token: str = Query(None), request: Request = None):
    # Allow token via query for direct <a download> links, else header.
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        await get_current_user(request)
    doc = await db.csv_backups.find_one({"backup_date": backup_date})
    if not doc:
        raise HTTPException(status_code=404, detail="No backup for that date")
    return PlainTextResponse(
        doc["csv"], media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="master-{backup_date}.csv"'})


@api.post("/backups/run")
async def run_backup(user: dict = Depends(require_admin)):
    return await backup_now("manual")


# ----------------------------- Startup -----------------------------
async def seed_users():
    accounts = [
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Operations Admin", "admin"),
        (os.environ["VIEWER_EMAIL"], os.environ["VIEWER_PASSWORD"], "Leadership Viewer", "viewer"),
    ]
    for email, pw, name, role in accounts:
        email = email.strip().lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": email,
                                       "password_hash": hash_password(pw), "name": name,
                                       "role": role, "created_at": D.now_iso()})
        elif not verify_password(pw, existing["password_hash"]):
            await db.users.update_one({"email": email},
                                      {"$set": {"password_hash": hash_password(pw), "role": role}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.snapshots.create_index([("reporting_date", -1), ("revision", -1)])
    await db.change_events.create_index([("email", 1)])
    await db.change_events.create_index([("pod", 1), ("reporting_date", 1)])
    await db.sync_runs.create_index([("started_at", -1)])
    await db.csv_backups.create_index("backup_date", unique=True)
    await db.daily_progress.create_index("record_key", unique=True)
    inserted = await seed_historical(db, ROOT_DIR / "data" / "daily_progress_historical.json")
    await seed_users()
    asyncio.create_task(poller())
    asyncio.create_task(backup_scheduler())
    logger.info("Startup complete; poller + daily backup scheduled; %s historical progress rows seeded.", inserted)


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.include_router(create_daily_progress_router(db, adapter, get_current_user, require_admin))
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
