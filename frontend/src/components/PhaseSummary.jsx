import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

const STATUS_LABELS = { block: "Block", run: "Run", ship: "Ship", hold: "Hold", stale: "Stale", idle: "Idle" };
const STATUS_CLS = {
  block: "text-rose-600 dark:text-rose-400",
  run: "text-amber-600 dark:text-amber-400",
  ship: "text-emerald-600 dark:text-emerald-400",
  hold: "text-cyan-600 dark:text-cyan-400",
  stale: "text-orange-600 dark:text-orange-400",
  idle: "text-slate-500",
};

export function RunsSummaryCards({ runs, testid }) {
  return (
    <div className="grid grid-cols-3 gap-3" data-testid={testid}>
      {[["Engram", runs.engram], ["Forge", runs.forge], ["Crucible", runs.crucible]].map(([l, v]) => (
        <div key={l} className="rounded-md border border-border bg-card px-4 py-3 text-center">
          <div className="font-mono text-2xl font-bold tabular">{v}</div>
          <div className="mt-0.5 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">{l} runs</div>
        </div>
      ))}
    </div>
  );
}

export function TrinityMatrix({ trinity, testid }) {
  const statuses = ["block", "run", "ship", "hold", "stale", "idle"];
  const rows = [...trinity.rows, trinity.total_row];
  const detail = trinity.detail || [];
  const [drill, setDrill] = useState(null); // {area, status}
  const navigate = useNavigate();

  const drillPeople = drill
    ? detail
        .filter((p) => {
          const areaKeys = drill.area === "total" ? ["engram", "forge", "crucible"] : [drill.area];
          return areaKeys.some((k) => p.areas[k]?.bucket === drill.status);
        })
        .map((p) => {
          const areaKeys = drill.area === "total" ? ["engram", "forge", "crucible"] : [drill.area];
          const hit = areaKeys.map((k) => p.areas[k]).find((a) => a?.bucket === drill.status);
          return { ...p, phase: hit?.phase, disposition: hit?.disposition };
        })
    : [];

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card thin-scroll" data-testid={testid}>
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Trinity phase status matrix. Click a status count to see who.</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Area</th>
            <th className="px-3 py-2.5 text-right font-medium">Total Runs</th>
            {statuses.map((s) => (
              <th key={s} className="px-3 py-2.5 text-right font-medium">{STATUS_LABELS[s]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`border-b border-border/60 ${r.key === "total" ? "bg-muted/30 font-semibold" : ""}`}>
              <td className="px-4 py-2 font-medium">{r.area}</td>
              <td className="px-3 py-2 text-right font-mono tabular">{r.total}</td>
              {statuses.map((s) => {
                const v = r.buckets[s];
                const areaKey = r.key === "total" ? "total" : r.key;
                return (
                  <td key={s} className="px-3 py-2 text-right font-mono tabular">
                    {v ? (
                      <button
                        data-testid={`matrix-cell-${areaKey}-${s}`}
                        onClick={() => setDrill({ area: areaKey, status: s, areaLabel: r.area })}
                        className={`rounded px-1.5 hover:underline ${STATUS_CLS[s]}`}
                      >
                        {v}
                      </button>
                    ) : (
                      <span className="text-muted-foreground/40">0</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drill?.areaLabel} · <span className={STATUS_CLS[drill?.status]}>{STATUS_LABELS[drill?.status]}</span>
              <span className="text-sm font-normal text-muted-foreground">({drillPeople.length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="thin-scroll max-h-[60vh] space-y-1 overflow-y-auto" data-testid="matrix-drilldown">
            {drillPeople.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No people.</p>
            ) : drillPeople.map((p) => (
              <button key={p.email}
                onClick={() => { setDrill(null); navigate(`/users/${encodeURIComponent(p.email)}`); }}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-left text-sm hover:bg-accent">
                <div className="min-w-0">
                  <div className="font-medium">{p.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{p.email}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs">{p.phase || "—"}</div>
                  {p.disposition && <div className="text-[11px] text-muted-foreground">{p.disposition}</div>}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ManualFunnel({ manual, testid }) {
  const steps = [
    ["Assigned", manual.assigned], ["Bundles Created", manual.bundles_created],
    ["Bundles Approved", manual.bundles_approved], ["Trajectory Generated", manual.trajectory],
    ["Tasks QCed", manual.qced],
  ];
  const max = Math.max(...steps.map((s) => s[1]), 1);
  return (
    <div className="rounded-md border border-border bg-card p-4" data-testid={testid}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Manual pipeline
        </h3>
        <span className="text-xs text-muted-foreground">{manual.people} manual taskers</span>
      </div>
      <div className="space-y-2.5">
        {steps.map(([l, v]) => (
          <div key={l}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="text-muted-foreground">{l}</span>
              <span className="font-mono font-medium tabular">{v}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
