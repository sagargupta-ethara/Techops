import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Database, Clock, Boxes, AlertTriangle, DatabaseBackup, Download } from "lucide-react";
import api, { API_BASE_URL } from "@/lib/api";
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
  const [showAllFailures, setShowAllFailures] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["data-health"],
    queryFn: () => api.get("/data-health").then((r) => r.data),
    refetchInterval: 15000,
  });
  const { data: backups, refetch: refetchBackups } = useQuery({
    queryKey: ["backups"],
    queryFn: () => api.get("/backups").then((r) => r.data),
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

  const runBackup = async () => {
    try {
      const { data: res } = await api.post("/backups/run");
      toast.success("Backup captured", { description: `${res.row_count} rows` });
      refetchBackups();
    } catch (e) {
      toast.error("Backup failed", { description: e.response?.data?.detail || e.message });
    }
  };

  const downloadUrl = (date) => `${API_BASE_URL}/backups/${date}/download?token=${localStorage.getItem("pod_token")}`;
  const backupHour = String(backups?.backup_hour_ist ?? 4).padStart(2, "0");

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
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl bg-[hsl(var(--hero))] p-5 text-white shadow-xl shadow-emerald-950/10 sm:p-6">
            <StatusBadge
              state={data.state === "fresh" ? "fresh" : data.state === "stale" ? "stale" : data.state === "sync_failed" ? "sync_failed" : "unavailable"}
              text={STATE_LABEL[data.state] || "Unknown"} size="lg" testid="data-health-state" />
            <div><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-teal-300">Pipeline state</div><span className="mt-1 block text-sm text-slate-300">
              Poll interval {data.interval_seconds}s · Last success {data.last_success ? fmtDate(data.last_success.finished_at) : "never"}
            </span></div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiStat testid="dh-people" label="People (last good)" value={data.person_count} icon={Database} accent />
            <KpiStat testid="dh-pods" label="PODs" value={data.pod_count} icon={Boxes} />
            <KpiStat testid="dh-date" label="Reporting Date" value={data.reporting_date || "—"} icon={Clock} />
            <KpiStat testid="dh-age" label="Seconds Since Sync"
                     value={data.seconds_since_success != null ? Math.round(data.seconds_since_success) : "—"} icon={Clock} />
          </div>

          {data.quarantined?.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="quarantine-panel">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Recent failed runs · {data.quarantined.length}
              </h3>
              {data.quarantined.length > 3 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAllFailures((v) => !v)}>{showAllFailures ? "Show latest" : "Show history"}</Button>}
              </div>
              <ul className="space-y-1 text-sm">
                {data.quarantined.slice(0, showAllFailures ? undefined : 3).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${RUN_CLS[r.status]}`}>{r.status}</span>
                    <span className="text-muted-foreground">{fmtDate(r.started_at)}</span>
                    <span>— {r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel mt-4 overflow-x-auto thin-scroll">
            <div className="border-b border-border px-4 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Sync Runs
            </div>
            <table className="w-full text-sm" data-testid="sync-runs-table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Started (IST)</th>
                  <th className="px-4 py-2 font-medium">Trigger</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-center font-medium">People</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_runs.slice(0, 12).map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-mono text-xs">{fmtDate(r.started_at)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.trigger}</td>
                    <td className={`px-4 py-2 font-medium ${RUN_CLS[r.status]}`}>{r.status}</td>
                    <td className="px-4 py-2 text-center font-mono">{r.person_count ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.reason || (r.change_count != null ? `${r.change_count} changes` : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel mt-4 overflow-x-auto thin-scroll">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <DatabaseBackup className="h-4 w-4" /> Daily CSV Backups
                <span className="text-[11px] font-normal normal-case tracking-normal">
                  auto at {backupHour}:00 IST · previous reporting day
                </span>
              </div>
              {user?.role === "admin" && (
                <Button variant="outline" size="sm" onClick={runBackup} data-testid="run-backup-button" className="h-8 gap-1.5 text-xs">
                  <DatabaseBackup className="h-3.5 w-3.5" /> Back up now
                </Button>
              )}
            </div>
            {!backups?.backups?.length ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No backups yet.</div>
            ) : (
              <table className="data-table min-w-[720px]" data-testid="backups-table">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 text-center font-medium">Rows</th>
                    <th className="px-4 py-2 text-center font-medium">Size</th>
                    <th className="px-4 py-2 font-medium">Captured</th>
                    <th className="px-4 py-2 font-medium">Trigger</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {backups.backups.map((b) => (
                    <tr key={b.backup_date} className="border-b border-border/60" data-testid={`backup-row-${b.backup_date}`}>
                      <td className="px-4 py-2 font-mono">{b.backup_date}</td>
                      <td className="px-4 py-2 text-center font-mono">{b.row_count}</td>
                      <td className="px-4 py-2 text-center font-mono text-muted-foreground">{(b.size_bytes / 1024).toFixed(0)} KB</td>
                      <td className="px-4 py-2 font-mono text-xs">{fmtDate(b.created_at)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{b.trigger}</td>
                      <td className="px-4 py-2 text-right">
                        <a href={downloadUrl(b.backup_date)} download
                           data-testid={`download-backup-${b.backup_date}`}
                           className="inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9">
                          <Download className="h-3.5 w-3.5" /> CSV
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
