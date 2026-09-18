import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Users, Boxes, TrendingUp, ArrowRight, Layers, ClipboardList, Wrench, UserMinus, CircleCheckBig, LoaderCircle } from "lucide-react";
import api from "@/lib/api";
import { PageContainer } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import DistroChart from "@/components/DistroChart";
import { Skeleton } from "@/components/ui/skeleton";
import { pctText } from "@/lib/format";
import { ManualFunnel, TrinityFunnel } from "@/components/PhaseSummary";
import OperationsFlags from "@/components/OperationsFlags";

export default function Overview() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get(`/overview`).then((r) => r.data),
  });

  return (
    <>
      <PageContainer>
        {isLoading || !data?.metrics ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <section className="relative overflow-hidden rounded-2xl bg-[hsl(var(--hero))] p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
                <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
                <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-teal-300">Today’s operating picture</div>
                    <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold leading-tight tracking-[-.035em] sm:text-4xl">{data.metrics.headcount} people across {data.hierarchy.pods.length} PODs.</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                      Assignment totals can overlap when a person works on both Trinity and Manual. “Active in progress” removes leave, completed work, and project leads without a target.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-200 lg:justify-end">
                    <span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5">{data.hierarchy.tpms.length} TPMs</span>
                    <span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5">Reporting date {data.reporting_date}</span>
                  </div>
                </div>
              </section>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6" data-testid="overview-kpi-grid">
              <KpiStat testid="kpi-trinity" label="Assigned to Trinity" value={data.operations.counts.trinity} icon={Layers} accent sub="Includes dual-assigned people" to="/users?operation=trinity" />
              <KpiStat testid="kpi-manual" label="Assigned to Manual" value={data.operations.counts.manual} icon={ClipboardList} sub="Dataset, trajectory, QC or rework" to="/users?operation=manual" />
              <KpiStat testid="kpi-harness" label="People on Harness" value={data.operations.counts.harness} icon={Wrench} sub="Harness or generation kit" to="/users?operation=harness" />
              <KpiStat testid="kpi-absent" label="Absent" value={data.metrics.completion.absent} icon={UserMinus} sub="Marked Leave" to="/users?completeness=absent" />
              <KpiStat testid="kpi-complete" label="Completed" value={data.metrics.completion.complete} icon={CircleCheckBig} sub={`${pctText(data.metrics.completion.pct)} of active people`} to="/users?completeness=complete" />
              <ProgressBreakdown values={data.operations.in_progress} assigned={data.operations.counts} />
            </div>

            {data.insights?.length > 0 && (
              <div className="mb-6 grid gap-2 md:grid-cols-2" data-testid="insights">
                {data.insights.map((ins, i) => (
                  <button
                    key={i} data-testid={`insight-${ins.kind}`}
                    onClick={() => ins.url && navigate(ins.url)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors duration-150 ${
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

            <div className="grid gap-4 lg:grid-cols-2">
              <TrinityFunnel trinity={data.operations.trinity} testid="overview-trinity-funnel" />
              <ManualFunnel manual={data.operations.manual} testid="overview-manual-funnel" />
            </div>

            <section className="panel mt-4 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">Manual tasking logic</div>
              <h2 className="mt-1 font-heading text-xl font-bold">Read progress from the furthest completed stage</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/65 p-3 text-sm"><strong className="block text-foreground">Manual dataset creation</strong><span className="text-muted-foreground">Track bundles created, bundles approved, trajectories generated, and tasks QCed.</span></div>
                <div className="rounded-lg bg-muted/65 p-3 text-sm"><strong className="block text-foreground">Manual QC</strong><span className="text-muted-foreground">Use approved bundles, trajectories generated, and tasks QCed to identify the final stage reached.</span></div>
              </div>
            </section>

            <OperationsFlags flags={data.operations.flags} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <DistroChart testid="chart-workstream" title="What People Are Working On (Workstream)"
                             data={data.metrics.workstream_mix} type="bar" />
              </div>
              <div className="lg:col-span-2"><DistroChart testid="chart-role" title="Role Mix" data={data.metrics.role_mix} type="pie" /></div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <DistroChart testid="chart-status" title="Tasking Status Distribution"
                             data={data.metrics.status_distribution} type="bar" />
              </div>
              <div className="lg:col-span-2"><DistroChart testid="chart-employment" title="Employment" data={data.metrics.employment_mix} type="pie" /></div>
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

function ProgressBreakdown({ values, assigned }) {
  return (
    <div data-testid="kpi-progress" className="card-lift relative min-h-[132px] overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
      <span className="absolute bottom-0 left-0 top-0 w-1 bg-border" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Active in progress</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><LoaderCircle className="h-4 w-4" aria-hidden="true" /></span>
      </div>
      <div className="mt-3 grid grid-cols-2 divide-x divide-border rounded-lg bg-muted/65 py-2">
        <Link to="/users?operation=trinity_in_progress" aria-label="View Trinity people in progress" className="rounded-md px-2 transition-colors hover:bg-accent/70" data-testid="kpi-progress-trinity"><div className="font-heading text-2xl font-bold tabular">{values.trinity}</div><div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground"><span>Trinity<span className="hidden sm:inline"> · {Math.max(assigned.trinity - values.trinity, 0)} not active</span></span><ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" /></div></Link>
        <Link to="/users?operation=manual_in_progress" aria-label="View Manual people in progress" className="rounded-md px-3 transition-colors hover:bg-accent/70" data-testid="kpi-progress-manual"><div className="font-heading text-2xl font-bold tabular">{values.manual}</div><div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground"><span>Manual<span className="hidden sm:inline"> · {Math.max(assigned.manual - values.manual, 0)} not active</span></span><ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" /></div></Link>
      </div>
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
