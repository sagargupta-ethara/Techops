export default function KpiStat({ label, value, sub, accent = false, testid, icon: Icon }) {
  return (
    <div
      data-testid={testid}
      className="rounded-md border border-border bg-card p-4 sm:p-5 transition-colors duration-150 hover:bg-accent/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />}
      </div>
      <div className={`mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
