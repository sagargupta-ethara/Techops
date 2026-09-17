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
            assert "pod_count" in row and "coverage" in row or "target_coverage" in row

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
