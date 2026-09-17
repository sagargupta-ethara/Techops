import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Clock, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { PageContainer, CompletionBadge } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import DistroChart from "@/components/DistroChart";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RunsSummaryCards, TrinityMatrix, ManualFunnel } from "@/components/PhaseSummary";
import { toast } from "sonner";
import { pctText, cell, fmtDate } from "@/lib/format";

const TRINITY_COLS = [
  ["tracking_md", "Tracking.MD"], ["engram_run_count", "ENGRAM Runs"], ["engram_phase", "ENGRAM phase"],
  ["directive_disposition", "DIRECTIVE.md"], ["forge_phase", "FORGE phase"], ["forge_run_count", "FORGE Runs"],
  ["edict_disposition", "EDICT.md"], ["crucible_run_count", "CRUCIBLE Runs"], ["crucible_phase", "CRUCIBLE phase"],
  ["verdict_disposition", "VERDICT.md"], ["completion_status", "Completion"], ["tasks_completed", "Tasks Done"],
  ["crucible_verdict", "Crucible Verdict"], ["remarks", "Remarks"],
];
const MANUAL_COLS = [
  ["input_bundles_created", "Bundles Created"], ["input_bundles_approved", "Bundles Approved"],
  ["trajectory_generated", "Trajectory"], ["tasks_qced", "Tasks QCed"], ["remark", "Remark"],
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
  const [tab, setTab] = useState("overall");
  const [search, setSearch] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pod", name],
    queryFn: () => api.get(`/pods/${encodeURIComponent(name)}`).then((r) => r.data),
  });

  const current = analysis || data?.blocker_analysis;
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data: res } = await api.post(`/pods/${encodeURIComponent(name)}/analyze`);
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
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">TPM · {data.tpm} · Reporting date {data.reporting_date}</p>
            </div>
          </div>

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
              <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-4" data-testid="pod-overview-insight">
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{data.overview_insight}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiStat testid="pod-kpi-headcount" label="Headcount" value={data.metrics.headcount} accent />
                <KpiStat testid="pod-kpi-complete" label="Complete"
                         value={data.metrics.completion.complete}
                         sub={`${data.metrics.completion.incomplete} in progress`} />
                <KpiStat testid="pod-kpi-absent" label="Absent (Leave)" value={data.counts.on_leave} />
                <KpiStat testid="pod-kpi-attention" label="Attention" value={data.metrics.attention}
                         sub={data.metrics.no_remark ? `${data.metrics.no_remark} no remark` : ""} />
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
                  <div className="space-y-4">
                    <RunsSummaryCards runs={data.phase_summary.trinity.runs_summary} testid="overall-runs" />
                    <TrinityMatrix trinity={data.phase_summary.trinity} testid="overall-matrix" />
                  </div>
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
                <ul className="divide-y divide-border/60" data-testid="pod-member-insights">
                  {data.member_insights.map((mi) => (
                    <li key={mi.email} data-testid={`member-insight-${mi.email}`}
                        onClick={() => navigate(`/users/${encodeURIComponent(mi.email)}`)}
                        className="flex cursor-pointer flex-col gap-1 px-4 py-3 hover:bg-accent sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{mi.name}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{mi.role || "No role"}</span>
                          <span className="text-xs text-muted-foreground">{mi.status}</span>
                          {mi.is_attention && <StatusBadge state="attention" text="Attention" />}
                          {mi.flags?.includes("no remark") && <StatusBadge state="stale" text="No remark" />}
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

function BlockerCard({ current, analyzing, onRun }) {
  const r = current?.result;
  return (
    <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-4" data-testid="blocker-analysis">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          <Sparkles className="h-4 w-4" /> AI Blocker Analysis
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal">Claude Haiku</span>
        </h3>
        <Button size="sm" variant="outline" onClick={onRun} disabled={analyzing}
                data-testid="run-blocker-analysis" className="h-8 gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`} />
          {analyzing ? "Analyzing remarks…" : current ? "Re-run" : "Analyze remarks"}
        </Button>
      </div>

      {!current && !analyzing && (
        <p className="mt-2 text-sm text-muted-foreground">
          Run an AI pass over every member remark to surface why completion is stuck and the top blockers.
        </p>
      )}

      {r && (
        <div className="mt-3 space-y-3 text-sm" data-testid="blocker-result">
          <p className="font-medium">{r.headline}</p>
          {r.blockers?.length > 0 && (
            <ul className="space-y-1.5">
              {r.blockers.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-xs text-amber-700 dark:text-amber-400">
                    {b.count ?? "?"}
                  </span>
                  <span><span className="font-medium">{b.issue}</span> — <span className="text-muted-foreground">{b.detail}</span></span>
                </li>
              ))}
            </ul>
          )}
          {r.recommendation && (
            <div className="rounded border border-border bg-card p-2.5">
              <span className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Recommendation</span>
              <p className="mt-0.5">{r.recommendation}</p>
            </div>
          )}
          {current?.generated_at && (
            <p className="text-[11px] text-muted-foreground">
              Generated {fmtDate(current.generated_at)}{r.no_remark_count != null ? ` · ${r.no_remark_count} entries had no remark` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PeopleFilter({ search, setSearch, count }) {  return (
    <div className="mb-3 flex items-center gap-3">
      <Input data-testid="pod-people-search" placeholder="Search this POD…" value={search}
             onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs text-sm" />
      <span className="text-xs text-muted-foreground">{count} people</span>
    </div>
  );
}

function PeopleTable({ people, cols, navigate, completeness, showInsight, testid }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card thin-scroll">
      <table className="w-full min-w-[640px] text-sm" data-testid={testid}>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Name</th>
            {cols.map(([k, label]) => <th key={k} className="px-4 py-2 font-medium">{label}</th>)}
            {showInsight && <th className="px-4 py-2 font-medium">Working On</th>}
            {completeness && <th className="px-4 py-2 font-medium">Complete</th>}
            <th className="px-4 py-2 font-medium">Flag</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.email} data-testid={`people-row-${p.email}`}
                onClick={() => navigate(`/users/${encodeURIComponent(p.email)}`)}
                className="cursor-pointer border-b border-border/60 hover:bg-accent">
              <td className="px-4 py-2">
                <div className="font-medium">{p.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{p.email}</div>
              </td>
              {cols.map(([k]) => <td key={k} className="px-4 py-2 text-muted-foreground">{cell(p[k])}</td>)}
              {showInsight && (
                <td className="px-4 py-2 text-xs text-muted-foreground max-w-[320px]">
                  {p.progress?.insight || "No data"}
                </td>
              )}
              {completeness && <td className="px-4 py-2"><CompletionBadge state={p.completion_state} /></td>}
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {p.is_attention && <StatusBadge state="attention" text="Attention" />}
                  {p.progress?.flags?.includes("no remark") && <StatusBadge state="stale" text="No remark" />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
