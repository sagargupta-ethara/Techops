from collections.abc import Mapping, Sequence
from typing import Literal, TypedDict, assert_never

import domain as D

OperationFilter = Literal["trinity", "manual", "harness", "trinity_in_progress", "manual_in_progress"]


class WorkstreamCounts(TypedDict):
    trinity: int
    manual: int
    harness: int


class InProgressCounts(TypedDict):
    trinity: int
    manual: int


class FlagRow(TypedDict):
    name: str
    email: str
    pod: str
    tpm: str
    role: str
    status: str
    assigned_target: str
    tasks_created_after_forge: str
    tasks_approved_after_crucible: str
    input_bundles_created: str
    input_bundles_approved: str
    trajectory_generated: str
    tasks_qced: str
    remarks: str
    reason: str


class FlagGroups(TypedDict):
    leave: list[FlagRow]
    trinity: list[FlagRow]
    manual: list[FlagRow]


class ManualPipeline(TypedDict):
    people: int
    assigned: int
    bundles_created: int
    bundles_approved: int
    trajectory: int
    qced: int


class TrinityPipeline(TypedDict):
    people: int
    assigned: int
    staged: int
    staged_pct: float | int
    completed: int
    completed_pct: float | int


class OperationsSnapshot(TypedDict):
    counts: WorkstreamCounts
    in_progress: InProgressCounts
    flags: FlagGroups
    trinity: TrinityPipeline
    manual: ManualPipeline


class OperationState(TypedDict):
    trinity: bool
    manual: bool
    harness: bool
    leave: bool
    project_lead: bool
    active_tasker: bool
    trinity_complete: bool
    manual_complete: bool
    assigned: int | None
    qced: int | None
    trinity_staged: int | None
    trinity_completed: int | None


def _text(person: Mapping[str, str], key: str) -> str:
    return str(person.get(key) or "").strip()


def is_operational_lead(person: Mapping[str, str]) -> bool:
    status = _text(person, "tasking_status").lower()
    role = _text(person, "role").lower()
    return "project lead" in status or any(token in role for token in ("project lead", "pod lead"))


def _operation_state(person: Mapping[str, str]) -> OperationState:
    status = _text(person, "tasking_status").lower()
    project_lead = is_operational_lead(person)
    trinity = "trinity" in status and not project_lead
    manual = any(token in status for token in ("manual", "dataset", "trajectory", "rework")) and not project_lead
    harness = ("harness" in status or "generation kit" in status) and not project_lead
    leave = "leave" in status
    assigned = D.to_int(_text(person, "assigned_target"))
    qced = D.to_int(_text(person, "tasks_qced"))
    trinity_staged = D.to_int(_text(person, "tasks_created_after_forge"))
    trinity_completed = D.to_int(_text(person, "tasks_approved_after_crucible"))
    trinity_complete = bool(assigned and trinity_completed is not None and trinity_completed >= assigned)
    return {
        "trinity": trinity,
        "manual": manual,
        "harness": harness,
        "leave": leave,
        "project_lead": project_lead,
        "active_tasker": not leave and (not project_lead or bool(assigned)),
        "trinity_complete": trinity_complete,
        "manual_complete": bool(assigned and qced is not None and qced >= assigned),
        "assigned": assigned,
        "qced": qced,
        "trinity_staged": trinity_staged,
        "trinity_completed": trinity_completed,
    }


def matches_operation(person: Mapping[str, str], operation: OperationFilter) -> bool:
    state = _operation_state(person)
    match operation:
        case "trinity":
            return state["trinity"]
        case "manual":
            return state["manual"]
        case "harness":
            return state["harness"]
        case "trinity_in_progress":
            return state["trinity"] and state["active_tasker"] and not state["trinity_complete"]
        case "manual_in_progress":
            return state["manual"] and state["active_tasker"] and not state["manual_complete"]
        case unreachable:
            assert_never(unreachable)


def is_trinity_complete(person: Mapping[str, str]) -> bool:
    state = _operation_state(person)
    return state["trinity"] and state["trinity_complete"]


def _flag_row(person: Mapping[str, str], reason: str) -> FlagRow:
    return {
        "name": _text(person, "name"),
        "email": _text(person, "email"),
        "pod": _text(person, "pod") or "Unknown",
        "tpm": _text(person, "tpm") or "Unknown",
        "role": _text(person, "role"),
        "status": _text(person, "tasking_status"),
        "assigned_target": _text(person, "assigned_target"),
        "tasks_created_after_forge": _text(person, "tasks_created_after_forge"),
        "tasks_approved_after_crucible": _text(person, "tasks_approved_after_crucible"),
        "input_bundles_created": _text(person, "input_bundles_created"),
        "input_bundles_approved": _text(person, "input_bundles_approved"),
        "trajectory_generated": _text(person, "trajectory_generated"),
        "tasks_qced": _text(person, "tasks_qced"),
        "remarks": _text(person, "remarks") or _text(person, "remark"),
        "reason": reason,
    }


def build_operations_snapshot(people: Sequence[Mapping[str, str]]) -> OperationsSnapshot:
    counts: WorkstreamCounts = {"trinity": 0, "manual": 0, "harness": 0}
    in_progress: InProgressCounts = {"trinity": 0, "manual": 0}
    flags: FlagGroups = {"leave": [], "trinity": [], "manual": []}
    trinity: TrinityPipeline = {
        "people": 0,
        "assigned": 0,
        "staged": 0,
        "staged_pct": 0,
        "completed": 0,
        "completed_pct": 0,
    }
    manual: ManualPipeline = {
        "people": 0,
        "assigned": 0,
        "bundles_created": 0,
        "bundles_approved": 0,
        "trajectory": 0,
        "qced": 0,
    }
    progress_fields = [*D.TRINITY_FIELDS, *D.MANUAL_FIELDS]
    task_fields = ["assigned_target", *progress_fields]

    for person in people:
        state = _operation_state(person)
        assigned = state["assigned"]

        counts["trinity"] += int(state["trinity"])
        counts["manual"] += int(state["manual"])
        counts["harness"] += int(state["harness"])
        in_progress["trinity"] += int(matches_operation(person, "trinity_in_progress"))
        in_progress["manual"] += int(matches_operation(person, "manual_in_progress"))

        if state["trinity"] and not state["leave"]:
            trinity["people"] += 1
            trinity["assigned"] += assigned or 0
            trinity["staged"] += state["trinity_staged"] or 0
            trinity["completed"] += state["trinity_completed"] or 0

        if state["manual"] and not state["leave"]:
            manual["people"] += 1
            manual["assigned"] += assigned or 0
            manual["bundles_created"] += D.to_int(_text(person, "input_bundles_created")) or 0
            manual["bundles_approved"] += D.to_int(_text(person, "input_bundles_approved")) or 0
            manual["trajectory"] += D.to_int(_text(person, "trajectory_generated")) or 0
            manual["qced"] += D.to_int(_text(person, "tasks_qced")) or 0

        if state["leave"] and any(_text(person, field) for field in task_fields):
            flags["leave"].append(_flag_row(person, "On leave with task or progress data"))
        if state["trinity"] and not state["project_lead"] and not assigned:
            reason = (
                "Progress or remark exists without an assigned target"
                if any(_text(person, field) for field in progress_fields)
                else "No assigned target"
            )
            flags["trinity"].append(_flag_row(person, reason))
        if state["manual"] and not state["project_lead"] and not assigned:
            reason = (
                "Progress or remark exists without an assigned target"
                if any(_text(person, field) for field in progress_fields)
                else "No assigned target"
            )
            flags["manual"].append(_flag_row(person, reason))

    for rows in flags.values():
        rows.sort(key=lambda row: (row["pod"].casefold(), row["name"].casefold()))
    if trinity["assigned"]:
        trinity["staged_pct"] = D.pct(trinity["staged"], trinity["assigned"]) or 0
        trinity["completed_pct"] = D.pct(trinity["completed"], trinity["assigned"]) or 0
    return {"counts": counts, "in_progress": in_progress, "flags": flags, "trinity": trinity, "manual": manual}
