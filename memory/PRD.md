# Live POD Operations Dashboard — PRD

## Original problem statement
Build a leadership-only operations dashboard that syncs a live Google Sheets "Master" tab
(read-only, via service account), organizes data hierarchically TPM → POD Lead → user,
preserves daily history, and records explainable before/after detected changes across six
multi-tab surfaces (Overview, TPMs, PODs, Users, Audit, Data Health).

## Stack (chosen with user)
- Frontend: React + Tailwind + shadcn/ui + recharts + react-query (dark-first command-center UI)
- Backend: FastAPI + MongoDB (motor)
- Auth: JWT email/password, roles Admin + Viewer
- Sync: background poller every 60s + admin manual "Sync now"; Google Sheets read-only service account

## User personas
- Admin: full data access + manual sync + Data Health global counts/quarantine.
- Viewer: read-only leadership view of all data (no sync).
- Tracked users (people in the sheet): no login — subjects only.

## Core requirements (static)
- Exact 30-column `Master!A:AD` schema; never writes to the sheet.
- Guarded sync: schema/date/duplicate/formula-error validation → quarantine on failure, last-good preserved.
- Daily snapshot revisions per reporting date + append-only field-level detected-change audit.
- Role-scoped, URL-persisted cascading filters; deterministic metrics with visible numerator/denominator.
- WCAG-minded dark/light UI, accessible charts with table equivalents, semantic status badges (icon+text).

## Implemented (2026-06)
- Google Sheets adapter (`sheets_adapter.py`), domain schema/metrics (`domain.py`).
- Sync engine with baseline/no-op/change detection, snapshots, change_events, sync_runs (`server.py`).
- 60s background poller + admin `POST /api/sync`.
- JWT auth (admin + viewer seeded), all dashboard APIs (meta, overview, tpms, pods, users, audit, data-health).
- Full frontend: Login, AppShell (sidebar/bottom-nav, freshness badge, theme toggle, sync-now),
  Overview (KPIs/charts/insights/hierarchy), TPMs + detail, PODs + nested-tab detail,
  Users + profile (Summary/Current/History/Audit), Audit workspace, Data Health.
- Verified: 26/26 backend tests pass; frontend E2E 100% functional (testing agent iteration_1).

## Live data snapshot
Sheet "Live Progression Tracker" → Master tab; reporting date 2026-09-17; ~333 people, 15 PODs, 4 TPMs.

## Backlog / remaining
- P1: Granular TPM/POD-scoped grants (currently Admin + Viewer both see all).
- P2: Multi-day history depth (day-over-day deltas activate once a 2nd reporting date is synced).
- P2: Cmd-K command palette; virtualization for very large user tables.
- P3: Split `server.py` into routers; add poller backoff/jitter; scope CORS origins for production.

## Next tasks
- Await user review; then implement granular role grants and/or Cmd-K search if requested.
