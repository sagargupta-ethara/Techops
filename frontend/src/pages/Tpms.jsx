import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import DistroChart from "@/components/DistroChart";

const COUNT_COLS = [
  ["headcount", "Headcount"], ["pod_count", "PODs"], ["project_count", "Projects"],
  ["trinity", "Trinity Taskers"], ["manual", "Manual Taskers"], ["harness", "Harness / G. Kit"],
  ["manual_qc", "Manual QC"], ["absent", "Absent"],
];

export default function Tpms() {
  const { queryString } = useFilters();
  const navigate = useNavigate();
  const query = queryString();
  const qs = query ? `?${query}` : "";
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
          <>
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_.75fr]">
            <DistroChart title="Team size by TPM" type="bar" testid="tpm-headcount-chart"
              data={(data?.tpms || []).map((t) => ({ label: t.name, count: t.headcount }))} />
            <div className="panel p-5">
              <div className="text-xs font-semibold uppercase tracking-[.12em] text-primary">Portfolio readout</div>
              <div className="mt-4 space-y-4">
                <Summary label="Total TPMs" value={data?.tpms?.length || 0} />
                <Summary label="People represented" value={(data?.tpms || []).reduce((n, t) => n + t.headcount, 0)} />
                <Summary label="On leave" value={(data?.tpms || []).reduce((n, t) => n + t.absent, 0)} />
              </div>
              <p className="mt-5 border-t border-border/70 pt-4 text-sm leading-6 text-muted-foreground">Compare team size first, then use the table to assess workstream coverage and leave concentration.</p>
            </div>
          </div>
          <div className="panel overflow-x-auto thin-scroll">
            <table className="data-table min-w-[760px]" data-testid="tpms-table">
              <caption className="sr-only">TPM summary table</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">TPM</th>
                  {COUNT_COLS.map(([k, label]) => (
                    <th key={k} className="px-4 py-2.5 text-center font-medium">{label}</th>
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
                      <td key={k} className={`px-4 py-2.5 text-center font-mono tabular ${
                        k === "absent" && t[k] > 0 ? "text-slate-500" : ""}`}>
                        {t[k]}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </PageContainer>
    </>
  );
}

function Summary({ label, value, tone = "text-foreground" }) {
  return <div className="flex items-end justify-between border-b border-border/60 pb-3 last:border-0"><span className="text-sm text-muted-foreground">{label}</span><strong className={`font-heading text-2xl tabular ${tone}`}>{value}</strong></div>;
}
