import { Link } from "react-router-dom";

export default function KpiStat({ label, value, sub, accent = false, testid, icon: Icon, to }) {
  const compactValue = String(value ?? "").length >= 10;
  const Component = to ? Link : "div";
  return (
    <Component
      {...(to ? { to, "aria-label": `View people for ${label}` } : {})}
      data-testid={testid}
      className={`card-lift group relative min-h-[132px] overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5 ${to ? "cursor-pointer hover:bg-primary/[.025]" : ""}`}
    >
      <span
        className={`absolute bottom-0 left-0 top-0 w-1 ${accent ? "bg-primary" : "bg-border"}`}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className={`mt-3 whitespace-nowrap font-heading font-bold tabular leading-none tracking-[-0.035em] ${compactValue ? "text-xl sm:text-2xl" : "text-[32px]"} ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Component>
  );
}
