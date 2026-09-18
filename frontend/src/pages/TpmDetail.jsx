import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Info } from "lucide-react";
import api from "@/lib/api";
import { PageContainer } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import DistroChart from "@/components/DistroChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function TpmDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tpm", name],
    queryFn: () => api.get(`/tpms/${encodeURIComponent(name)}`).then((r) => r.data),
  });

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}
              className="mb-3 gap-1.5 text-muted-foreground hover:text-foreground" data-testid="back-button">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      {isError ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">TPM not found.</div>
      ) : isLoading || !data ? (
        <Skeleton className="h-64 rounded-md" />
      ) : (
        <>
          <section className="mb-5 overflow-hidden rounded-2xl bg-[hsl(var(--hero))] p-6 text-white shadow-xl shadow-emerald-950/10" data-testid="tpm-overview-insight">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-teal-300">TPM portfolio · {data.reporting_date}</div>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">{name}</h1>
            <div className="mt-4 flex max-w-4xl items-start gap-2 text-sm leading-6 text-slate-300"><Info className="mt-1 h-4 w-4 shrink-0 text-teal-300" /><span>{data.overview_insight}</span></div>
          </section>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiStat testid="tpm-kpi-headcount" label="Headcount" value={data.metrics.headcount} accent />
            <KpiStat testid="tpm-kpi-complete" label="Complete" value={data.metrics.completion.complete} />
            <KpiStat testid="tpm-kpi-progress" label="In progress" value={data.metrics.completion.incomplete} />
            <KpiStat testid="tpm-kpi-absent" label="Absent (Leave)" value={data.counts.on_leave} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-testid="tpm-counts">
            {[["Trinity", data.counts.trinity], ["Manual", data.counts.manual],
              ["Harness / G. Kit", data.counts.harness], ["Manual QC", data.counts.manual_qc],
              ["Absent", data.counts.on_leave]].map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-card px-3 py-2.5 text-center">
                <div className="font-mono text-xl font-semibold tabular">{v}</div>
                <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DistroChart testid="tpm-chart-workstream" title="What People Are Working On" data={data.metrics.workstream_mix} type="bar" />
            <DistroChart testid="tpm-chart-role" title="Role Mix" data={data.metrics.role_mix} type="pie" />
          </div>
          <div className="panel mt-4 overflow-x-auto thin-scroll">
            <div className="border-b border-border px-4 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              PODs under {name}
            </div>
            <table className="data-table min-w-[560px]" data-testid="tpm-pods-table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">POD Lead</th>
                  <th className="px-4 py-2 text-center font-medium">Headcount</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.pods.map((p) => (
                  <tr key={p.name} data-testid={`tpm-pod-row-${p.name}`}
                      onClick={() => navigate(`/pods/${encodeURIComponent(p.name)}`)}
                      className="cursor-pointer border-b border-border/60 hover:bg-accent">
                    <td className="px-4 py-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="max-w-[420px] truncate text-[11px] text-muted-foreground">{p.insight}</div>
                    </td>
                    <td className="px-4 py-2 text-center font-mono tabular">{p.headcount}</td>
                    <td className="px-4 py-2 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
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
