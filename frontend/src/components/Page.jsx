export function PageContainer({ children }) {
  return <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-7 lg:py-7">{children}</div>;
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          <span className="h-px w-6 bg-primary" /> Operations intelligence
        </div>
        <h1 className="font-heading text-[28px] font-bold leading-tight tracking-[-0.025em] sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function CoverageBar({ value, testid }) {
  const v = value == null ? 0 : value;
  const color = v >= 80 ? "bg-emerald-500" : v >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2" data-testid={testid}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {value == null ? "N/A" : `${v}%`}
      </span>
    </div>
  );
}

const COMPLETION_MAP = {
  complete: { label: "100% Complete", cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  incomplete: { label: "In progress", cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30" },
  absent: { label: "Absent", cls: "text-slate-500 bg-slate-500/10 border-slate-500/30" },
};

export function CompletionBadge({ state, testid }) {
  const cfg = COMPLETION_MAP[state] || COMPLETION_MAP.incomplete;
  return (
    <span data-testid={testid}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
