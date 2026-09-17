"""Backend API regression tests for the Live POD Operations Dashboard.

Covers: auth (admin/viewer/invalid), /api/meta, /api/overview (+filters),
/api/tpms, /api/pods, /api/users (+ detail), /api/audit, /api/data-health,
POST /api/sync (admin/viewer), and unauth enforcement.
"""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback: read frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN = {"email": "admin@pod.ops", "password": "PodOps@2026"}
VIEWER = {"email": "viewer@pod.ops", "password": "Viewer@2026"}


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _login(s, creds):
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_token(s):
    return _login(s, ADMIN)["access_token"]


@pytest.fixture(scope="session")
def viewer_token(s):
    return _login(s, VIEWER)["access_token"]


@pytest.fixture
def ah(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def vh(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}


# ---------------- Auth ----------------
class TestAuth:
    def test_admin_login(self, s):
        data = _login(s, ADMIN)
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN["email"]
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20

    def test_viewer_login(self, s):
        data = _login(s, VIEWER)
        assert data["user"]["role"] == "viewer"

    def test_invalid_login(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "x@x.com", "password": "bad"})
        assert r.status_code == 401

    def test_me(self, s, ah):
        r = s.get(f"{BASE_URL}/api/auth/me", headers=ah)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_unauth_required(self, s):
        for path in ["/api/meta", "/api/overview", "/api/tpms", "/api/pods",
                     "/api/users", "/api/audit", "/api/data-health"]:
            r = s.get(f"{BASE_URL}{path}")
            assert r.status_code == 401, f"{path} expected 401 got {r.status_code}"

    def test_health_live_public(self, s):
        r = s.get(f"{BASE_URL}/api/health/live")
        assert r.status_code == 200


# ---------------- Meta ----------------
class TestMeta:
    def test_meta(self, s, ah):
        r = s.get(f"{BASE_URL}/api/meta", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert "dates" in d and isinstance(d["dates"], list)
        assert d["latest_date"] == "2026-09-17"
        opts = d["options"]
        assert len(opts["tpms"]) == 4
        assert len(opts["pods"]) == 15
        assert isinstance(opts["roles"], list) and isinstance(opts["statuses"], list)


# ---------------- Overview ----------------
class TestOverview:
    def test_overview_basic(self, s, ah):
        r = s.get(f"{BASE_URL}/api/overview", headers=ah)
        assert r.status_code == 200
        d = r.json()
        m = d["metrics"]
        assert m["headcount"] == 333
        assert m["target_coverage"]["pct"] is not None
        assert 60 < m["target_coverage"]["pct"] < 75
        # role_mix contains expected labels
        labels = {r["label"] for r in m["role_mix"]}
        assert {"Tasker", "Quality Lead", "Pod Lead"}.issubset(labels)
        assert isinstance(m["status_distribution"], list)
        assert len(d["hierarchy"]["tpms"]) == 4
        assert len(d["hierarchy"]["pods"]) == 15
        # baseline insight present since single date
        assert any(i["kind"] == "baseline" for i in d["insights"])

    def test_overview_filter_attention(self, s, ah):
        r = s.get(f"{BASE_URL}/api/overview?attention=true", headers=ah)
        assert r.status_code == 200
        assert r.json()["metrics"]["headcount"] <= 333

    def test_overview_filter_role(self, s, ah):
        r = s.get(f"{BASE_URL}/api/overview?role=Tasker", headers=ah)
        assert r.status_code == 200
        m = r.json()["metrics"]
        assert m["headcount"] < 333
        for row in m["role_mix"]:
            assert row["label"] == "Tasker"

    def test_overview_filter_search(self, s, ah):
        r = s.get(f"{BASE_URL}/api/overview?search=zzznomatchxyz", headers=ah)
        assert r.status_code == 200
        assert r.json()["metrics"]["headcount"] == 0


# ---------------- TPMs ----------------
class TestTpms:
    def test_list(self, s, ah):
        r = s.get(f"{BASE_URL}/api/tpms", headers=ah)
        assert r.status_code == 200
        rows = r.json()["tpms"]
        assert len(rows) == 4
        total = sum(x["headcount"] for x in rows)
        assert total == 333
        for row in rows:
            assert "pod_count" in row and "trinity" in row and "manual" in row

    def test_detail(self, s, ah):
        rows = s.get(f"{BASE_URL}/api/tpms", headers=ah).json()["tpms"]
        name = rows[0]["name"]
        r = s.get(f"{BASE_URL}/api/tpms/{name}", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == name
        assert isinstance(d["pods"], list) and len(d["pods"]) >= 1

    def test_detail_404(self, s, ah):
        r = s.get(f"{BASE_URL}/api/tpms/__no_such_tpm__", headers=ah)
        assert r.status_code == 404


# ---------------- PODs ----------------
class TestPods:
    def test_list(self, s, ah):
        r = s.get(f"{BASE_URL}/api/pods", headers=ah)
        assert r.status_code == 200
        rows = r.json()["pods"]
        assert len(rows) == 15
        assert sum(x["headcount"] for x in rows) == 333

    def test_detail(self, s, ah):
        rows = s.get(f"{BASE_URL}/api/pods", headers=ah).json()["pods"]
        name = rows[0]["name"]
        r = s.get(f"{BASE_URL}/api/pods/{name}", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == name
        assert isinstance(d["people"], list) and len(d["people"]) >= 1
        assert isinstance(d["changes"], list)  # baseline -> likely empty

    def test_detail_404(self, s, ah):
        r = s.get(f"{BASE_URL}/api/pods/__nope__", headers=ah)
        assert r.status_code == 404


# ---------------- Users ----------------
class TestUsers:
    def test_list_paginated(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?limit=10&offset=0", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 333
        assert len(d["users"]) == 10

    def test_list_filter(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?role=Tasker&limit=1000", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] < 333 and d["total"] > 0

    def test_detail(self, s, ah):
        d = s.get(f"{BASE_URL}/api/users?limit=1", headers=ah).json()
        email = d["users"][0]["email"]
        r = s.get(f"{BASE_URL}/api/users/{email}", headers=ah)
        assert r.status_code == 200
        det = r.json()
        assert det["email"] == email
        assert isinstance(det["history"], list) and len(det["history"]) >= 1
        assert isinstance(det["audit"], list)
        assert det["current"]  # 30 fields dict-ish

    def test_detail_404(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users/nope@nowhere.example", headers=ah)
        assert r.status_code == 404


# ---------------- Audit ----------------
class TestAudit:
    def test_audit(self, s, ah):
        r = s.get(f"{BASE_URL}/api/audit", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert "summary" in d and "events" in d
        for k in ("added", "removed", "semantic", "raw_only"):
            assert k in d["summary"]

    def test_audit_filter(self, s, ah):
        r = s.get(f"{BASE_URL}/api/audit?classification=semantic&group=identity", headers=ah)
        assert r.status_code == 200


# ---------------- Data health ----------------
class TestDataHealth:
    def test_health(self, s, ah):
        r = s.get(f"{BASE_URL}/api/data-health", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert d["state"] in ("fresh", "stale", "sync_failed", "unavailable")
        assert d["person_count"] == 333
        assert d["pod_count"] == 15
        assert d["interval_seconds"] == 60
        assert isinstance(d["recent_runs"], list)


# ---------------- Sync ----------------
class TestSync:
    def test_admin_can_sync(self, s, ah):
        r = s.post(f"{BASE_URL}/api/sync", headers=ah, timeout=60)
        assert r.status_code == 200
        assert r.json().get("status") in ("success", "noop", "skipped")

    def test_viewer_forbidden(self, s, vh):
        r = s.post(f"{BASE_URL}/api/sync", headers=vh)
        assert r.status_code == 403


# ---------------- Iteration 2: completion / workstream / insights ----------------
class TestCompletion:
    """Overview: metrics.completion + metrics.no_remark + metrics.workstream_mix."""

    def test_overview_completion_shape(self, s, ah):
        d = s.get(f"{BASE_URL}/api/overview", headers=ah).json()
        m = d["metrics"]
        assert "completion" in m and set(m["completion"].keys()) >= {"complete", "incomplete", "absent"}
        c = m["completion"]
        assert isinstance(c["complete"], int)
        assert isinstance(c["incomplete"], int)
        assert isinstance(c["absent"], int)
        # Baseline expectations per review request (allow small drift +/- a few from live poller)
        assert c["complete"] + c["incomplete"] + c["absent"] == m["headcount"]
        assert c["absent"] >= 10 and c["absent"] <= 25  # ~17
        assert c["complete"] >= 0 and c["complete"] <= 15  # ~1
        assert c["incomplete"] >= 290 and c["incomplete"] <= 330  # ~315
        assert isinstance(m["no_remark"], int) and m["no_remark"] >= 0
        assert isinstance(m["workstream_mix"], list) and len(m["workstream_mix"]) >= 1
        for row in m["workstream_mix"]:
            assert "label" in row and "count" in row

    def test_users_completeness_incomplete(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?completeness=incomplete&limit=1000", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert 290 <= d["total"] <= 330
        for u in d["users"][:20]:
            assert u["completion_state"] == "incomplete"
            assert "workstream_label" in u
            assert "insight" in u.get("progress", {})

    def test_users_completeness_absent(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?completeness=absent&limit=1000", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert 10 <= d["total"] <= 25
        for u in d["users"]:
            assert u["completion_state"] == "absent"
            # All absent people should be on Leave
            tokens = [t.lower() for t in u.get("status_tokens", [])]
            assert "leave" in tokens

    def test_users_completeness_complete(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?completeness=complete&limit=1000", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 0
        for u in d["users"]:
            assert u["completion_state"] == "complete"
            assert u.get("progress", {}).get("completion") == 100


class TestPodInsights:
    def test_pod_detail_insights(self, s, ah):
        pods = s.get(f"{BASE_URL}/api/pods", headers=ah).json()["pods"]
        name = pods[0]["name"]
        r = s.get(f"{BASE_URL}/api/pods/{name}", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("overview_insight"), str) and len(d["overview_insight"]) > 10
        mi = d.get("member_insights")
        assert isinstance(mi, list) and len(mi) == d["metrics"]["headcount"]
        first = mi[0]
        for k in ("name", "status", "workstream", "completion_state", "insight", "flags"):
            assert k in first, f"member_insights missing {k}"
        assert "last_updated" in first  # may be None on baseline
        assert d["metrics"]["completion"]["complete"] + d["metrics"]["completion"]["incomplete"] + d["metrics"]["completion"]["absent"] == d["metrics"]["headcount"]
        assert isinstance(d["metrics"]["workstream_mix"], list)
        # people[].progress.insight present
        assert d["people"][0]["progress"]["insight"]

    def test_pod_detail_404(self, s, ah):
        r = s.get(f"{BASE_URL}/api/pods/__no_such__", headers=ah)
        assert r.status_code == 404


class TestTpmInsights:
    def test_tpm_detail_insight(self, s, ah):
        tpms = s.get(f"{BASE_URL}/api/tpms", headers=ah).json()["tpms"]
        name = tpms[0]["name"]
        r = s.get(f"{BASE_URL}/api/tpms/{name}", headers=ah)
        d = r.json()
        assert isinstance(d.get("overview_insight"), str) and len(d["overview_insight"]) > 10
        assert isinstance(d["pods"], list) and len(d["pods"]) >= 1
        for pod in d["pods"]:
            assert isinstance(pod.get("insight"), str) and len(pod["insight"]) > 5


class TestFlagsAndAbsent:
    def test_leave_person_absent(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?status=Leave&limit=1000", headers=ah)
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) > 0
        # All 'Leave' people who have ONLY leave should be absent
        # (some may have other statuses combined; but pure leave => absent)
        pure_leave_absent = [u for u in users
                             if [t.lower() for t in u.get("status_tokens", [])] == ["leave"]]
        assert all(u["completion_state"] == "absent" for u in pure_leave_absent)

    def test_harness_no_remark_flag(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?status=Harness&limit=1000", headers=ah)
        assert r.status_code == 200
        users = r.json()["users"]
        # At least one harness person exists in the baseline; if empty remark, flag "no remark"
        for u in users:
            remark = (u.get("remarks") or "").strip() or (u.get("remark") or "").strip()
            flags = u.get("progress", {}).get("flags", [])
            if not remark:
                assert "no remark" in flags, f"Expected 'no remark' flag for {u.get('email')}"

# ---------------- Iteration 3: TPM counts + blocker analysis ----------------
class TestTpmCounts:
    """/api/tpms should return integer workstream counts, not coverage bars."""

    def test_tpms_list_has_counts(self, s, ah):
        r = s.get(f"{BASE_URL}/api/tpms", headers=ah)
        assert r.status_code == 200
        rows = r.json()["tpms"]
        assert len(rows) == 4
        required = {"headcount", "pod_count", "project_count",
                    "trinity", "manual", "harness", "manual_qc", "absent", "attention"}
        for row in rows:
            assert required.issubset(row.keys()), f"missing keys: {required - set(row.keys())}"
            for k in ("trinity", "manual", "harness", "manual_qc", "absent",
                      "headcount", "pod_count", "project_count", "attention"):
                assert isinstance(row[k], int), f"{row['name']}.{k} not int: {row[k]!r}"
            # counts should sum to at most headcount (bucketed)
            assert row["trinity"] + row["manual"] + row["harness"] + row["manual_qc"] + row["absent"] <= row["headcount"]
        # Prafful Gupta example from review request
        names = {r["name"]: r for r in rows}
        if "Prafful Gupta" in names:
            assert names["Prafful Gupta"]["headcount"] == 106

    def test_tpm_detail_has_counts(self, s, ah):
        rows = s.get(f"{BASE_URL}/api/tpms", headers=ah).json()["tpms"]
        name = rows[0]["name"]
        r = s.get(f"{BASE_URL}/api/tpms/{name}", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert "counts" in d
        c = d["counts"]
        for k in ("trinity", "manual", "harness", "manual_qc", "on_leave"):
            assert k in c and isinstance(c[k], int)
        assert isinstance(d.get("overview_insight"), str) and len(d["overview_insight"]) > 5
        for pod in d["pods"]:
            for k in ("headcount", "attention"):
                assert k in pod
            assert "insight" in pod


class TestPodCounts:
    def test_pod_detail_has_counts_and_null_blocker(self, s, ah):
        pods = s.get(f"{BASE_URL}/api/pods", headers=ah).json()["pods"]
        # pick a pod likely to not have cached analysis; but blocker_analysis key must be present
        name = pods[-1]["name"]
        r = s.get(f"{BASE_URL}/api/pods/{name}", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert "counts" in d
        c = d["counts"]
        for k in ("trinity", "manual", "harness", "manual_qc", "on_leave"):
            assert k in c
        assert "blocker_analysis" in d  # may be None


class TestBlockerAnalysis:
    def test_analyze_404_for_missing_pod(self, s, ah):
        r = s.post(f"{BASE_URL}/api/pods/__no_such_pod__/analyze", headers=ah)
        assert r.status_code == 404

    def test_analyze_requires_auth(self, s):
        r = s.post(f"{BASE_URL}/api/pods/Vidit%20Sharma/analyze")
        assert r.status_code == 401

    def test_analyze_vidit_sharma_and_cache(self, s, ah):
        pod = "Vidit Sharma"
        # Ensure pod exists
        pre = s.get(f"{BASE_URL}/api/pods/{pod}", headers=ah)
        if pre.status_code == 404:
            pytest.skip(f"POD {pod} not present in current snapshot")
        r = s.post(f"{BASE_URL}/api/pods/{pod.replace(' ', '%20')}/analyze",
                   headers=ah, timeout=60)
        assert r.status_code == 200, r.text
        doc = r.json()
        for k in ("pod", "reporting_date", "revision", "generated_at", "generated_by", "result"):
            assert k in doc, f"missing key {k}"
        assert doc["pod"] == pod
        res = doc["result"]
        assert isinstance(res.get("headline"), str) and len(res["headline"]) > 5
        assert isinstance(res.get("blockers"), list) and len(res["blockers"]) >= 1
        for b in res["blockers"]:
            assert "issue" in b
        assert res.get("model") == "claude-haiku-4-5"

        # Cached in subsequent GET
        got = s.get(f"{BASE_URL}/api/pods/{pod.replace(' ', '%20')}", headers=ah).json()
        assert got.get("blocker_analysis") is not None
        assert got["blocker_analysis"]["result"]["headline"] == res["headline"]


# ---------------- Iteration 4: phase_summary, AI cache, attention rule ----------------
class TestPhaseSummary:
    def test_aniket_soni_phase_summary(self, s, ah):
        r = s.get(f"{BASE_URL}/api/pods/Aniket%20Soni", headers=ah)
        assert r.status_code == 200, r.text
        d = r.json()
        ps = d.get("phase_summary")
        assert ps and "trinity" in ps and "manual" in ps
        t = ps["trinity"]
        assert "runs_summary" in t and set(t["runs_summary"].keys()) == {"engram", "forge", "crucible"}
        assert isinstance(t["rows"], list) and len(t["rows"]) == 3
        keys = [row["key"] for row in t["rows"]]
        assert keys == ["engram", "forge", "crucible"]
        for row in t["rows"]:
            assert set(row.keys()) >= {"area", "key", "total", "run_count", "buckets"}
            assert set(row["buckets"].keys()) == {"block", "run", "ship", "hold", "stale", "idle"}
        tr = t["total_row"]
        assert tr["key"] == "total"
        assert tr["total"] == sum(row["total"] for row in t["rows"])
        # Engram total > 0 and includes some non-zero buckets (block/run/stale)
        engram = t["rows"][0]
        assert engram["total"] > 0, f"Engram total should be >0 for Aniket Soni: {engram}"
        nonzero = sum(1 for v in engram["buckets"].values() if v > 0)
        assert nonzero >= 1
        # Manual pipeline shape
        m = ps["manual"]
        for k in ("people", "assigned", "bundles_created", "bundles_approved", "trajectory", "qced"):
            assert k in m and isinstance(m[k], int)


class TestBlockerCache:
    def test_cached_analysis_returned_without_regeneration(self, s, ah):
        pod = "Ram Lalit Chaudhary"
        pre = s.get(f"{BASE_URL}/api/pods/{pod.replace(' ', '%20')}", headers=ah)
        if pre.status_code == 404:
            pytest.skip(f"POD {pod} not in snapshot")
        d = pre.json()
        ba = d.get("blocker_analysis")
        if not ba:
            pytest.skip(f"No cached analysis for {pod}; skip cache-check")
        first_gen = ba["generated_at"]
        # Fetch again — generated_at must remain identical (no auto regenerate on load)
        d2 = s.get(f"{BASE_URL}/api/pods/{pod.replace(' ', '%20')}", headers=ah).json()
        assert d2["blocker_analysis"] is not None
        assert d2["blocker_analysis"]["generated_at"] == first_gen


class TestAttentionRule:
    def test_overview_attention_count(self, s, ah):
        d = s.get(f"{BASE_URL}/api/overview", headers=ah).json()
        att = d["metrics"]["attention"]
        # New rule expects ~32; old was ~47. Allow a small range.
        assert 20 <= att <= 40, f"attention={att} outside expected new-rule window (~32)"

    def test_users_attention_filter_and_non_attention(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?attention=true&limit=1000", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] > 0
        for u in d["users"]:
            assert u["is_attention"] is True
            # Not on leave
            assert u["completion_state"] != "absent"
            tokens = [t.lower() for t in u.get("status_tokens", [])]
            assert "leave" not in tokens
            # No Trinity/Manual data at all
            assert u.get("has_trinity") is False
            assert u.get("has_manual") is False

    def test_person_with_trinity_or_manual_not_attention(self, s, ah):
        # Sample a non-attention user via completeness=complete or a Trinity worker
        r = s.get(f"{BASE_URL}/api/users?status=Trinity&limit=50", headers=ah)
        assert r.status_code == 200
        found = False
        for u in r.json()["users"]:
            if u.get("has_trinity") or u.get("has_manual"):
                assert u["is_attention"] is False
                found = True
                break
        assert found, "no Trinity user found to verify non-attention"

    def test_leave_person_not_attention(self, s, ah):
        r = s.get(f"{BASE_URL}/api/users?completeness=absent&limit=50", headers=ah)
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) > 0
        for u in users:
            assert u["is_attention"] is False
            assert u["completion_state"] == "absent"


class TestSummaryRegression:
    def test_summary_shape(self, s, ah):
        r = s.get(f"{BASE_URL}/api/summary", headers=ah)
        assert r.status_code == 200
        d = r.json()
        assert "kpis" in d and "pods" in d
        assert isinstance(d["pods"], list) and len(d["pods"]) >= 1
        assert d["kpis"]["members"] == 333

