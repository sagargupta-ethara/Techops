import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader, CoverageBar } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

export default function Tpms() {
  const { filters } = useFilters();
  const navigate = useNavigate();
  const qs = filters.date ? `?date=${filters.date}` : "";
  const { data, isLoading } = useQuery({
    queryKey: ["tpms", qs],
    queryFn: () => api.get(`/tpms${qs}`).then((r) => r.data),
  });

  return (
    <>
      <GlobalFilterBar />
      <PageContainer>
        <PageHeader title="TPMs" subtitle="Technical Program Managers and their POD portfolios" />
        {isLoading ? (
          <Skeleton className="h-64 rounded-md" />
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <table className="w-full text-sm" data-testid="tpms-table">
              <caption className="sr-only">TPM summary table</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">TPM</th>
                  <th className="px-4 py-2.5 text-right font-medium">Headcount</th>
                  <th className="px-4 py-2.5 text-right font-medium">PODs</th>
                  <th className="px-4 py-2.5 text-right font-medium">Projects</th>
                  <th className="px-4 py-2.5 text-right font-medium">Attention</th>
                  <th className="px-4 py-2.5 font-medium">Target</th>
                  <th className="px-4 py-2.5 font-medium">Trinity</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data?.tpms?.map((t) => (
                  <tr key={t.name} data-testid={`tpm-row-${t.name}`}
                      onClick={() => navigate(`/tpms/${encodeURIComponent(t.name)}`)}
                      className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent">
                    <td className="px-4 py-2.5 font-medium">{t.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular">{t.headcount}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular">{t.pod_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular">{t.project_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular">
                      {t.attention > 0
                        ? <span className="text-cyan-600 dark:text-cyan-400">{t.attention}</span>
                        : "0"}
                    </td>
                    <td className="px-4 py-2.5"><CoverageBar value={t.target_coverage} /></td>
                    <td className="px-4 py-2.5"><CoverageBar value={t.trinity_coverage} /></td>
                    <td className="px-4 py-2.5 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
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
