import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { PageContainer, CompletionBadge } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import DistroChart from "@/components/DistroChart";
import BlockerCard from "@/components/pod/BlockerCard";
import { PeopleFilter, PeopleTable } from "@/components/pod/PodPeopleTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RunsSummaryCards, TrinityFunnel, TrinityMatrix, ManualFunnel } from "@/components/PhaseSummary";
import { toast } from "sonner";
import { pctText, fmtDate } from "@/lib/format";

const TRINITY_COLS = [
  ["tracking_md", "Tracking.MD"], ["engram_run_count", "ENGRAM Runs"], ["engram_phase", "ENGRAM phase"],
  ["directive_disposition", "DIRECTIVE.md"], ["forge_phase", "FORGE phase"], ["forge_run_count", "FORGE Runs"],
  ["edict_disposition", "EDICT.md"], ["tasks_created_after_forge", "Staged after Forge"],
  ["crucible_run_count", "CRUCIBLE Runs"], ["crucible_phase", "CRUCIBLE phase"],
  ["verdict_disposition", "VERDICT.md"], ["completion_status", "Completion"],
  ["tasks_approved_after_crucible", "Approved after Crucible"],
  ["crucible_verdict", "Crucible Verdict"], ["remarks", "Remarks"],
];
const MANUAL_COLS = [
  ["input_bundles_created", "Manual Staged"], ["input_bundles_approved", "Bundles Approved"],
  ["trajectory_generated", "Trajectory"], ["tasks_qced", "Tasks QCed"], ["remarks", "Remarks"],
];

const CLS_MAP = {
  added: "text-emerald-600 dark:text-emerald-400",
  removed: "text-rose-600 dark:text-rose-400",
  semantic: "text-primary",
  "raw-only": "text-muted-foreground",
};

export default function PodDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedDate = params.get("date") || "";
  const dateQuery = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : "";
  const [tab, setTab] = useState("overall");
  const [search, setSearch] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pod", name, selectedDate],
    queryFn: () => api.get(`/pods/${encodeURIComponent(name)}${dateQuery}`).then((r) => r.data),
  });

  const current = analysis || data?.blocker_analysis;
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data: res } = await api.post(`/pods/${encodeURIComponent(name)}/analyze${dateQuery}`);
      setAnalysis(res);
      toast.success("Blocker analysis ready");
    } catch (e) {
      toast.error("Analysis failed", { description: e.response?.data?.detail || e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const people = (data?.people || []).filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.email.includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}
              className="mb-3 gap-1.5 text-muted-foreground hover:text-foreground" data-testid="back-button">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {isError ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">POD not found or not authorized.</div>
      ) : isLoading || !data ? (
        <Skeleton className="h-96 rounded-md" />
      ) : (
        <>
          <section className="mb-5 overflow-hidden rounded-2xl bg-[hsl(var(--hero))] p-6 text-white shadow-xl shadow-emerald-950/10">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-teal-300">POD operating brief</div>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">{name}</h1>
            <p className="mt-2 text-sm text-slate-300">Led under {data.tpm} · reporting date {data.reporting_date}</p>
            <p className="mt-4 max-w-4xl border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">{data.overview_insight}</p>
          </section>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1 overflow-x-auto" data-testid="pod-tabs">
              {["overall", "trinity", "manual", "people", "changes"].map((t) => (
                <TabsTrigger key={t} value={t} data-testid={`pod-tab-${t}`} className="capitalize">
                  {t}
                  {t === "changes" && data.changes.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{data.changes.length}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overall">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiStat testid="pod-kpi-headcount" label="Headcount" value={data.metrics.headcount} accent />
                <KpiStat testid="pod-kpi-complete" label="Complete" value={data.metrics.completion.complete} />
                <KpiStat testid="pod-kpi-progress" label="In progress" value={data.metrics.completion.incomplete} />
                <KpiStat testid="pod-kpi-absent" label="Absent (Leave)" value={data.counts.on_leave} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-testid="pod-counts">
                {[["Trinity", data.counts.trinity], ["Manual", data.counts.manual],
                  ["Harness / G. Kit", data.counts.harness], ["Manual QC", data.counts.manual_qc],
                  ["Absent", data.counts.on_leave]].map(([l, v]) => (
                  <div key={l} className="rounded-md border border-border bg-card px-3 py-2.5 text-center">
                    <div className="font-mono text-xl font-semibold tabular">{v}</div>
                    <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <h3 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Runs & Phase Status
                </h3>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <TrinityFunnel trinity={data.phase_summary.trinity} testid="overall-trinity-progress" />
                  <ManualFunnel manual={data.phase_summary.manual} testid="overall-manual" />
                </div>
              </div>

              <BlockerCard current={current} analyzing={analyzing} onRun={runAnalysis} />

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DistroChart testid="pod-chart-workstream" title="What People Are Working On" data={data.metrics.workstream_mix} type="bar" />
                <DistroChart testid="pod-chart-role" title="Role Mix" data={data.metrics.role_mix} type="pie" />
              </div>

              <div className="mt-4 rounded-md border border-border bg-card">
                <div className="border-b border-border px-4 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Member Summary — what each person is doing
                </div>
                <ul className="thin-scroll max-h-[560px] divide-y divide-border/60 overflow-y-auto" data-testid="pod-member-insights">
                  {data.member_insights.map((mi) => (
                    <li key={mi.email} data-testid={`member-insight-${mi.email}`}
                        onClick={() => navigate(`/users/${encodeURIComponent(mi.email)}`)}
                        className="flex cursor-pointer flex-col gap-1 px-4 py-3 hover:bg-accent sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{mi.name}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{mi.role || "No role"}</span>
                          <span className="text-xs text-muted-foreground">{mi.status}</span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{mi.insight}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <CompletionBadge state={mi.completion_state} />
                        <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {mi.last_updated ? fmtDate(mi.last_updated) : "no change yet"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="trinity">
              <TrinityFunnel trinity={data.phase_summary.trinity} testid="trinity-progress" />
              <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Runs by area
              </h3>
              <RunsSummaryCards runs={data.phase_summary.trinity.runs_summary} testid="trinity-runs" />
              <h3 className="mb-3 mt-5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Phase status
              </h3>
              <TrinityMatrix trinity={data.phase_summary.trinity} testid="trinity-matrix" />
              <h3 className="mb-3 mt-5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                People
              </h3>
              <PeopleTable people={data.people} navigate={navigate} cols={TRINITY_COLS} completeness testid="pod-trinity-table" />
            </TabsContent>

            <TabsContent value="manual">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ManualFunnel manual={data.phase_summary.manual} testid="manual-funnel" />
                <DistroChart testid="pod-manual-status" title="Manual Tasking Status" data={data.metrics.status_distribution} type="bar" />
              </div>
              <h3 className="mb-3 mt-5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                People
              </h3>
              <PeopleTable people={data.people} navigate={navigate} cols={MANUAL_COLS} completeness testid="pod-manual-table" />
            </TabsContent>

            <TabsContent value="people">
              <PeopleFilter search={search} setSearch={setSearch} count={people.length} />
              <PeopleTable people={people} navigate={navigate}
                cols={[["role", "Role"], ["project_name", "Project"], ["tasking_status", "Status"]]}
                showInsight completeness testid="pod-people-table" />
            </TabsContent>

            <TabsContent value="changes">
              {data.changes.length === 0 ? (
                <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  No detected changes for this reporting date revision. (Polling detects changes between syncs; it cannot capture edits that revert between polls.)
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                  <table className="w-full text-sm" data-testid="pod-changes-table">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Person</th>
                        <th className="px-4 py-2 font-medium">Field</th>
                        <th className="px-4 py-2 font-medium">Before</th>
                        <th className="px-4 py-2 font-medium">After</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.changes.map((c) => (
                        <tr key={c.id} className="border-b border-border/60">
                          <td className="px-4 py-2">{c.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{c.field_label}</td>
                          <td className="px-4 py-2 font-mono text-xs">{c.before || "—"}</td>
                          <td className="px-4 py-2 font-mono text-xs">{c.after || "—"}</td>
                          <td className={`px-4 py-2 text-xs font-medium ${CLS_MAP[c.classification]}`}>{c.classification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageContainer>
  );
}
