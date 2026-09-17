"""Master sheet schema, normalization, and metric helpers for the POD Operations Dashboard."""
import hashlib
import json
from datetime import datetime, timezone

# Canonical 30-column Master schema. Order matches Master!A:AD.
# (field_key, header_label, group)
COLUMNS = [
    ("tpm", "TPM", "information"),
    ("pod_lead", "Pod Lead", "information"),
    ("name", "Name", "information"),
    ("email", "Email", "information"),
    ("role", "Role", "information"),
    ("project_name", "Project Name", "information"),
    ("internal_name", "Internal Name", "information"),
    ("employment", "Intern/FTE", "information"),
    ("date", "Date", "information"),
    ("tasking_status", "Tasking Status", "information"),
    ("assigned_target", "Assigned Target", "information"),
    ("tracking_md", "Tracking. MD", "trinity"),
    ("engram_run_count", "ENGRAM Run Count", "trinity"),
    ("engram_phase", "ENGRAM phase", "trinity"),
    ("directive_disposition", "DIRECTIVE.md disposition", "trinity"),
    ("forge_phase", "FORGE phase", "trinity"),
    ("forge_run_count", "FORGE Run Count", "trinity"),
    ("edict_disposition", "EDICT.md disposition", "trinity"),
    ("crucible_run_count", "CRUCIBLE Run Count", "trinity"),
    ("crucible_phase", "CRUCIBLE phase", "trinity"),
    ("verdict_disposition", "VERDICT.md disposition", "trinity"),
    ("completion_status", "Completion Status", "trinity"),
    ("tasks_completed", "Number of Task Completed", "trinity"),
    ("crucible_verdict", "Crucible Verdict", "trinity"),
    ("remarks", "Remarks", "trinity"),
    ("input_bundles_created", "Input Bundles Created", "manual"),
    ("input_bundles_approved", "No. of Input Bundles Approved", "manual"),
    ("trajectory_generated", "Trajectory Generated", "manual"),
    ("tasks_qced", "Number of Task Approved/ QCed", "manual"),
    ("remark", "Remark", "manual"),
]

FIELD_KEYS = [c[0] for c in COLUMNS]
HEADER_LABELS = [c[1] for c in COLUMNS]
FIELD_LABEL = {c[0]: c[1] for c in COLUMNS}
FIELD_GROUP = {c[0]: c[2] for c in COLUMNS}

INFORMATION_FIELDS = [c[0] for c in COLUMNS if c[2] == "information"]
TRINITY_FIELDS = [c[0] for c in COLUMNS if c[2] == "trinity"]
MANUAL_FIELDS = [c[0] for c in COLUMNS if c[2] == "manual"]

# Ten pinned core identity/assignment fields used for completeness scoring.
CORE_FIELDS = [
    "tpm", "pod_lead", "name", "email", "role",
    "project_name", "internal_name", "employment", "date", "tasking_status",
]

# Long free-text fields that should be truncated in lists.
LONG_TEXT_FIELDS = {"remarks", "remark", "tracking_md"}

SCHEMA_HASH = hashlib.sha256("|".join(HEADER_LABELS).encode()).hexdigest()[:16]

# Statuses / dispositions that flag operational attention.
ATTENTION_STATUS_TOKENS = {"rework"}
ATTENTION_DISPOSITION_KEYWORDS = ("block", "stale", "hold", "pending")


def normalize_reporting_date(raw: str) -> str | None:
    """Master 'Date' column is MM-DD-YYYY. Return ISO yyyy-mm-dd, else None."""
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in ("%m-%d-%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def canonical_email(raw: str) -> str:
    return (raw or "").strip().lower()


def normalize_status_tokens(raw: str) -> list[str]:
    """Comma-separated Tasking Status: trim/dedupe, preserve display order."""
    seen, out = set(), []
    for tok in (raw or "").split(","):
        t = tok.strip()
        if not t:
            continue
        key = t.lower()
        if key not in seen:
            seen.add(key)
            out.append(t)
    return out


def parse_rows(values: list[list[str]]) -> dict:
    """Parse a Master!A:AD response into structured people + metadata.

    values[0] = category group row, values[1] = header row, values[2:] = data.
    """
    header_ok = False
    if len(values) >= 2:
        header = [h.strip() for h in values[1]]
        header_ok = header[: len(HEADER_LABELS)] == HEADER_LABELS

    people = []
    data_rows = values[2:] if len(values) > 2 else []
    for row in data_rows:
        padded = list(row) + [""] * (len(COLUMNS) - len(row))
        rec = {FIELD_KEYS[i]: (padded[i] or "").strip() for i in range(len(COLUMNS))}
        rec["email"] = canonical_email(rec["email"])
        if not rec["email"]:
            continue
        rec["reporting_date"] = normalize_reporting_date(rec["date"])
        rec["status_tokens"] = normalize_status_tokens(rec["tasking_status"])
        people.append(rec)

    dates = {p["reporting_date"] for p in people if p["reporting_date"]}
    reporting_date = None
    if len(dates) == 1:
        reporting_date = next(iter(dates))
    elif len(dates) > 1:
        # ambiguous / mixed date
        reporting_date = None

    emails = [p["email"] for p in people]
    dup = len(emails) != len(set(emails))

    return {
        "header_ok": header_ok,
        "schema_hash": SCHEMA_HASH,
        "reporting_date": reporting_date,
        "distinct_dates": sorted(dates),
        "people": people,
        "row_count": len(people),
        "duplicate_email": dup,
    }


def semantic_hash(rec: dict) -> str:
    payload = {k: rec.get(k, "") for k in FIELD_KEYS}
    payload["status_tokens"] = sorted(t.lower() for t in rec.get("status_tokens", []))
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def is_attention(rec: dict) -> bool:
    if any(t.lower() in ATTENTION_STATUS_TOKENS for t in rec.get("status_tokens", [])):
        return True
    for f in ("directive_disposition", "edict_disposition", "verdict_disposition",
              "completion_status", "crucible_verdict"):
        val = (rec.get(f) or "").lower()
        if any(kw in val for kw in ATTENTION_DISPOSITION_KEYWORDS):
            return True
    return False


def has_any(rec: dict, fields: list[str]) -> bool:
    return any((rec.get(f) or "").strip() for f in fields)


def completeness_pct(rec: dict) -> float:
    filled = sum(1 for f in CORE_FIELDS if (rec.get(f) or "").strip())
    return round(1000 * filled / len(CORE_FIELDS)) / 10


def pct(numerator: int, denominator: int):
    if not denominator:
        return None
    return round(1000 * numerator / denominator) / 10


def to_int(v):
    v = (v or "").strip().replace(",", "")
    if not v:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


WS_LABELS = {
    "trinity": "Trinity", "manual_dataset": "Manual Dataset", "trajectory": "Trajectory Generation",
    "manual_qc": "Manual QC", "qc_pipeline": "QC Pipeline", "harness": "Harness",
    "generation_kit": "Generation Kit", "project_lead": "Project Lead", "rework": "Rework",
    "leave": "On Leave",
}
MEASURED_WS = {"manual_dataset", "trajectory", "manual_qc"}
INPROGRESS_WS = {"harness", "generation_kit", "qc_pipeline"}


def derive_progress(rec: dict) -> dict:
    """Status-driven workstream + completion for one person.

    completion is 100 (complete) or None (NA). Pure Leave => absent.
    """
    raw = (rec.get("tasking_status") or "").lower()
    ws = []
    if "trinity" in raw:
        ws.append("trinity")
    if "dataset" in raw:
        ws.append("manual_dataset")
    if "trajectory" in raw:
        ws.append("trajectory")
    if "manual qc" in raw:
        ws.append("manual_qc")
    if "qc pipeline" in raw:
        ws.append("qc_pipeline")
    if "harness" in raw:
        ws.append("harness")
    if "generation kit" in raw:
        ws.append("generation_kit")
    if "project lead" in raw:
        ws.append("project_lead")
    if "rework" in raw:
        ws.append("rework")
    leave = "leave" in raw

    assigned = to_int(rec.get("assigned_target"))
    qced = to_int(rec.get("tasks_qced"))
    remark_t = (rec.get("remarks") or "").strip()
    remark_m = (rec.get("remark") or "").strip()
    remark_text = remark_t or remark_m
    any_remark = bool(remark_text)
    flags = []

    if leave and not ws:
        return {
            "workstreams": ["leave"], "label": "On Leave", "absent": True, "completion": None,
            "completion_state": "absent", "assigned": assigned, "completed": qced,
            "show_trinity": False, "show_manual": False, "flags": [],
            "insight": "On leave — marked absent (no data expected).",
        }

    show_trinity = ("trinity" in ws) or has_any(rec, TRINITY_FIELDS)
    show_manual = any(w in ws for w in ("manual_dataset", "trajectory", "manual_qc")) or has_any(rec, MANUAL_FIELDS)

    def trinity_complete():
        cs = (rec.get("completion_status") or "").lower()
        vd = (rec.get("verdict_disposition") or "").lower()
        cv = (rec.get("crucible_verdict") or "").lower()
        return (any(k in cs for k in ("complete", "done", "100"))
                or "approved" in vd or "approved" in cv or "sign-off" in vd or "signoff" in vd)

    def manual_complete():
        return assigned is not None and assigned > 0 and qced is not None and qced >= assigned

    measured = [w for w in ws if w in MEASURED_WS]
    inprogress = [w for w in ws if w in INPROGRESS_WS]

    considered = False
    complete = True
    if "trinity" in ws:
        considered = True
        if not trinity_complete():
            complete = False
    if measured:
        considered = True
        if not manual_complete():
            complete = False
    if inprogress:
        complete = False
    completion = 100 if (considered and complete) else None

    if ("harness" in ws or "generation_kit" in ws) and not any_remark:
        flags.append("no remark")
    if "rework" in ws:
        flags.append("rework")

    label = " + ".join(WS_LABELS[w] for w in ws) if ws else "Other"

    parts = []
    if "trinity" in ws:
        eng = rec.get("engram_phase") or "No data"
        fo = rec.get("forge_phase") or "No data"
        cr = rec.get("crucible_phase") or "No data"
        parts.append(f"Trinity — ENGRAM {eng}, FORGE {fo}, CRUCIBLE {cr}"
                     + (" (complete)" if trinity_complete() else ""))
    if measured:
        a = assigned if assigned is not None else "No data"
        c = qced if qced is not None else "No data"
        mlabel = "/".join(WS_LABELS[w] for w in measured)
        parts.append(f"{mlabel} — {c}/{a} approved" + (" (complete)" if manual_complete() else " (in progress)"))
    inp = [w for w in ws if w in INPROGRESS_WS]
    if inp:
        ilabel = " & ".join(WS_LABELS[w] for w in inp)
        parts.append(f"{ilabel} — {remark_text[:140]}" if any_remark else f"{ilabel} — no remark logged")
    if "project_lead" in ws:
        parts.append("Project Lead")
    if "rework" in ws:
        parts.append("Flagged for rework")
    insight = "; ".join(parts) if parts else "No workstream data recorded."

    state = "complete" if completion == 100 else "incomplete"
    return {
        "workstreams": ws or ["other"], "label": label, "absent": False, "completion": completion,
        "completion_state": state, "assigned": assigned, "completed": qced,
        "show_trinity": show_trinity, "show_manual": show_manual, "flags": flags, "insight": insight,
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
