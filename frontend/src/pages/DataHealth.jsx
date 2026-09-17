import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Database, Clock, Boxes, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageContainer, PageHeader } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

const STATE_LABEL = { fresh: "Fresh", stale: "Stale", sync_failed: "Sync Failed", unavailable: "Unavailable" };
const RUN_CLS = {
  success: "text-emerald-600 dark:text-emerald-400", quarantined: "text-cyan-600 dark:text-cyan-400",
  failed: "text-rose-600 dark:text-rose-400", running: "text-muted-foreground",
};

export default function DataHealth() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["data-health"],
    queryFn: () => api.get("/data-health").then((r) => r.data),
    refetchInterval: 15000,
  });

  const doSync = async () => {
    setSyncing(true);
    try {
      const { data: res } = await api.post("/sync");
      toast.success(`Sync ${res.status}`, { description: res.reason || `${res.change_count ?? 0} changes` });
      refetch();
    } catch (e) {
      toast.error("Sync failed", { description: e.response?.data?.detail || e.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Data Health"
        subtitle="Sync freshness, last-good state, and quarantined runs."
        right={user?.role === "admin" && (
          <Button onClick={doSync} disabled={syncing} data-testid="data-health-sync-now-button" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync now
          </Button>
        )}
      />

      {isLoading || !data ? (
        <Skeleton className="h-64 rounded-md" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4">
            <StatusBadge
              state={data.state === "fresh" ? "fresh" : data.state === "stale" ? "stale" : data.state === "sync_failed" ? "sync_failed" : "unavailable"}
              text={STATE_LABEL[data.state] || "Unknown"} size="lg" testid="data-health-state" />
            <span className="text-sm text-muted-foreground">
              Poll interval {data.interval_seconds}s · Last success {data.last_success ? fmtDate(data.last_success.finished_at) : "never"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiStat testid="dh-people" label="People (last good)" value={data.person_count} icon={Database} accent />
            <KpiStat testid="dh-pods" label="PODs" value={data.pod_count} icon={Boxes} />
            <KpiStat testid="dh-date" label="Reporting Date" value={data.reporting_date || "—"} icon={Clock} />
            <KpiStat testid="dh-age" label="Seconds Since Sync"
                     value={data.seconds_since_success != null ? Math.round(data.seconds_since_success) : "—"} icon={Clock} />
          </div>

          {data.quarantined?.length > 0 && (
            <div className="mt-4 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-4" data-testid="quarantine-panel">
              <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-cyan-700 dark:text-cyan-400">
                <AlertTriangle className="h-4 w-4" /> Quarantined / Failed Runs
              </h3>
              <ul className="space-y-1 text-sm">
                {data.quarantined.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${RUN_CLS[r.status]}`}>{r.status}</span>
                    <span className="text-muted-foreground">{fmtDate(r.started_at)}</span>
                    <span>— {r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Sync Runs
            </div>
            <table className="w-full text-sm" data-testid="sync-runs-table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Started (IST)</th>
                  <th className="px-4 py-2 font-medium">Trigger</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">People</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-mono text-xs">{fmtDate(r.started_at)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.trigger}</td>
                    <td className={`px-4 py-2 font-medium ${RUN_CLS[r.status]}`}>{r.status}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.person_count ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.reason || (r.change_count != null ? `${r.change_count} changes` : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
