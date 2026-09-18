from __future__ import annotations

from typing import TypeVar


SnapshotT = TypeVar("SnapshotT")


def prefer_backup_snapshot(
    snapshot: SnapshotT | None, backup_snapshot: SnapshotT | None
) -> SnapshotT | None:
    return backup_snapshot if backup_snapshot is not None else snapshot
