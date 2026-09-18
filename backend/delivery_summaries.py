from __future__ import annotations

from collections.abc import Sequence
from typing import Literal, TypedDict


class DeliveryOwnerTask(TypedDict):
    project_name: str
    pod_lead: str
    tpm: str


class DeliveryOwnerSummary(TypedDict):
    name: str
    task_count: int
    projects: dict[str, int]


def summarize_delivery_owners(
    tasks: Sequence[DeliveryOwnerTask], owner_field: Literal["tpm", "pod_lead"]
) -> list[DeliveryOwnerSummary]:
    owners: dict[str, DeliveryOwnerSummary] = {}
    for task in tasks:
        owner = task[owner_field] or "Unknown"
        row = owners.setdefault(
            owner, {"name": owner, "task_count": 0, "projects": {}}
        )
        row["task_count"] += 1
        project = task["project_name"]
        row["projects"][project] = row["projects"].get(project, 0) + 1
    return sorted(owners.values(), key=lambda row: (-row["task_count"], row["name"]))
