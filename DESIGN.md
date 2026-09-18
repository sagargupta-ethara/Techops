# POD Ops Design System

## 1. Atmosphere and signature

POD Ops is a quiet analytical command center: calm, dense enough for operators, and explicit about what needs attention. Its signature is a narrow graphite navigation rail paired with paper-like analytical surfaces, teal for action and healthy progress, and amber for review. The interface prioritizes conclusions, comparisons, and drill-down paths over decorative dashboards.

## 2. Color palette

Light mode uses a cool mist background (`#f4f7f7`), white elevated surfaces, ink (`#142322`), slate secondary text, and subtle blue-grey rules. Dark mode uses deep graphite (`#0c1515`) with lifted charcoal surfaces. Primary teal is `#0f8f83`. The approved semantic state scales are Tailwind teal-300 (on dark brand surfaces), cyan-500/600 (information), emerald-300/400/500/600 (success), amber-300/400/500/600/700 (risk), rose-400/500/600 (failure), and slate-100/300/400/500 (content on graphite). Opacity variants of those named scales are tokens for state backgrounds and rules. Color never carries state without text or icon support.

## 3. Typography

Manrope is the display face, Inter the reading face, and JetBrains Mono is limited to compact numeric values and identifiers. Page titles use 28–32px/700, section titles 14–16px/700, body 14px/400–500, support text 12–13px, and KPI values 28–36px/700. Uppercase is limited to short eyebrows and table headers; sentence case is the default.

## 4. Layout and spacing

The desktop shell uses a 224px rail and a fluid main column capped at 1480px. Pages follow a 4/8px spacing rhythm: 8px inline gaps, 16px card padding, 20–24px section gaps, and 28px page padding. Analytical cards align to equal row heights without forcing unrelated charts to grow. Tables live in bounded, horizontally scrollable panels; long result sets paginate.

Dashboard filter panels place search on its own full-width row. Filter controls wrap into responsive grids and never require horizontal scrolling; narrower screens add rows instead of hiding options beyond the viewport.

Daily Progress uses the same filter anatomy, with date shortcuts always visible and disjoint date selection disclosed in-place. Upload actions use a focused modal, retain row-level validation feedback, and state whether existing logical records will be skipped or replaced. Data-lineage notes sit beside the workflow reconciliation strip so historical workbook, uploaded CSV, and live Delivery sources remain distinguishable.

POD Analytics stays focused on the latest live data. Historical CSV backups run in the background and are managed outside the POD summary surface, so backup controls do not compete with the operational tables.

## 5. Shared primitives and states

- `PageHeader`: eyebrow, title, explanatory sentence, optional action.
- `KpiStat`: label, high-emphasis value, context, optional icon and semantic tone.
- `TrinityFunnel`: assigned-task baseline with paired staged-after-Forge and completed-after-Crucible cards; each card always shows both the task count and percentage of assigned tasks.
- Manual analytics label input bundles created as `Manual Staged`. Combined overall progress uses `(Manual Staged + Tasks QCed + Trinity Completed) / (Manual Target + Trinity Assigned)`, with only applicable workstream targets contributing to the denominator.
- `.panel`: tonal surface with a restrained rule and shadow; `.panel-header` provides shared anatomy.
- `DistroChart`: fixed analytical viewport, accessible table toggle, shared tooltip and palette.
- `.data-table`: sticky header, centered numeric/count columns, compact row height, clear hover/focus state. Long operational tables use a bounded vertical scroll owner so their column/status headers remain visible while rows scroll.
- `Pagination`: bounded result context plus previous/next actions.
- Empty/loading states occupy only the space needed to explain the state.

Interactive states use a visible 2px teal focus ring. Hover increases contrast only on actionable controls. Selected navigation is indicated by background, text, and a left marker.

## 6. Motion

Motion exists only to clarify state: 160ms color/opacity transitions, 180ms drawer transition, and a restrained page fade. No card lifting or decorative stagger. All motion is disabled under `prefers-reduced-motion`.

## 7. Tonal depth

Depth is created with surface tone, a single low-alpha border, and one soft ambient shadow. Primary cards use white/graphite surfaces; secondary groupings use the muted canvas. Nested borders and repeated outlines are avoided. Charts share one visual baseline and never inherit arbitrary height from adjacent panels.

## 8. Accessibility constraints and accepted debt

Body text and controls target WCAG 2.2 AA contrast; status uses labels in addition to color; touch targets are at least 36px in dense desktop contexts and 44px on mobile; tables have captions and keyboard-visible row links where applicable. Responsive checks cover 375, 768, and 1280px. Accepted debt: dense comparison tables may require horizontal scrolling on small screens, because removing operational columns would reduce analytical value; a visible scroll container and sticky identity column mitigate this.
