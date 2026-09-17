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
- Status-driven workstream + completion engine (`domain.derive_progress`): per-person workstream
  (Trinity / Manual Dataset / Trajectory / Manual QC / Harness / Generation Kit / Project Lead / Leave),
  completion = 100 or NA, Leave = Absent, "no remark" flag for harness/gen-kit with empty remarks.
  Empty cells render "No data" in the UI.
- Per-member and per-POD insight banners with last-updated + current status; TPM overall insight.
- Pod-wise Summary view (`/api/summary`): org KPI strip (Pods/Members/Trinity/Manual/Harness/Manual QC/
  On Leave/Trinity Shipped/Manual Completed/Overall %) + per-POD table with Internal Project, Project
  Category, workstream counts, Trinity/Manual targets & completion, Overall Progress % — mirrors the
  sheet's Dashboard tab. Primary-bucket classification (Trinity > Manual > Harness > Manual QC > Leave).
- Single-row global filter bar; Completeness filter = complete/incomplete/absent.
- Full frontend: Login, AppShell, Overview (KPIs + MiniStats + workstream chart), TPMs + detail,
  PODs (Pod-wise Summary) + nested-tab detail (with Member Summary), Users + profile, Audit, Data Health.
- Verified: backend 35/35 tests pass; frontend E2E functional (testing agent iterations 1 & 2).

## Live data snapshot
Sheet "Live Progression Tracker" → Master tab; reporting date 2026-09-17; ~333 people, 15 PODs, 4 TPMs.

## Backlog / remaining
- P1: Granular TPM/POD-scoped grants (currently Admin + Viewer both see all).
- P2: Multi-day history depth (day-over-day deltas activate once a 2nd reporting date is synced).
- P2: Cmd-K command palette; virtualization for very large user tables.
- P3: Split `server.py` into routers; add poller backoff/jitter; scope CORS origins for production.

## Next tasks
- Await user review; then implement granular role grants and/or Cmd-K search if requested.

## Iteration 5 (2026-06) — UI overhaul + fixes + backups
- Fixed page-level horizontal overflow (wide tables now scroll inside their container; html/body overflow-x hidden; min-w-0 flex column) and top-bar alignment (64px, aligned to sidebar).
- Fixed Back navigation (detail pages use history back; browser Back verified).
- Renamed nav: TPM Analytics / POD Analytics / User Directory / Audit Trail / Data Health.
- Quick-login buttons (Admin/Viewer) on login screen for post-deploy access.
- Motion system: page-enter, staggered reveals, card-lift hovers, reduced-motion parity.
- Daily CSV backup: captures full sheet as CSV at 04:00 IST, stacked day-wise in db.csv_backups;
  GET /api/backups, GET /api/backups/{date}/download?token=, POST /api/backups/run (admin);
  Data Health backups panel with per-day CSV download.
- Verified: 53/53 backend tests pass; frontend E2E clean at 1920x800 and 390x844 (testing agent iteration 5).

## Iteration 7 (2026-09) — KPI label clarity
- Renamed Overview KPI card "Target Coverage" → "Targets Assigned" (sub: "207/333 people have a task target").
  Metric = % of members with a value in the sheet's Assigned Target column. Verified via screenshot.

## Next tasks
- P1: Org-wide Blocker Digest (AI analysis across all PODs on Overview).
- P1: Export Pod-wise Summary + blocker findings as CSV (admin).
- P2: Status drill-down remarks; blocker/phase trends; clickable donut legends; density toggle/theming.
