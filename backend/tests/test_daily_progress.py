import json
from pathlib import Path

import daily_progress as DP
import delivery as DL


def task(task_id="task-1", authors=None, date="2026-09-17", task_type="Trinity"):
    return {
        "task_id": task_id, "project_name": "Project", "project_category": "Category",
        "pod_lead": "Lead", "quality_lead": "QL", "tpm": "TPM", "task": "Task",
        "task_type": task_type, "authors": authors or [], "delivery_date": date,
        "client_name": "", "task_feedback": "", "overall_feedback": "",
        "feedback_date": "", "rating": "", "feedback_status": "", "feedback_history": [],
    }


def record(email="a@example.com", date="2026-09-17", task_type="Trinity", assigned=10, created=8):
    return {
        "record_key": f"{email}|{date}|{task_type.casefold()}", "name": "A", "email": email,
        "date": date, "task_type": task_type, "assigned": assigned, "created": created,
        "remarks": "", "pod_lead": "Lead", "source": "test", "assigned_normalized_from_text": False,
    }


def test_csv_validation_and_duplicate_protection():
    text = "name,email,date,task type,assigned,created,remarks\nA,a@example.com,2026-09-18,Trinity,10,8,Good\nA,a@example.com,2026-09-18,Trinity,10,8,Again\nBad,nope,18/09/2026,,x,-1,"
    records, errors = DP.parse_csv(text)
    assert len(records) == 1
    assert records[0]["date"] == "2026-09-18"
    assert records[0]["remarks"] == "Good"
    assert len(errors) == 2
    assert "Duplicate" in errors[0]["error"]
    assert "Email is invalid" in errors[1]["error"]
    assert "numeric" in errors[1]["error"]


def test_missing_headers_are_rejected():
    records, errors = DP.parse_csv("name,email\nA,a@example.com")
    assert records == []
    assert "Missing required columns" in errors[0]["error"]


def test_dashboard_metrics_week_and_fractional_delivery():
    records = [record(), record("b@example.com", "2026-09-18", assigned=5, created=5)]
    tasks = [task(authors=[{"name": "A", "email": "a@example.com"}, {"name": "B", "email": "b@example.com"}])]
    result = DP.build_dashboard(records, tasks)
    assert result["kpis"] == {
        "assigned": 15, "created": 13, "delivered": 1.0, "completion_pct": 86.7,
        "pending_creation": 2, "pending_delivery": 12.0, "delivery_rate": 7.7,
    }
    assert result["weekly"][0]["label"] == "2026-09-14 – 2026-09-20"
    assert result["records"][1]["delivered"] == 0.5
    person = DP.build_dashboard(records, tasks, {"email": "a@example.com"})
    assert person["kpis"]["delivered"] == 0.5


def test_historical_seed_invariants():
    path = Path(__file__).parents[1] / "data" / "daily_progress_historical.json"
    records = json.loads(path.read_text(encoding="utf-8"))
    assert len(records) == 1272
    assert len({record["email"] for record in records}) == 318
    assert sum(record["assigned"] for record in records) == 10797
    assert sum(record["created"] for record in records) == 7453
    assert sum(record["assigned_normalized_from_text"] for record in records) == 97
    assert len({record["record_key"] for record in records}) == len(records)
    dashboard = DP.build_dashboard(records, [])
    assert dashboard["kpis"]["completion_pct"] == 69.0
    assert dashboard["kpis"]["delivered"] == 0
    assert {row["label"] for row in dashboard["task_types"]} >= {"Trinity", "Harness"}
