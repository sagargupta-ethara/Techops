import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import { Skeleton } from "@/components/ui/skeleton";

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

const COLS = [
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
                    subtitle="Live roll-up of Trinity / Manual / Harness workstreams per POD. Click a row to drill in." />

        {isLoading || !data?.kpis ? (
          <Skeleton className="h-24 rounded-md" />
        ) : (
          <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-5 lg:grid-cols-10"
               data-testid="summary-kpis">
            {KPI_DEFS.map(([k, label]) => (
              <div key={k} className="bg-card px-3 py-3 text-center">
                <div className="font-mono text-xl font-bold tabular">{kval(data.kpis, k)}</div>
                <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-96 rounded-md" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-card thin-scroll">
            <table className="w-full min-w-[1100px] text-sm" data-testid="summary-table">
              <caption className="sr-only">Pod-wise summary</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 bg-muted/40 px-4 py-2.5 font-medium">Pod Lead</th>
                  {COLS.map(([k, label]) => (
                    <th key={k} className={`px-3 py-2.5 font-medium ${k.match(/members|trinity|manual|harness|on_leave|target|completed|overall/) ? "text-right" : ""}`}>
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
                    {COLS.map(([k]) => (
                      <td key={k} className={`px-3 py-2 ${typeof r[k] === "number" || k.match(/target|completed|overall/) ? "text-right font-mono tabular" : "text-muted-foreground"}`}>
                        {k === "overall_pct" && r[k] != null ? (
                          <span className={r[k] > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}>{cval(r, k)}</span>
                        ) : cval(r, k)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    </>
  );
}
