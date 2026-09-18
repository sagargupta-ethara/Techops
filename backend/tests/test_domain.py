import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

import domain as D


def test_parse_rows_maps_the_new_trinity_task_columns_without_shifting_manual_data():
    # Given
    headers = [
        "TPM", "Pod Lead", "Name", "Email", "Role", "Project Name", "Internal Name",
        "Intern/FTE", "Date", "Tasking Status", "Assigned Target", "Tracking. MD",
        "ENGRAM Run Count", "ENGRAM phase", "DIRECTIVE.md disposition", "FORGE phase",
        "FORGE Run Count", "EDICT.md disposition", "Number of Task Created (After Forge)",
        "CRUCIBLE Run Count", "CRUCIBLE phase", "VERDICT.md disposition", "Completion Status",
        "Number of Task Approved (After Crucible)", "Crucible Verdict", "Remarks",
        "Input Bundles Created", "No. of Input Bundles Approved", "Trajectory Generated",
        "Number of Task Approved/ QCed",
    ]
    row = [""] * len(headers)
    values = {
        "Email": "tasker@example.com",
        "Date": "09-18-2026",
        "Tasking Status": "Trinity, Manual QC",
        "Assigned Target": "10",
        "Number of Task Created (After Forge)": "7",
        "CRUCIBLE Run Count": "3",
        "Completion Status": "In Progress",
        "Number of Task Approved (After Crucible)": "4",
        "Remarks": "Waiting on review",
        "Input Bundles Created": "6",
        "No. of Input Bundles Approved": "5",
        "Trajectory Generated": "4",
        "Number of Task Approved/ QCed": "3",
    }
    for header, value in values.items():
        row[headers.index(header)] = value

    # When
    parsed = D.parse_rows([[""] * len(headers), headers, row])

    # Then
    assert parsed["header_ok"] is True
    person = parsed["people"][0]
    assert person["tasks_created_after_forge"] == "7"
    assert person["tasks_approved_after_crucible"] == "4"
    assert person["crucible_run_count"] == "3"
    assert person["remarks"] == "Waiting on review"
    assert person["input_bundles_created"] == "6"
    assert person["input_bundles_approved"] == "5"
    assert person["trajectory_generated"] == "4"
    assert person["tasks_qced"] == "3"
