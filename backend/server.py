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
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

import domain as D
from sheets_adapter import SheetsAdapter

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pod-dashboard")

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


async def snapshot_for_date(date: str | None):
    if not date:
        return await latest_snapshot()
    return await db.snapshots.find_one({"reporting_date": date}, sort=[("revision", -1)])


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
        if q.get("attention") and not p.get("is_attention"):
            continue
        band = q.get("completeness")
        if band:
            c = p.get("completeness", 0)
            if band == "complete" and c < 100:
                continue
            if band == "partial" and (c <= 0 or c >= 100):
                continue
            if band == "empty" and c != 0:
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
    target = sum(1 for p in people if (p.get("assigned_target") or "").strip())
    trinity = sum(1 for p in people if p.get("has_trinity"))
    manual = sum(1 for p in people if p.get("has_manual"))
    attention = sum(1 for p in people if p.get("is_attention"))
    complete = sum(1 for p in people if p.get("completeness", 0) >= 100)
    partial = sum(1 for p in people if 0 < p.get("completeness", 0) < 100)
    empty = sum(1 for p in people if p.get("completeness", 0) == 0)
    return {
        "headcount": n,
        "target_coverage": {"num": target, "den": n, "pct": D.pct(target, n)},
        "trinity_coverage": {"num": trinity, "den": n, "pct": D.pct(trinity, n)},
        "manual_coverage": {"num": manual, "den": n, "pct": D.pct(manual, n)},
        "attention": attention,
        "completeness": {"complete": complete, "partial": partial, "empty": empty},
        "role_mix": count_by(people, "role"),
        "employment_mix": count_by(people, "employment"),
        "project_mix": count_by(people, "project_name"),
        "status_distribution": status_distribution(people),
    }


def strip_person(p: dict, full: bool = False) -> dict:
    out = {k: p.get(k, "") for k in D.FIELD_KEYS}
    out.update({
        "pod": p.get("pod", ""),
        "status_tokens": p.get("status_tokens", []),
        "is_attention": p.get("is_attention", False),
        "completeness": p.get("completeness", 0),
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
    dates = await db.snapshots.distinct("reporting_date")
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
        "dates": sorted(dates, reverse=True),
        "latest_date": snap["reporting_date"] if snap else None,
        "options": {"tpms": tpms, "pods": pods, "roles": roles, "projects": projects,
                    "employments": employments, "statuses": statuses},
    }


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
    if metrics["attention"]:
        insights.append({"kind": "attention",
                         "text": f"{metrics['attention']} people flagged for attention (Rework / blocked workflow).",
                         "url": "/users?attention=true"})

    return {
        "reporting_date": snap["reporting_date"], "revision": snap["revision"],
        "is_baseline": snap.get("is_baseline", False),
        "change_summary": snap.get("change_summary", {}),
        "metrics": metrics, "hierarchy": hierarchy, "insights": insights,
    }


@api.get("/tpms")
async def tpms(user: dict = Depends(get_current_user), date: str = Query(None)):
    snap, people = await _people_and_snap(date)
    if not snap:
        return {"tpms": []}
    groups = {}
    for p in people:
        groups.setdefault(p["tpm"] or "Unknown", []).append(p)
    rows = []
    for name, members in groups.items():
        m = compute_metrics(members)
        rows.append({
            "name": name, "headcount": m["headcount"],
            "pod_count": len({p["pod"] for p in members if p.get("pod")}),
            "project_count": len({p["project_name"] for p in members if p.get("project_name")}),
            "attention": m["attention"],
            "target_coverage": m["target_coverage"]["pct"],
            "trinity_coverage": m["trinity_coverage"]["pct"],
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
                         "manual_coverage": m["manual_coverage"]["pct"]})
    pod_rows.sort(key=lambda x: -x["headcount"])
    return {"name": name, "reporting_date": snap["reporting_date"],
            "metrics": compute_metrics(members), "pods": pod_rows}


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

    return {
        "name": name, "reporting_date": snap["reporting_date"], "revision": snap["revision"],
        "tpm": members[0].get("tpm", ""),
        "metrics": compute_metrics(members),
        "people": [strip_person(p) for p in filtered],
        "changes": events,
    }


@api.get("/users")
async def users(user: dict = Depends(get_current_user), date: str = Query(None),
                tpm: str = Query(None), pod: str = Query(None), role: str = Query(None),
                employment: str = Query(None), project: str = Query(None),
                status: str = Query(None), search: str = Query(None),
                attention: str = Query(None), completeness: str = Query(None),
                limit: int = Query(500), offset: int = Query(0)):
    snap, people = await _people_and_snap(date)
    if not snap:
        return {"users": [], "total": 0}
    q = parse_filters(tpm=tpm, pod=pod, role=role, employment=employment, project=project,
                      status=status, search=search,
                      attention=(attention == "true") or None, completeness=completeness)
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
                group: str = Query(None), search: str = Query(None),
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
    cur = db.change_events.find(query, {"_id": 0}).sort("detected_at", -1)
    events = await cur.to_list(5000)
    if search:
        s = search.strip().lower()
        events = [e for e in events if s in e.get("name", "").lower() or s in e.get("email", "").lower()]
    total = len(events)
    page = events[offset:offset + limit]
    summary = {
        "added": sum(1 for e in events if e["classification"] == "added"),
        "removed": sum(1 for e in events if e["classification"] == "removed"),
        "semantic": sum(1 for e in events if e["classification"] == "semantic"),
        "raw_only": sum(1 for e in events if e["classification"] == "raw-only"),
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
    await seed_users()
    asyncio.create_task(poller())
    logger.info("Startup complete; poller scheduled.")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
