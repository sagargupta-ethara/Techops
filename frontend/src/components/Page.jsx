export function PageContainer({ children }) {
  return <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>;
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
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
