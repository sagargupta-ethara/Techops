from __future__ import annotations

import hashlib
import re
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TypedDict

from delivery_summaries import summarize_delivery_owners


class Author(TypedDict):
    name: str
    email: str


class DeliveryTask(TypedDict):
    task_id: str
    project_name: str
    project_category: str
    pod_lead: str
    quality_lead: str
    tpm: str
    task: str
    task_type: str
    authors: list[Author]
    delivery_date: str
    client_name: str
    task_feedback: str
    overall_feedback: str
    feedback_date: str
    rating: str
    feedback_status: str
    feedback_history: list[dict[str, str]]


class DeliveryDashboard(TypedDict):
    kpis: dict[str, int | float]
    task_types: list[dict]
    projects: list[dict]
    trend: list[dict]
    taskers: list[dict]
    tpms: list[dict]
    pod_leads: list[dict]
    project_feedback: list[dict]
    overall_feedback: list[dict]
    tasks: list[dict]
    meta: dict[str, list[str] | str]


HEADER_ALIASES = {
    "projectname": "project_name", "project": "project_name",
    "projectcategory": "project_category", "category": "project_category",
    "podlead": "pod_lead", "qualitylead": "quality_lead", "qalead": "quality_lead",
    "tpm": "tpm", "taskiduuid": "task_id", "taskid": "task_id", "uuid": "task_id",
    "task": "task", "taskname": "task", "tasktitle": "task",
    "tasktype": "task_type", "deliverydate": "delivery_date", "delivereddate": "delivery_date",
    "clientname": "client_name", "client": "client_name",
    "clientfeedback": "task_feedback", "taskfeedback": "task_feedback",
    "individualtaskfeedback": "task_feedback", "overallclientfeedback": "overall_feedback",
    "overallfeedback": "overall_feedback", "projectfeedback": "overall_feedback",
    "feedbackdate": "feedback_date", "clientrating": "rating", "overallratingscore": "rating",
    "overallrating": "rating", "rating": "rating", "score": "rating",
    "feedbackstatus": "feedback_status",
}
EMPTY_TOKENS = {"", "-", "na", "n/a", "none", "null"}


def _header(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def _value(row: Sequence[str], index: int | None) -> str:
    if index is None or index >= len(row):
        return ""
    value = str(row[index] or "").strip()
    return "" if value.casefold() in EMPTY_TOKENS else value


def _date(value: str) -> str:
    cleaned = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", value.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\bSept\b", "Sep", cleaned, flags=re.IGNORECASE)
    for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return value.strip()


def _fallback_id(task: DeliveryTask) -> str:
    source = "|".join((task["project_name"], task["task"], task["delivery_date"],
                       ",".join(a["email"] or a["name"] for a in task["authors"])))
    return f"generated-{hashlib.sha256(source.encode()).hexdigest()[:16]}"


def _author_key(author: Author) -> str:
    return (author["email"] or author["name"]).casefold()


def parse_delivery_rows(values: Sequence[Sequence[str]]) -> list[DeliveryTask]:
    if not values:
        return []
    headers = [_header(str(value)) for value in values[0]]
    columns = {canonical: headers.index(alias) for alias, canonical in HEADER_ALIASES.items() if alias in headers}
    author_names: dict[int, int] = {}
    author_emails: dict[int, int] = {}
    for index, header in enumerate(headers):
        name_match = re.fullmatch(r"(?:author|tasker)(\d+)", header)
        email_match = re.fullmatch(r"(?:author|tasker)(\d+)email|(?:author|tasker)email(\d+)", header)
        if name_match:
            author_names[int(name_match.group(1))] = index
        if email_match:
            author_emails[int(email_match.group(1) or email_match.group(2))] = index

    tasks: dict[str, DeliveryTask] = {}
    for source_row in values[1:]:
        row = [str(value or "") for value in source_row]
        authors: list[Author] = []
        for slot in sorted(set(author_names) | set(author_emails)):
            author = {"name": _value(row, author_names.get(slot)), "email": _value(row, author_emails.get(slot)).casefold()}
            if (author["name"] or author["email"]) and _author_key(author) not in {_author_key(item) for item in authors}:
                authors.append(author)
        get = lambda key: _value(row, columns.get(key))
        task: DeliveryTask = {
            "task_id": get("task_id"), "project_name": get("project_name") or "Unknown",
            "project_category": get("project_category") or "Unknown", "pod_lead": get("pod_lead") or "Unknown",
            "quality_lead": get("quality_lead") or "Unknown", "tpm": get("tpm") or "Unknown",
            "task": get("task"), "task_type": get("task_type") or "Unknown", "authors": authors,
            "delivery_date": _date(get("delivery_date")), "client_name": get("client_name"),
            "task_feedback": get("task_feedback"), "overall_feedback": get("overall_feedback"),
            "feedback_date": _date(get("feedback_date")), "rating": get("rating"),
            "feedback_status": get("feedback_status"), "feedback_history": [],
        }
        task["task_id"] = task["task_id"] or _fallback_id(task)
        if task["task_feedback"]:
            task["feedback_history"] = [{"feedback": task["task_feedback"], "date": task["feedback_date"] or "NA",
                                          "rating": task["rating"] or "NA", "status": task["feedback_status"] or "NA"}]
        key = task["task_id"].casefold()
        if key not in tasks:
            tasks[key] = task
            continue
        current = tasks[key]
        known_authors = {_author_key(author) for author in current["authors"]}
        current["authors"].extend(author for author in task["authors"] if _author_key(author) not in known_authors)
        known_feedback = {(item["feedback"], item["date"], item["rating"], item["status"]) for item in current["feedback_history"]}
        current["feedback_history"].extend(item for item in task["feedback_history"]
                                           if (item["feedback"], item["date"], item["rating"], item["status"]) not in known_feedback)
        for field in ("task", "client_name", "task_feedback", "overall_feedback", "feedback_date", "rating", "feedback_status"):
            if not current[field] and task[field]:
                current[field] = task[field]
    for task in tasks.values():
        task["feedback_history"].sort(key=lambda item: item["date"] if item["date"] != "NA" else "", reverse=True)
        if task["feedback_history"]:
            latest = task["feedback_history"][0]
            task["task_feedback"] = latest["feedback"]
            task["feedback_date"] = latest["date"] if latest["date"] != "NA" else ""
    return list(tasks.values())


def _matches(task: DeliveryTask, filters: Mapping[str, str]) -> bool:
    exact = {
        "project": "project_name", "category": "project_category", "task_type": "task_type",
        "pod_lead": "pod_lead", "quality_lead": "quality_lead", "tpm": "tpm", "client": "client_name",
    }
    if any(filters.get(key) and task[field].casefold() != filters[key].casefold() for key, field in exact.items()):
        return False
    if filters.get("date_from") and task["delivery_date"] < filters["date_from"]:
        return False
    if filters.get("date_to") and task["delivery_date"] > filters["date_to"]:
        return False
    author = filters.get("author", "").casefold()
    if author and not any(author in (item["email"] or item["name"]).casefold() for item in task["authors"]):
        return False
    feedback = filters.get("feedback", "").casefold()
    if feedback == "with" and not task["task_feedback"]:
        return False
    if feedback == "without" and task["task_feedback"]:
        return False
    if feedback not in ("", "with", "without") and task["feedback_status"].casefold() != feedback:
        return False
    search = filters.get("search", "").casefold()
    searchable = " ".join((task["task_id"], task["task"], task["project_name"], task["task_type"],
                           *(a["name"] + " " + a["email"] for a in task["authors"]))).casefold()
    return not search or search in searchable


def _options(tasks: Sequence[DeliveryTask]) -> dict[str, list[str] | str]:
    fields = {"projects": "project_name", "categories": "project_category", "task_types": "task_type",
              "pod_leads": "pod_lead", "quality_leads": "quality_lead", "tpms": "tpm", "clients": "client_name"}
    options: dict[str, list[str] | str] = {
        key: sorted({task[field] for task in tasks if task[field] and task[field] != "Unknown"}) for key, field in fields.items()
    }
    options["authors"] = sorted({(author["email"] or author["name"]) for task in tasks for author in task["authors"]})
    options["feedback_statuses"] = sorted({task["feedback_status"] for task in tasks if task["feedback_status"]})
    dates = sorted(task["delivery_date"] for task in tasks if re.fullmatch(r"\d{4}-\d{2}-\d{2}", task["delivery_date"]))
    options["min_date"] = dates[0] if dates else ""
    options["max_date"] = dates[-1] if dates else ""
    return options


def _fractions(count: int) -> list[float]:
    if count <= 0:
        return []
    base = round(1 / count, 4)
    return [base] * (count - 1) + [round(1 - base * (count - 1), 4)]


def build_delivery_dashboard(tasks: Sequence[DeliveryTask], filters: Mapping[str, str] | None = None) -> DeliveryDashboard:
    active = [task for task in tasks if _matches(task, filters or {})]
    type_counts: dict[str, int] = {}
    projects: dict[str, dict] = {}
    taskers: dict[str, dict] = {}
    trend: dict[str, int] = {}
    for task in active:
        type_counts[task["task_type"]] = type_counts.get(task["task_type"], 0) + 1
        trend[task["delivery_date"] or "Unknown"] = trend.get(task["delivery_date"] or "Unknown", 0) + 1
        project = projects.setdefault(task["project_name"], {"project": task["project_name"], "total": 0, "task_types": {}})
        project["total"] += 1
        project["task_types"][task["task_type"]] = project["task_types"].get(task["task_type"], 0) + 1
        attribution_authors = task["authors"] or [{"name": "Unassigned", "email": ""}]
        for author, contribution in zip(attribution_authors, _fractions(len(attribution_authors))):
            key = _author_key(author) if task["authors"] else "__unassigned__"
            row = taskers.setdefault(key, {"tasker": author["name"] or author["email"], "email": author["email"],
                                           "task_ids": set(), "contribution": 0.0, "projects": {}, "with_feedback": 0,
                                           "unassigned": not task["authors"]})
            row["task_ids"].add(task["task_id"])
            row["contribution"] += contribution
            row["projects"][task["project_name"]] = row["projects"].get(task["project_name"], 0) + contribution
            row["with_feedback"] += int(bool(task["task_feedback"]))
    project_rows = []
    for row in projects.values():
        row["production"] = sum(count for label, count in row["task_types"].items() if label.casefold().startswith("production"))
        row["sample"] = sum(count for label, count in row["task_types"].items() if label.casefold().startswith("sample"))
        project_rows.append(row)
    tasker_rows = []
    for row in taskers.values():
        task_count = len(row.pop("task_ids"))
        row["task_count"] = task_count
        row["contribution"] = round(row["contribution"], 4)
        row["projects"] = {key: round(value, 4) for key, value in row["projects"].items()}
        row["without_feedback"] = task_count - row["with_feedback"]
        row["feedback_coverage"] = round(100 * row["with_feedback"] / task_count, 1) if task_count else 0
        tasker_rows.append(row)
    with_feedback = sum(1 for task in active if task["task_feedback"])
    project_feedback = []
    for project_name in sorted(projects):
        project_tasks = [task for task in active if task["project_name"] == project_name]
        feedback_tasks = [task for task in project_tasks if task["overall_feedback"]]
        latest = max(feedback_tasks or project_tasks, key=lambda task: task["feedback_date"] or "")
        project_feedback.append({"project": project_name, "client": latest["client_name"] or "NA",
                                 "feedback": latest["overall_feedback"] or "NA", "date": latest["feedback_date"] or "NA",
                                 "rating": latest["rating"] or "NA", "status": latest["feedback_status"] or "NA"})
    feedback_projects = [{"project": row["project"], "delivered": row["total"],
                          "with_feedback": sum(1 for task in active if task["project_name"] == row["project"] and task["task_feedback"]),
                          "without_feedback": row["total"] - sum(1 for task in active if task["project_name"] == row["project"] and task["task_feedback"]),
                          "coverage": round(100 * sum(1 for task in active if task["project_name"] == row["project"] and task["task_feedback"]) / row["total"], 1)}
                         for row in project_rows]
    records = [{**task, "client_feedback": task["task_feedback"] or "NA"} for task in active]
    return {
        "kpis": {"total_tasks": len(active), "production_tasks": sum(count for label, count in type_counts.items() if label.casefold().startswith("production")),
                 "sample_tasks": sum(count for label, count in type_counts.items() if label.casefold().startswith("sample")),
                 "total_taskers": sum(1 for row in taskers.values() if not row["unassigned"]),
                 "contribution_units": len(active), "total_projects": len(projects),
                 "with_feedback": with_feedback, "without_feedback": len(active) - with_feedback,
                 "feedback_coverage": round(100 * with_feedback / len(active), 1) if active else 0},
        "task_types": [{"label": label, "count": count} for label, count in sorted(type_counts.items())],
        "projects": sorted(project_rows, key=lambda row: (-row["total"], row["project"])),
        "trend": [{"date": date, "count": count} for date, count in sorted(trend.items())],
        "taskers": sorted(tasker_rows, key=lambda row: (-row["contribution"], row["tasker"])),
        "tpms": summarize_delivery_owners(active, "tpm"),
        "pod_leads": summarize_delivery_owners(active, "pod_lead"),
        "project_feedback": feedback_projects, "overall_feedback": project_feedback,
        "tasks": sorted(records, key=lambda task: (task["delivery_date"], task["task_id"]), reverse=True),
        "meta": _options(tasks),
    }
