import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/Page";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const KPI_DEFS = [
  ["pods", "PODs"], ["members", "Total Members"], ["trinity", "Trinity Taskers"], ["manual", "Manual Taskers"],
  ["harness", "Harness / G. Kit"], ["manual_qc", "Manual QC Taskers"], ["on_leave", "On Leave"],
  ["trinity_target", "Trinity Assigned"],
  ["trinity_staged", "Trinity Staged"], ["trinity_staged_pct", "Stage Progress"],
  ["trinity_completed", "Trinity Completed"], ["trinity_completed_pct", "Completed Progress"],
  ["manual_staged", "Manual Staged"],
  ["tasks_qced", "Tasks QCed"],
  ["overall_pct", "Overall Progress"],
];

function kval(kpis, key) {
  const v = kpis[key];
  if (key === "overall_pct") return `${v ?? 0}%`;
  if (key.endsWith("_pct")) return `${v ?? 0}%`;
  return v;
}

const STATUS_ORDER = ["block", "run", "ship", "hold", "stale", "idle"];
const STATUS_LABELS = { block: "Block", run: "Run", ship: "Ship", hold: "Hold", stale: "Stale", idle: "Idle" };
const STATUS_CLS = {
  block: "text-rose-600 dark:text-rose-400", run: "text-amber-600 dark:text-amber-400",
  ship: "text-emerald-600 dark:text-emerald-400", hold: "text-cyan-600 dark:text-cyan-400",
  stale: "text-orange-600 dark:text-orange-400", idle: "text-slate-500",
};

const OVERALL_COLS = [
  ["internal_project", "Internal Project"], ["project_category", "Project Category"],
  ["members", "Members"], ["trinity", "Trinity Taskers"], ["manual", "Manual Taskers"],
  ["harness", "Harness / G. Kit"], ["manual_qc", "Manual QC"], ["on_leave", "On Leave"],
  ["trinity_target", "Trinity Assigned"], ["trinity_staged", "Trinity Staged"],
  ["trinity_staged_pct", "Stage Progress"], ["trinity_completed", "Trinity Completed"],
  ["trinity_completed_pct", "Completed Progress"],
  ["manual_target", "Manual Target"], ["manual_staged", "Manual Staged"],
  ["tasks_qced", "Tasks QCed"],
  ["overall_pct", "Overall Progress"],
];

function cval(row, key) {
  const v = row[key];
  if (key === "overall_pct") return `${v ?? 0}%`;
  if (key.endsWith("_pct")) return `${v ?? 0}%`;
  if (["trinity_staged", "trinity_completed", "manual_staged", "tasks_qced"].includes(key)) return v == null || v === "" ? 0 : v;
  if (["internal_project", "project_category"].includes(key)) return v || "No data";
  return v;
}

export default function Pods() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overall");
  const { data, isLoading } = useQuery({
    queryKey: ["summary"],
    queryFn: () => api.get("/summary").then((r) => r.data),
  });

  const pods = data?.pods || [];
  const podUrl = (name) => `/pods/${encodeURIComponent(name)}`;
  const openPod = (name) => navigate(podUrl(name));

  return (
    <>
      <PageContainer>
        <PageHeader title="Pod-wise Summary"
                    subtitle="Live roll-up of Trinity / Manual / Harness workstreams per POD. Click a row to drill into the POD overview." />

        {isLoading || !data?.kpis ? (
          <Skeleton className="h-24 rounded-md" />
        ) : (<>
          <section className="panel mb-6 overflow-hidden" data-testid="workstream-coverage">
            <div className="flex flex-col gap-3 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">Network summary</div>
                <h2 className="mt-1 font-heading text-xl font-bold">Workstream coverage</h2>
                <p className="mt-1 text-sm text-muted-foreground">People assigned to multiple workstreams appear in each applicable total.</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
                <strong className="font-heading text-lg text-foreground">{data.kpis.on_leave}</strong> people on leave
                <span className="ml-2 text-xs">Excluded from active progress</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-3 xl:grid-cols-6">
              {KPI_DEFS.slice(0, 6).map(([k, label]) => (
                <div key={k} className="bg-card px-5 py-4 sm:px-6">
                  <div className="font-heading text-2xl font-bold tabular tracking-tight">{kval(data.kpis, k)}</div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </section>
          <div className="metric-strip mb-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-9"
               data-testid="summary-kpis">
            {KPI_DEFS.slice(6).map(([k, label]) => (
              <div key={k} className="metric-cell border-b border-r last:border-r-0 sm:[&:nth-child(n+6)]:border-b-0">
                <div className="font-heading text-2xl font-bold tabular tracking-tight">{kval(data.kpis, k)}</div>
                <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </>)}

        <Tabs value={tab} onValueChange={setTab}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList data-testid="summary-tabs">
              {["overall", "trinity", "manual"].map((t) => (
                <TabsTrigger key={t} value={t} data-testid={`summary-tab-${t}`} className="capitalize">{t}</TabsTrigger>
              ))}
            </TabsList>
            <span className="text-xs text-muted-foreground lg:hidden">Swipe horizontally to see all columns</span>
          </div>

          {isLoading ? (
            <Skeleton className="h-96 rounded-md" />
          ) : (
            <>
              <TabsContent value="overall">
                <SummaryTable pods={pods} openPod={openPod} podUrl={podUrl}
                  cols={OVERALL_COLS} render={(r, k) => cval(r, k)} testid="summary-table" />
              </TabsContent>

              <TabsContent value="trinity">
                <SummaryTable pods={pods} openPod={openPod} podUrl={podUrl}
                  cols={[
                    ["internal_project", "Internal Project"], ["members", "Members"],
                    ["trinity", "Trinity Taskers"], ["trinity_target", "Assigned Tasks"],
                    ["trinity_staged", "Staged after Forge"], ["trinity_staged_pct", "Stage Progress"],
                    ["trinity_completed", "Approved after Crucible"], ["trinity_completed_pct", "Completed Progress"],
                    ["engram", "Engram Runs"], ["forge", "Forge Runs"], ["crucible", "Crucible Runs"],
                    ...STATUS_ORDER.map((s) => [`st_${s}`, STATUS_LABELS[s]]),
                  ]}
                  render={(r, k) => {
                    if (k.startsWith("st_")) return r.status?.[k.slice(3)] ?? 0;
                    if (["engram", "forge", "crucible"].includes(k)) return r.runs?.[k] ?? 0;
                    return cval(r, k);
                  }}
                  colorFn={(r, k, v) => (k.startsWith("st_") && v ? STATUS_CLS[k.slice(3)] : "")}
                  testid="summary-trinity-table" />
              </TabsContent>

              <TabsContent value="manual">
                <SummaryTable pods={pods} openPod={openPod} podUrl={podUrl}
                  cols={[
                    ["internal_project", "Internal Project"], ["members", "Members"],
                    ["manual", "Manual Taskers"], ["manual_qc", "Manual QC"],
                    ["manual_target", "Manual Target"],
                    ["f_created", "Manual Staged"], ["f_approved", "Bundles Approved"],
                    ["f_trajectory", "Trajectory"], ["f_qced", "Tasks QCed"],
                  ]}
                  render={(r, k) => {
                    if (k === "f_created") return r.funnel?.bundles_created ?? 0;
                    if (k === "f_approved") return r.funnel?.bundles_approved ?? 0;
                    if (k === "f_trajectory") return r.funnel?.trajectory ?? 0;
                    if (k === "f_qced") return r.funnel?.qced ?? 0;
                    return cval(r, k);
                  }}
                  testid="summary-manual-table" />
              </TabsContent>
            </>
          )}
        </Tabs>
      </PageContainer>
    </>
  );
}

function SummaryTable({ pods, openPod, podUrl, cols, render, colorFn, testid }) {
  return (
    <div className="panel thin-scroll max-h-[70vh] overflow-auto" data-testid={`${testid}-scroll-container`}>
      <table className="data-table min-w-[1000px]" data-testid={testid}>
        <caption className="sr-only">Pod-wise summary</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-30 bg-muted px-4 py-2.5 font-medium shadow-[1px_0_0_hsl(var(--border))]">Pod Lead</th>
            {cols.map(([k, label]) => (
              <th key={k} className={`px-3 py-2.5 font-medium ${k === "internal_project" || k === "project_category" ? "" : "text-center"}`}>
                {label}
              </th>
            ))}
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {pods.map((r) => (
            <tr key={r.name} data-testid={`summary-row-${r.name}`}
                onClick={() => openPod(r.name)}
                className="cursor-pointer border-b border-border/60 hover:bg-accent">
              <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium shadow-[1px_0_0_hsl(var(--border))]">
                <Link to={podUrl(r.name)} onClick={(event) => event.stopPropagation()}
                      className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {r.name}
                </Link>
              </td>
              {cols.map(([k]) => {
                const v = render(r, k);
                const isText = k === "internal_project" || k === "project_category";
                const extra = colorFn ? colorFn(r, k, v) : "";
                const redZero = k === "overall_pct" && r[k] != null;
                return (
                  <td key={k} className={`px-3 py-2 ${isText ? "text-muted-foreground" : "text-center font-mono tabular"} ${extra} ${
                    redZero ? (r[k] > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500") : ""}`}>
                    {v}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
