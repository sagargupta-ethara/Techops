export default function KpiStat({ label, value, sub, accent = false, testid, icon: Icon }) {
  return (
    <div
      data-testid={testid}
      className="card-lift group relative overflow-hidden rounded-xl border border-border bg-card p-5"
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 ${accent ? "bg-primary" : "bg-border"} transition-colors group-hover:bg-primary`}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className={`mt-3 font-mono text-3xl font-bold tabular tracking-tight ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
