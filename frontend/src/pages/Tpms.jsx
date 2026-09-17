import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

const COUNT_COLS = [
  ["headcount", "Headcount"], ["pod_count", "PODs"], ["project_count", "Projects"],
  ["trinity", "Trinity"], ["manual", "Manual"], ["harness", "Harness/GK"],
  ["manual_qc", "Manual QC"], ["absent", "Absent"], ["attention", "Attention"],
];

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
        <PageHeader title="TPMs" subtitle="Headcount and workstream distribution per Technical Program Manager" />
        {isLoading ? (
          <Skeleton className="h-64 rounded-md" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-card thin-scroll">
            <table className="w-full min-w-[760px] text-sm" data-testid="tpms-table">
              <caption className="sr-only">TPM summary table</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">TPM</th>
                  {COUNT_COLS.map(([k, label]) => (
                    <th key={k} className="px-4 py-2.5 text-right font-medium">{label}</th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data?.tpms?.map((t) => (
                  <tr key={t.name} data-testid={`tpm-row-${t.name}`}
                      onClick={() => navigate(`/tpms/${encodeURIComponent(t.name)}`)}
                      className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent">
                    <td className="px-4 py-2.5 font-medium">{t.name}</td>
                    {COUNT_COLS.map(([k]) => (
                      <td key={k} className={`px-4 py-2.5 text-right font-mono tabular ${
                        k === "attention" && t[k] > 0 ? "text-cyan-600 dark:text-cyan-400"
                        : k === "absent" && t[k] > 0 ? "text-slate-500" : ""}`}>
                        {t[k]}
                      </td>
                    ))}
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
