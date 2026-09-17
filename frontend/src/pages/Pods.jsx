import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader, CoverageBar } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

export default function Pods() {
  const { filters } = useFilters();
  const navigate = useNavigate();
  const qs = filters.date ? `?date=${filters.date}` : "";
  const { data, isLoading } = useQuery({
    queryKey: ["pods", qs],
    queryFn: () => api.get(`/pods${qs}`).then((r) => r.data),
  });

  const pods = (data?.pods || []).filter(
    (p) => (!filters.tpm || p.tpm === filters.tpm) && (!filters.pod || p.name === filters.pod)
  );

  return (
    <>
      <GlobalFilterBar />
      <PageContainer>
        <PageHeader title="PODs" subtitle="Per-POD operating status. Click a POD to drill into its workflow." />
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-md" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pods.map((p) => (
              <button key={p.name} data-testid={`pod-card-${p.name}`}
                      onClick={() => navigate(`/pods/${encodeURIComponent(p.name)}`)}
                      className="group rounded-md border border-border bg-card p-4 text-left transition-colors duration-150 hover:bg-accent/50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-heading font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">TPM · {p.tpm}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold tabular">{p.headcount}</span>
                  <span className="text-xs text-muted-foreground">people</span>
                  {p.attention > 0 && (
                    <span className="ml-auto rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-600 dark:text-cyan-400">
                      {p.attention} attention
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <Row label="Target" value={p.target_coverage} />
                  <Row label="Trinity" value={p.trinity_coverage} />
                  <Row label="Manual" value={p.manual_coverage} />
                </div>
              </button>
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <CoverageBar value={value} />
    </div>
  );
}
