from datetime import datetime
from io import StringIO
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

import domain as D
from server import IST, backup_doc_to_snapshot, latest_due_backup_date, reporting_date_options
from history_sources import prefer_backup_snapshot


def test_latest_due_backup_date_uses_previous_day_after_four_am_ist():
    # Given
    now = datetime(2026, 9, 19, 4, 0, tzinfo=IST)

    # When / Then
    assert latest_due_backup_date(now) == "2026-09-18"


def test_latest_due_backup_date_uses_previous_completed_window_before_four_am_ist():
    # Given
    now = datetime(2026, 9, 19, 3, 59, tzinfo=IST)

    # When / Then
    assert latest_due_backup_date(now) == "2026-09-17"


def test_backup_csv_can_power_a_historical_snapshot():
    # Given
    values = [[""] * len(D.COLUMNS), D.HEADER_LABELS]
    row = [""] * len(D.COLUMNS)
    row[D.FIELD_KEYS.index("pod_lead")] = "Historical Lead"
    row[D.FIELD_KEYS.index("name")] = "Historical Tasker"
    row[D.FIELD_KEYS.index("email")] = "historical@example.com"
    row[D.FIELD_KEYS.index("role")] = "Tasker"
    row[D.FIELD_KEYS.index("date")] = "09-18-2026"
    row[D.FIELD_KEYS.index("tasking_status")] = "Trinity"
    values.append(row)
    stream = StringIO()
    csv.writer(stream).writerows(values)

    # When
    snapshot = backup_doc_to_snapshot({
        "backup_date": "2026-09-18",
        "csv": stream.getvalue(),
        "trigger": "manual",
        "created_at": "2026-09-18T08:30:50+00:00",
    })

    # Then
    assert snapshot["reporting_date"] == "2026-09-18"
    assert snapshot["source"] == "backup"
    assert snapshot["backup_trigger"] == "manual"
    assert snapshot["backup_created_at"] == "2026-09-18T08:30:50+00:00"
    assert snapshot["people"][0]["pod"] == "Historical Lead"


def test_reporting_date_options_merge_snapshots_and_backups():
    # Given / When
    options = reporting_date_options(["2026-09-18", "2026-09-17"], ["2026-09-18", "2026-09-16"])

    # Then
    assert options == [
        {"date": "2026-09-18", "source": "snapshot+backup"},
        {"date": "2026-09-17", "source": "snapshot"},
        {"date": "2026-09-16", "source": "backup"},
    ]


def test_historical_date_prefers_csv_backup_over_mutable_snapshot():
    # Given
    snapshot = {"reporting_date": "2026-09-18", "source": "snapshot"}
    backup = {"reporting_date": "2026-09-18", "source": "backup"}

    # When / Then
    assert prefer_backup_snapshot(snapshot, backup) is backup
