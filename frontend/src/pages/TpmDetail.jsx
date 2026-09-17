import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { PageContainer, PageHeader, CoverageBar } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import DistroChart from "@/components/DistroChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pctText } from "@/lib/format";

export default function TpmDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tpm", name],
    queryFn: () => api.get(`/tpms/${encodeURIComponent(name)}`).then((r) => r.data),
  });

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate("/tpms")}
              className="mb-3 gap-1.5 text-muted-foreground" data-testid="back-button">
        <ArrowLeft className="h-4 w-4" /> All TPMs
      </Button>
      {isError ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">TPM not found.</div>
      ) : isLoading || !data ? (
        <Skeleton className="h-64 rounded-md" />
      ) : (
        <>
          <PageHeader title={name} subtitle={`Reporting date ${data.reporting_date}`} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiStat testid="tpm-kpi-headcount" label="Headcount" value={data.metrics.headcount} accent />
            <KpiStat testid="tpm-kpi-target" label="Target Coverage" value={pctText(data.metrics.target_coverage.pct)} />
            <KpiStat testid="tpm-kpi-trinity" label="Trinity Coverage" value={pctText(data.metrics.trinity_coverage.pct)} />
            <KpiStat testid="tpm-kpi-attention" label="Attention" value={data.metrics.attention} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DistroChart testid="tpm-chart-status" title="Tasking Status" data={data.metrics.status_distribution} type="bar" />
            <DistroChart testid="tpm-chart-role" title="Role Mix" data={data.metrics.role_mix} type="pie" />
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              PODs under {name}
            </div>
            <table className="w-full text-sm" data-testid="tpm-pods-table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">POD Lead</th>
                  <th className="px-4 py-2 text-right font-medium">Headcount</th>
                  <th className="px-4 py-2 text-right font-medium">Attention</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">Trinity</th>
                  <th className="px-4 py-2 font-medium">Manual</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.pods.map((p) => (
                  <tr key={p.name} data-testid={`tpm-pod-row-${p.name}`}
                      onClick={() => navigate(`/pods/${encodeURIComponent(p.name)}`)}
                      className="cursor-pointer border-b border-border/60 hover:bg-accent">
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-right font-mono tabular">{p.headcount}</td>
                    <td className="px-4 py-2 text-right font-mono tabular">{p.attention}</td>
                    <td className="px-4 py-2"><CoverageBar value={p.target_coverage} /></td>
                    <td className="px-4 py-2"><CoverageBar value={p.trinity_coverage} /></td>
                    <td className="px-4 py-2"><CoverageBar value={p.manual_coverage} /></td>
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
