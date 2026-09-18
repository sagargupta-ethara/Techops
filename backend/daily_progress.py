from __future__ import annotations

import csv
import io
import re
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import TypedDict

import delivery as DL


class ProgressRecord(TypedDict, total=False):
    record_key: str
    name: str
    email: str
    date: str
    task_type: str
    assigned: float
    created: float
    remarks: str
    pod_lead: str
    source: str
    assigned_normalized_from_text: bool


class Dashboard(TypedDict):
    kpis: dict[str, float]
    daily: list[dict]
    weekly: list[dict]
    task_types: list[dict]
    taskers: list[dict]
    records: list[dict]
    meta: dict[str, str | list[str]]


REQUIRED_COLUMNS = ("name", "email", "date", "task type", "assigned", "created", "remarks")


def _header(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.casefold()).split())


def _key(email: str, record_date: str, task_type: str) -> str:
    return f"{email.casefold()}|{record_date}|{' '.join(task_type.casefold().split())}"


def parse_csv(text: str) -> tuple[list[ProgressRecord], list[dict[str, str | int]]]:
    rows = list(csv.reader(io.StringIO(text.removeprefix("\ufeff"))))
    if not rows:
        return [], [{"row": 1, "error": "The CSV is empty."}]
    headers = [_header(value) for value in rows[0]]
    missing = [column for column in REQUIRED_COLUMNS if column not in headers]
    if missing:
        return [], [{"row": 1, "error": f"Missing required columns: {', '.join(missing)}"}]
    columns = {name: headers.index(name) for name in REQUIRED_COLUMNS}
    records: list[ProgressRecord] = []
    errors: list[dict[str, str | int]] = []
    seen: set[str] = set()
    for row_number, row in enumerate(rows[1:], 2):
        if not any(str(value).strip() for value in row):
            continue
        get = lambda name: str(row[columns[name]] if columns[name] < len(row) else "").strip()
        name, email, raw_date, task_type = get("name"), get("email").casefold(), get("date"), get("task type")
        row_errors: list[str] = []
        if not name:
            row_errors.append("Name is required")
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            row_errors.append("Email is invalid")
        try:
            record_date = datetime.strptime(raw_date, "%Y-%m-%d").date().isoformat()
        except ValueError:
            record_date = ""
            row_errors.append("Date must use YYYY-MM-DD")
        if not task_type:
            row_errors.append("Task type is required")
        numbers: dict[str, float] = {}
        for field in ("assigned", "created"):
            try:
                numbers[field] = float(get(field))
                if numbers[field] < 0:
                    row_errors.append(f"{field.title()} cannot be negative")
            except ValueError:
                row_errors.append(f"{field.title()} must be numeric")
        record_key = _key(email, record_date, task_type)
        if record_key in seen:
            row_errors.append("Duplicate Email + Date + Task Type in this file")
        if row_errors:
            errors.append({"row": row_number, "error": "; ".join(row_errors)})
            continue
        seen.add(record_key)
        records.append({
            "record_key": record_key, "name": name, "email": email, "date": record_date,
            "task_type": task_type, "assigned": numbers["assigned"], "created": numbers["created"],
            "remarks": get("remarks"), "pod_lead": "", "source": "csv_upload",
            "assigned_normalized_from_text": False,
        })
    return records, errors


def _matches(record: ProgressRecord, filters: Mapping[str, str]) -> bool:
    selected = {value for value in filters.get("dates", "").split(",") if value}
    if selected and record["date"] not in selected:
        return False
    if filters.get("date_from") and record["date"] < filters["date_from"]:
        return False
    if filters.get("date_to") and record["date"] > filters["date_to"]:
        return False
    for query, field in (("name", "name"), ("email", "email"), ("task_type", "task_type")):
        if filters.get(query) and record[field].casefold() != filters[query].casefold():
            return False
    search = filters.get("search", "").casefold()
    return not search or search in " ".join((record["name"], record["email"], record["task_type"], record.get("remarks", ""))).casefold()


def _delivery_matches(task: DL.DeliveryTask, filters: Mapping[str, str], dates: set[str]) -> bool:
    if dates and task["delivery_date"] not in dates:
        return False
    if filters.get("date_from") and task["delivery_date"] < filters["date_from"]:
        return False
    if filters.get("date_to") and task["delivery_date"] > filters["date_to"]:
        return False
    if filters.get("task_type") and task["task_type"].casefold() != filters["task_type"].casefold():
        return False
    return True


def _fraction_map(tasks: Sequence[DL.DeliveryTask]) -> dict[tuple[str, str, str], float]:
    result: dict[tuple[str, str, str], float] = {}
    for task in tasks:
        fractions = DL._fractions(len(task["authors"]))
        for author, fraction in zip(task["authors"], fractions, strict=True):
            key = (author["email"].casefold(), task["delivery_date"], task["task_type"].casefold())
            result[key] = round(result.get(key, 0) + fraction, 4)
    return result


def _metric(assigned: float, created: float, delivered: float) -> dict[str, float]:
    return {
        "assigned": round(assigned, 4), "created": round(created, 4), "delivered": round(delivered, 4),
        "completion_pct": round(created / assigned * 100, 1) if assigned else 0,
        "pending_creation": round(max(assigned - created, 0), 4),
        "pending_delivery": round(max(created - delivered, 0), 4),
        "delivery_rate": round(delivered / created * 100, 1) if created else 0,
    }


def _aggregate(records: Sequence[dict], key: str) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for record in records:
        grouped.setdefault(str(record[key]), []).append(record)
    result = []
    for label, items in grouped.items():
        metric = _metric(sum(item["assigned"] for item in items), sum(item["created"] for item in items),
                         sum(item["delivered"] for item in items))
        result.append({"label": label, **metric})
    return sorted(result, key=lambda item: item["label"])


def build_dashboard(records: Sequence[ProgressRecord], tasks: Sequence[DL.DeliveryTask],
                    filters: Mapping[str, str] | None = None) -> Dashboard:
    query = filters or {}
    active = [record for record in records if _matches(record, query)]
    dates = {record["date"] for record in active}
    selected_dates = {value for value in query.get("dates", "").split(",") if value}
    delivery_dates = selected_dates or dates
    active_tasks = [task for task in tasks if _delivery_matches(task, query, delivery_dates)]
    fractions = _fraction_map(active_tasks)
    detailed: list[dict] = []
    for record in active:
        delivered = fractions.get((record["email"], record["date"], record["task_type"].casefold()), 0)
        detailed.append({**record, "delivered": delivered, **_metric(record["assigned"], record["created"], delivered)})
    person_filter = bool(query.get("name") or query.get("email"))
    if person_filter:
        allowed = {record["email"] for record in active}
        delivered_total = sum(value for (email, _date, _type), value in fractions.items() if email in allowed)
    else:
        delivered_total = float(len(active_tasks))
    kpis = _metric(sum(record["assigned"] for record in active), sum(record["created"] for record in active), delivered_total)
    task_types = _aggregate(detailed, "task_type")
    daily = _aggregate(detailed, "date")
    taskers = _aggregate([{**record, "person": f'{record["name"]}|{record["email"]}'} for record in detailed], "person")
    for item in taskers:
        item["name"], item["email"] = item.pop("label").split("|", 1)
    weekly_records = []
    for record in detailed:
        day = datetime.strptime(record["date"], "%Y-%m-%d").date()
        start = day - timedelta(days=day.weekday())
        end = start + timedelta(days=6)
        weekly_records.append({**record, "week": f"{start.isoformat()} – {end.isoformat()}"})
    dates_all = sorted({record["date"] for record in records})
    return {
        "kpis": kpis, "daily": daily, "weekly": _aggregate(weekly_records, "week"),
        "task_types": task_types, "taskers": taskers, "records": sorted(detailed, key=lambda item: (item["date"], item["name"]), reverse=True),
        "meta": {"dates": dates_all, "names": sorted({record["name"] for record in records}),
                 "emails": sorted({record["email"] for record in records}),
                 "task_types": sorted({record["task_type"] for record in records}),
                 "min_date": dates_all[0] if dates_all else "", "max_date": dates_all[-1] if dates_all else "",
                 "historical_note": "14–16 September values are scaled historical figures from the supplied workbook."},
    }
