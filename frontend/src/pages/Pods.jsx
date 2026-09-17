import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const KPI_DEFS = [
  ["pods", "PODs"], ["members", "Total Members"], ["trinity", "Trinity Taskers"], ["manual", "Manual Taskers"],
  ["harness", "Harness / G. Kit"], ["manual_qc", "Manual QC Taskers"], ["on_leave", "On Leave"],
  ["trinity_shipped_pct", "Trinity Shipped"], ["manual_completed", "Manual Completed"],
  ["overall_pct", "Overall %"],
];

function kval(kpis, key) {
  const v = kpis[key];
  if (key.endsWith("_pct")) return v == null ? "N/A" : `${v}%`;
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
  ["trinity_target", "Trinity Target"], ["trinity_completed", "Trinity Completed"],
  ["manual_target", "Manual Target"], ["manual_completed", "Manual Completed"],
  ["overall_pct", "Overall Progress"],
];

function cval(row, key) {
  const v = row[key];
  if (key === "overall_pct") return v == null ? "N/A" : `${v}%`;
  if (key === "trinity_completed") return "N/A";
  if (key === "manual_completed") return v == null ? "N/A" : v;
  if (["internal_project", "project_category"].includes(key)) return v || "No data";
  return v;
}

export default function Pods() {
  const { filters } = useFilters();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overall");
  const qs = filters.date ? `?date=${filters.date}` : "";
  const { data, isLoading } = useQuery({
    queryKey: ["summary", qs],
    queryFn: () => api.get(`/summary${qs}`).then((r) => r.data),
  });

  let pods = data?.pods || [];
  if (filters.tpm) pods = pods.filter((p) => p.tpm === filters.tpm);
  if (filters.pod) pods = pods.filter((p) => p.name === filters.pod);

  return (
    <>
      <GlobalFilterBar />
      <PageContainer>
        <PageHeader title="Pod-wise Summary"
                    subtitle="Live roll-up of Trinity / Manual / Harness workstreams per POD. Click a row to drill into the POD overview." />

        {isLoading || !data?.kpis ? (
          <Skeleton className="h-24 rounded-md" />
        ) : (
          <div className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-5 lg:grid-cols-10"
               data-testid="summary-kpis">
            {KPI_DEFS.map(([k, label]) => (
              <div key={k} className="bg-card px-3 py-3 text-center">
                <div className="font-mono text-xl font-bold tabular">{kval(data.kpis, k)}</div>
                <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4" data-testid="summary-tabs">
            {["overall", "trinity", "manual"].map((t) => (
              <TabsTrigger key={t} value={t} data-testid={`summary-tab-${t}`} className="capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>

          {isLoading ? (
            <Skeleton className="h-96 rounded-md" />
          ) : (
            <>
              <TabsContent value="overall">
                <SummaryTable pods={pods} navigate={navigate}
                  cols={OVERALL_COLS} render={(r, k) => cval(r, k)} testid="summary-table" />
              </TabsContent>

              <TabsContent value="trinity">
                <SummaryTable pods={pods} navigate={navigate}
                  cols={[
                    ["internal_project", "Internal Project"], ["members", "Members"],
                    ["trinity", "Trinity Taskers"], ["trinity_target", "Trinity Target"],
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
                <SummaryTable pods={pods} navigate={navigate}
                  cols={[
                    ["internal_project", "Internal Project"], ["members", "Members"],
                    ["manual", "Manual Taskers"], ["manual_qc", "Manual QC"],
                    ["manual_target", "Manual Target"], ["manual_completed", "Manual Completed"],
                    ["f_created", "Bundles Created"], ["f_approved", "Bundles Approved"],
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

function SummaryTable({ pods, navigate, cols, render, colorFn, testid }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card thin-scroll">
      <table className="w-full min-w-[1000px] text-sm" data-testid={testid}>
        <caption className="sr-only">Pod-wise summary</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 bg-muted/40 px-4 py-2.5 font-medium">Pod Lead</th>
            {cols.map(([k, label]) => (
              <th key={k} className={`px-3 py-2.5 font-medium ${k === "internal_project" || k === "project_category" ? "" : "text-right"}`}>
                {label}
              </th>
            ))}
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {pods.map((r) => (
            <tr key={r.name} data-testid={`summary-row-${r.name}`}
                onClick={() => navigate(`/pods/${encodeURIComponent(r.name)}`)}
                className="cursor-pointer border-b border-border/60 hover:bg-accent">
              <td className="sticky left-0 bg-card px-4 py-2 font-medium">{r.name}</td>
              {cols.map(([k]) => {
                const v = render(r, k);
                const isText = k === "internal_project" || k === "project_category";
                const extra = colorFn ? colorFn(r, k, v) : "";
                const redZero = k === "overall_pct" && r[k] != null;
                return (
                  <td key={k} className={`px-3 py-2 ${isText ? "text-muted-foreground" : "text-right font-mono tabular"} ${extra} ${
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
