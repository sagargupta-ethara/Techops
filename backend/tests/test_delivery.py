from delivery import build_delivery_dashboard, parse_delivery_rows


def test_delivery_parser_deduplicates_tasks_and_splits_contribution_equally():
    values = [
        [
            "Project Name", "Project Category", "Pod Lead", "Quality Lead", "TPM",
            "Task ID (UUID)", "Task", "Task Type", "Author1", "Author1 Email",
            "Author2", "Author2 Email", "Author3", "Author3 Email", "Delivery Date",
            "Task Feedback", "Feedback Date", "Client Name",
        ],
        [
            "Project A", "Code", "Pod A", "QL A", "TPM A", "uuid-1", "Task one",
            "Production", "John", "john@example.com", "Sarah", "sarah@example.com",
            "Mike", "mike@example.com", "2026-09-10", "Good quality", "2026-09-12", "Acme",
        ],
        [
            "Project A", "Code", "Pod A", "QL A", "TPM A", "uuid-1", "Task one",
            "Production", "John", "john@example.com", "Sarah", "sarah@example.com",
            "Mike", "mike@example.com", "2026-09-10", "Good quality", "2026-09-12", "Acme",
        ],
        [
            "Project B", "Data", "Pod B", "QL B", "TPM B", "uuid-2", "Task two",
            "Samples", "John Other Name", "john@example.com", "", "", "", "",
            "11th Sept 2026", "", "", "Beta",
        ],
    ]

    dashboard = build_delivery_dashboard(parse_delivery_rows(values))

    assert dashboard["kpis"]["total_tasks"] == 2
    assert dashboard["kpis"]["contribution_units"] == 2
    assert dashboard["kpis"]["with_feedback"] == 1
    assert dashboard["kpis"]["without_feedback"] == 1
    john = next(row for row in dashboard["taskers"] if row["email"] == "john@example.com")
    assert john["task_count"] == 2
    assert john["contribution"] == 1.3333
    assert sum(row["contribution"] for row in dashboard["taskers"]) == 2
    missing = next(row for row in dashboard["tasks"] if row["task_id"] == "uuid-2")
    assert missing["client_feedback"] == "NA"
    first = next(row for row in dashboard["tasks"] if row["task_id"] == "uuid-1")
    assert len(first["feedback_history"]) == 1


def test_delivery_filters_recalculate_every_metric():
    values = [
        ["Project Name", "Project Category", "Pod Lead", "Quality Lead", "TPM", "Task ID (UUID)",
         "Task Type", "Author1", "Author1 Email", "Author2", "Author2 Email", "Delivery Date",
         "Overall Client Feedback", "Feedback Status"],
        ["A", "Code", "Lead", "QL", "TPM", "a-1", "Production", "John", "john@example.com",
         "", "", "2026-09-01", "Strong delivery", "Received"],
        ["B", "Data", "Lead", "QL", "TPM", "b-1", "Sample", "Sarah", "sarah@example.com",
         "", "", "2026-09-15", "", "Pending"],
    ]

    tasks = parse_delivery_rows(values)
    dashboard = build_delivery_dashboard(tasks, {"date_from": "2026-09-10", "feedback": "without"})

    assert dashboard["kpis"]["total_tasks"] == 1
    assert dashboard["kpis"]["sample_tasks"] == 1
    assert dashboard["kpis"]["production_tasks"] == 0
    assert dashboard["projects"] == [
        {"project": "B", "total": 1, "task_types": {"Sample": 1}, "production": 0, "sample": 1}
    ]
    assert dashboard["overall_feedback"][0]["feedback"] == "NA"


def test_delivery_keeps_unassigned_task_contribution_without_counting_a_tasker():
    values = [
        ["Project Name", "Task ID (UUID)", "Task Type", "Author1", "Author1 Email", "Delivery Date"],
        ["A", "a-1", "Production", "", "", "2026-09-10"],
    ]

    dashboard = build_delivery_dashboard(parse_delivery_rows(values))

    assert dashboard["kpis"]["total_taskers"] == 0
    assert dashboard["taskers"][0]["tasker"] == "Unassigned"
    assert dashboard["taskers"][0]["contribution"] == 1


def test_delivery_summarizes_unique_tasks_by_tpm_and_pod_lead_project():
    values = [
        ["Project Name", "Pod Lead", "TPM", "Task ID (UUID)", "Task Type", "Author1", "Delivery Date"],
        ["Project A", "Pod One", "TPM One", "a-1", "Production", "John", "2026-09-10"],
        ["Project A", "Pod One", "TPM One", "a-2", "Sample", "Sarah", "2026-09-10"],
        ["Project B", "Pod One", "TPM Two", "b-1", "Production", "John", "2026-09-11"],
    ]

    dashboard = build_delivery_dashboard(parse_delivery_rows(values))

    assert dashboard["tpms"] == [
        {"name": "TPM One", "task_count": 2, "projects": {"Project A": 2}},
        {"name": "TPM Two", "task_count": 1, "projects": {"Project B": 1}},
    ]
    assert dashboard["pod_leads"] == [
        {"name": "Pod One", "task_count": 3, "projects": {"Project A": 2, "Project B": 1}},
    ]
