# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy", "python-calamine"]
# ///
# ─── How to run ───
# uv run backend/scripts/build_daily_progress_seed.py SOURCE.xlsx OUTPUT.json

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
from python_calamine import CalamineWorkbook

PROGRESS_DATES = (date(2026, 9, 14), date(2026, 9, 15), date(2026, 9, 16), date(2026, 9, 17))
DAY_COLUMNS = ((5, 6, 7, None), (8, 9, 10, None), (11, 12, 13, None), (14, 15, 16, 17))


def count(value: str | float | int | None) -> tuple[float, bool]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value), True
    text = str(value or "").strip()
    if not text:
        return 0.0, True
    try:
        return float(text), True
    except ValueError:
        return 0.0, False


def build_records(source: Path) -> list[dict[str, str | float | bool]]:
    workbook = CalamineWorkbook.from_path(source)
    records: list[dict[str, str | float | bool]] = []
    for sheet_name in workbook.sheet_names:
        if not sheet_name.startswith("Pod - "):
            continue
        rows = workbook.get_sheet_by_name(sheet_name).to_python()
        pod_lead = sheet_name.removeprefix("Pod - ").strip()
        for row in rows[5:]:
            name = str(row[0] or "").strip() if row else ""
            email = str(row[1] or "").strip().casefold() if len(row) > 1 else ""
            if not name or "@" not in email:
                continue
            for progress_date, columns in zip(PROGRESS_DATES, DAY_COLUMNS, strict=True):
                task_column, assigned_column, created_column, remarks_column = columns
                task_type = str(row[task_column] or "").strip() if len(row) > task_column else ""
                if not task_type:
                    continue
                assigned, assigned_numeric = count(row[assigned_column] if len(row) > assigned_column else None)
                created, _ = count(row[created_column] if len(row) > created_column else None)
                remarks = str(row[remarks_column] or "").strip() if remarks_column is not None and len(row) > remarks_column else ""
                record_date = progress_date.isoformat()
                normalized_type = " ".join(task_type.casefold().split())
                records.append({
                    "record_key": f"{email}|{record_date}|{normalized_type}",
                    "name": name, "email": email, "date": record_date,
                    "task_type": task_type, "assigned": assigned, "created": created,
                    "remarks": remarks, "pod_lead": pod_lead,
                    "source": "historical_xlsx", "assigned_normalized_from_text": not assigned_numeric,
                })
    return records


def main() -> int:
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    records = build_records(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    assigned = float(np.sum([record["assigned"] for record in records]))
    created = float(np.sum([record["created"] for record in records]))
    normalized = sum(bool(record["assigned_normalized_from_text"]) for record in records)
    print(json.dumps({"records": len(records), "assigned": assigned, "created": created, "normalized": normalized}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
