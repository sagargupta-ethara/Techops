import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, Target, Boxes, ShieldAlert, TrendingUp, ArrowRight, Layers } from "lucide-react";
import api from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import DistroChart from "@/components/DistroChart";
import { Skeleton } from "@/components/ui/skeleton";
import { pctText } from "@/lib/format";

export default function Overview() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get(`/overview`).then((r) => r.data),
  });

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Executive Overview"
          subtitle={data?.reporting_date ? `Reporting date ${data.reporting_date} · revision ${data.revision}` : "Live operations snapshot"}
        />

        {isLoading || !data?.metrics ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 stagger">
              <KpiStat testid="kpi-headcount" label="Headcount" value={data.metrics.headcount} icon={Users} accent
                       sub={`${data.hierarchy.pods.length} PODs · ${data.hierarchy.tpms.length} TPMs`} />
              <KpiStat testid="kpi-target" label="Target Coverage" value={pctText(data.metrics.target_coverage.pct)} icon={Target}
                       sub={`${data.metrics.target_coverage.num}/${data.metrics.target_coverage.den} assigned`} />
              <KpiStat testid="kpi-trinity" label="Trinity Coverage" value={pctText(data.metrics.trinity_coverage.pct)} icon={Layers}
                       sub={`${data.metrics.trinity_coverage.num}/${data.metrics.trinity_coverage.den} people`} />
              <KpiStat testid="kpi-attention" label="Attention" value={data.metrics.attention} icon={ShieldAlert}
                       sub={data.metrics.no_remark ? `${data.metrics.no_remark} with no remark` : "No Trinity/Manual data"} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MiniStat label="Complete" value={data.metrics.completion.complete} tone="text-emerald-500" testid="mini-complete" />
              <MiniStat label="In Progress (NA)" value={data.metrics.completion.incomplete} tone="text-amber-500" testid="mini-incomplete" />
              <MiniStat label="Absent (Leave)" value={data.metrics.completion.absent} tone="text-slate-400" testid="mini-absent" />
              <MiniStat label="No Remark" value={data.metrics.no_remark} tone="text-cyan-500" testid="mini-noremark" />
            </div>

            {data.insights?.length > 0 && (
              <div className="mt-4 space-y-2" data-testid="insights">
                {data.insights.map((ins, i) => (
                  <button
                    key={i} data-testid={`insight-${ins.kind}`}
                    onClick={() => ins.url && navigate(ins.url)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-left text-sm transition-colors duration-150 ${
                      ins.kind === "baseline"
                        ? "border-border bg-card"
                        : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      {ins.text}
                    </span>
                    {ins.url && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <DistroChart testid="chart-workstream" title="What People Are Working On (Workstream)"
                             data={data.metrics.workstream_mix} type="bar" />
              </div>
              <DistroChart testid="chart-role" title="Role Mix" data={data.metrics.role_mix} type="pie" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <DistroChart testid="chart-status" title="Tasking Status Distribution"
                             data={data.metrics.status_distribution} type="bar" />
              </div>
              <DistroChart testid="chart-employment" title="Employment" data={data.metrics.employment_mix} type="pie" />
            </div>

            <div className="mt-4">
              <DistroChart testid="chart-project" title="Project Mix" data={data.metrics.project_mix} type="bar" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <HierPanel title="TPMs" items={data.hierarchy.tpms} onClick={(n) => navigate(`/tpms/${encodeURIComponent(n)}`)} icon={Users} testid="hier-tpms" />
              <HierPanel title="PODs" items={data.hierarchy.pods} onClick={(n) => navigate(`/pods/${encodeURIComponent(n)}`)} icon={Boxes} testid="hier-pods" />
            </div>
          </>
        )}
      </PageContainer>
    </>
  );
}

function MiniStat({ label, value, tone, testid }) {
  return (
    <div data-testid={testid} className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-xl font-semibold tabular ${tone}`}>{value}</div>
    </div>
  );
}

function HierPanel({ title, items, onClick, icon: Icon, testid }) {  const max = Math.max(...items.map((i) => i.headcount), 1);
  return (
    <div className="rounded-md border border-border bg-card p-4" data-testid={testid}>
      <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {title} · {items.length}
      </h3>
      <div className="thin-scroll max-h-80 space-y-1 overflow-y-auto pr-1">
        {items.map((it) => (
          <button key={it.name} onClick={() => onClick(it.name)}
                  className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
            <span className="w-40 truncate">{it.name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(it.headcount / max) * 100}%` }} />
            </span>
            <span className="w-8 text-right font-mono text-xs tabular">{it.headcount}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
