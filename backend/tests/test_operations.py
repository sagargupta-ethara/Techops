import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

import operations
from operations import build_operations_snapshot
from server import _ws_counts, compute_metrics, compute_phase_summary


def person(name, status, *, role="Tasker", assigned="", **fields):
    return {
        "name": name,
        "email": f"{name.lower().replace(' ', '.')}@example.com",
        "role": role,
        "tasking_status": status,
        "assigned_target": assigned,
        **fields,
    }


def test_build_operations_snapshot_counts_overlapping_workstreams():
    # Given
    people = [
        person("Dual Tasker", "Trinity, Manual Dataset Creation", assigned="4"),
        person("Harness Tasker", "Harness, Manual QC", assigned="3"),
        person("Absent Tasker", "Leave"),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert snapshot["counts"] == {"trinity": 1, "manual": 2, "harness": 1}


def test_build_operations_snapshot_excludes_project_leads_from_operational_counts():
    # Given
    people = [
        person("Trinity Lead", "Project Lead, Trinity", role="Pod Lead"),
        person("Manual Lead", "Project Lead, Manual QC", role="Pod Lead", assigned="5"),
        person("Harness Lead", "Project Lead, Harness", role="Pod Lead"),
        person("Tasker", "Trinity, Manual QC, Harness", assigned="5"),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert snapshot["counts"] == {"trinity": 1, "manual": 1, "harness": 1}
    assert snapshot["in_progress"] == {"trinity": 1, "manual": 1}


def test_build_operations_snapshot_flags_leave_rows_with_task_data():
    # Given
    people = [
        person("Clean Leave", "Leave"),
        person("Assigned Leave", "Leave", assigned="5"),
        person("Active Leave", "Leave", tasks_qced="2"),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert [row["name"] for row in snapshot["flags"]["leave"]] == ["Active Leave", "Assigned Leave"]


def test_build_operations_snapshot_flags_missing_targets_except_project_leads():
    # Given
    people = [
        person("Trinity Missing", "Trinity"),
        person("Manual Missing", "Manual Dataset Creation"),
        person("Lead", "Trinity, Manual QC, Project Lead", role="Project Lead"),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert [row["name"] for row in snapshot["flags"]["trinity"]] == ["Trinity Missing"]
    assert [row["name"] for row in snapshot["flags"]["manual"]] == ["Manual Missing"]


def test_build_operations_snapshot_exposes_owner_and_evidence_for_missing_target():
    # Given
    people = [
        person(
            "Manual Evidence",
            "Manual Dataset Creation",
            assigned="0",
            pod="Pod Lead A",
            tpm="TPM A",
            remark="Waiting for approval",
            input_bundles_created="3",
        ),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert snapshot["flags"]["manual"] == [
        {
            "name": "Manual Evidence",
            "email": "manual.evidence@example.com",
            "pod": "Pod Lead A",
            "tpm": "TPM A",
            "role": "Tasker",
            "status": "Manual Dataset Creation",
            "assigned_target": "0",
            "tasks_created_after_forge": "",
            "tasks_approved_after_crucible": "",
            "input_bundles_created": "3",
            "input_bundles_approved": "",
            "trajectory_generated": "",
            "tasks_qced": "",
            "remarks": "Waiting for approval",
            "reason": "Progress or remark exists without an assigned target",
        },
    ]


def test_workstream_counts_uses_zero_for_overall_progress_without_targets():
    # Given / When
    counts = _ws_counts([])

    # Then
    assert counts["overall_pct"] == 0


def test_workstream_counts_uses_trinity_task_counts_and_percentages():
    # Given
    people = [
        person("Completed", "Trinity", assigned="5", tasks_created_after_forge="5", tasks_approved_after_crucible="5"),
        person("Active", "Trinity", assigned="3", tasks_created_after_forge="2", tasks_approved_after_crucible="1"),
        person("Leave", "Leave, Trinity", assigned="10", tasks_created_after_forge="10", tasks_approved_after_crucible="10"),
        person("Lead", "Project Lead, Trinity", role="Pod Lead", assigned="4", tasks_created_after_forge="4", tasks_approved_after_crucible="4"),
    ]

    # When
    counts = _ws_counts(people)

    # Then
    assert counts["trinity_target"] == 8
    assert counts["trinity_staged"] == 7
    assert counts["trinity_staged_pct"] == 87.5
    assert counts["trinity_completed"] == 6
    assert counts["trinity_completed_pct"] == 75.0


def test_workstream_counts_exposes_distinct_manual_phase_outputs():
    # Given
    people = [
        person(
            "Bundle Tasker",
            "Manual Dataset Creation",
            input_bundles_created="4",
            tasks_qced="1",
        ),
        person("QC Tasker", "Manual QC", input_bundles_created="2", tasks_qced="3"),
        person("Trinity Only", "Trinity", input_bundles_created="50", tasks_qced="50"),
        person(
            "Manual Lead",
            "Project Lead, Manual QC",
            role="Pod Lead",
            input_bundles_created="10",
            tasks_qced="10",
        ),
    ]

    # When
    counts = _ws_counts(people)

    # Then
    assert counts["bundles_created"] == 6
    assert counts["manual_staged"] == 6
    assert counts["tasks_qced"] == 4
    assert "manual_completed" not in counts


def test_workstream_counts_includes_manual_staged_and_qced_in_manual_progress():
    people = [
        person(
            "Manual Tasker",
            "Manual Dataset Creation",
            assigned="10",
            input_bundles_created="4",
            tasks_qced="2",
        ),
    ]

    counts = _ws_counts(people)

    assert counts["overall_pct"] == 60.0


def test_workstream_counts_adds_trinity_completed_to_combined_progress():
    people = [
        person("Trinity Tasker", "Trinity", assigned="10", tasks_approved_after_crucible="5"),
        person(
            "Manual Tasker",
            "Manual Dataset Creation",
            assigned="5",
            input_bundles_created="3",
            tasks_qced="1",
        ),
    ]

    counts = _ws_counts(people)

    assert counts["overall_pct"] == 60.0


def test_operational_rollups_exclude_project_leads_but_keep_them_in_headcount():
    # Given
    lead = person(
        "Lead",
        "Project Lead, Trinity, Manual QC",
        role="Pod Lead",
        assigned="5",
        has_trinity=True,
        has_manual=True,
        completion_state="incomplete",
        workstream_label="Trinity",
        progress={"workstreams": ["trinity"]},
        engram_phase="G",
        tasks_qced="2",
    )
    tasker = person(
        "Tasker",
        "Trinity, Manual QC",
        assigned="5",
        has_trinity=True,
        has_manual=True,
        completion_state="incomplete",
        workstream_label="Trinity",
        progress={"workstreams": ["trinity"]},
        engram_phase="G",
        tasks_qced="2",
    )
    leave_tasker = person(
        "Leave Tasker",
        "Leave, Trinity",
        assigned="8",
        engram_phase="G",
        engram_run_count="8",
        tasks_created_after_forge="8",
        tasks_approved_after_crucible="8",
    )

    # When
    counts = _ws_counts([lead, tasker])
    metrics = compute_metrics([lead, tasker])
    phases = compute_phase_summary([lead, tasker, leave_tasker])

    # Then
    assert counts["trinity"] == 1
    assert counts["trinity_target"] == 5
    assert metrics["headcount"] == 2
    assert metrics["trinity_coverage"] == {"num": 1, "den": 1, "pct": 100.0}
    assert metrics["completion"]["incomplete"] == 1
    assert metrics["workstream_mix"] == [{"label": "Trinity", "count": 1}]
    assert phases["trinity"]["people"] == 1
    assert phases["trinity"]["runs_summary"]["engram"] == 1


def test_pod_summary_counts_match_overview_for_overlapping_workstreams():
    # Given
    people = [
        person(
            "Dual Tasker",
            "Trinity, Manual Dataset Creation",
            assigned="4",
            progress={"workstreams": ["trinity", "manual_dataset"]},
        ),
        person(
            "Harness Tasker",
            "Harness, Manual QC",
            assigned="3",
            progress={"workstreams": ["harness", "manual_qc"]},
        ),
        person("Absent Tasker", "Leave", progress={"workstreams": ["leave"]}),
    ]

    # When
    overview = build_operations_snapshot(people)
    summary = _ws_counts(people)

    # Then
    assert {key: summary[key] for key in ("trinity", "manual", "harness")} == overview["counts"]
    assert summary["manual_qc"] == 1
    assert summary["on_leave"] == 1


def test_build_operations_snapshot_sums_manual_pipeline_for_manual_people_only():
    # Given
    people = [
        person("Manual One", "Manual Dataset Creation", assigned="5", input_bundles_created="4", input_bundles_approved="3"),
        person("Manual Two", "Manual QC", assigned="2", trajectory_generated="2", tasks_qced="1"),
        person("Manual Leave", "Leave, Manual QC", assigned="9", input_bundles_created="9", tasks_qced="9"),
        person("Trinity Only", "Trinity", assigned="100", tasks_qced="50"),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert snapshot["manual"] == {
        "people": 2,
        "assigned": 7,
        "bundles_created": 4,
        "bundles_approved": 3,
        "trajectory": 2,
        "qced": 1,
    }


def test_phase_summary_sums_manual_pipeline_for_manual_people_only():
    # Given
    people = [
        person("Manual", "Manual Dataset Creation", assigned="5", input_bundles_created="4", tasks_qced="1"),
        person("Manual Leave", "Leave, Manual QC", assigned="9", input_bundles_created="9", tasks_qced="9"),
        person("Trinity", "Trinity", assigned="10", input_bundles_created="20", tasks_qced="20"),
    ]

    # When
    manual = compute_phase_summary(people)["manual"]

    # Then
    assert manual["assigned"] == 5
    assert manual["bundles_created"] == 4
    assert manual["qced"] == 1


def test_build_operations_snapshot_sums_trinity_pipeline_for_trinity_people_only():
    # Given
    people = [
        person(
            "Trinity One",
            "Trinity",
            assigned="5",
            engram_run_count="4",
            forge_run_count="3",
            crucible_run_count="2",
            tasks_created_after_forge="4",
            tasks_approved_after_crucible="3",
        ),
        person(
            "Trinity Two",
            "Trinity, Manual QC",
            assigned="2",
            engram_run_count="2",
            forge_run_count="1",
            tasks_created_after_forge="2",
            tasks_approved_after_crucible="1",
        ),
        person("Manual Only", "Manual Dataset Creation", assigned="20", engram_run_count="20"),
        person("Lead", "Project Lead, Trinity", role="Pod Lead", assigned="10", engram_run_count="10"),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert snapshot["trinity"] == {
        "people": 2,
        "assigned": 7,
        "staged": 6,
        "staged_pct": 85.7,
        "completed": 4,
        "completed_pct": 57.1,
    }


def test_build_operations_snapshot_splits_in_progress_by_workstream():
    # Given
    people = [
        person("Dual In Progress", "Trinity, Manual QC", assigned="5", tasks_qced="2"),
        person("Trinity Complete", "Trinity", assigned="3", tasks_approved_after_crucible="3"),
        person("Manual Complete", "Manual Dataset Creation", assigned="2", tasks_qced="2"),
        person("Leave Dual", "Leave, Trinity, Manual QC", assigned="4"),
        person("Lead", "Trinity, Manual QC, Project Lead", role="Project Lead"),
    ]

    # When
    snapshot = build_operations_snapshot(people)

    # Then
    assert snapshot["in_progress"] == {"trinity": 1, "manual": 1}


@pytest.mark.parametrize(
    ("operation", "member", "expected"),
    [
        ("trinity", person("Trinity Leave", "Leave, Trinity", assigned="3", tasks_approved_after_crucible="3"), True),
        ("manual", person("Trajectory Tasker", "Trajectory Generation"), True),
        ("harness", person("Kit Tasker", "Generation Kit"), True),
        ("trinity_in_progress", person("Trinity Active", "Trinity", assigned="3"), True),
        ("trinity_in_progress", person("Trinity Staged", "Trinity", assigned="3", tasks_created_after_forge="3", tasks_approved_after_crucible="2"), True),
        ("trinity_in_progress", person("Trinity Done", "Trinity", assigned="3", tasks_approved_after_crucible="3"), False),
        ("manual_in_progress", person("Manual Active", "Manual QC", assigned="3", tasks_qced="1"), True),
        ("manual_in_progress", person("Manual Done", "Manual QC", assigned="3", tasks_qced="3"), False),
        ("manual_in_progress", person("Manual Leave", "Leave, Manual QC", assigned="3"), False),
    ],
)
def test_matches_operation_uses_the_same_rules_as_overview_counts(operation, member, expected):
    # Given / When / Then
    assert operations.matches_operation(member, operation) is expected
