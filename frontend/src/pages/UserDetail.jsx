import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { PageContainer, CompletionBadge } from "@/components/Page";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtDate, cell } from "@/lib/format";

const GROUPS = {
  information: [
    ["tpm", "TPM"], ["pod_lead", "POD Lead"], ["role", "Role"], ["project_name", "Project Name"],
    ["internal_name", "Internal Name"], ["employment", "Intern/FTE"], ["tasking_status", "Tasking Status"],
    ["assigned_target", "Assigned Target"],
  ],
  trinity: [
    ["tracking_md", "Tracking.MD"], ["engram_run_count", "ENGRAM Run Count"], ["engram_phase", "ENGRAM phase"],
    ["directive_disposition", "DIRECTIVE.md"], ["forge_phase", "FORGE phase"], ["forge_run_count", "FORGE Run Count"],
    ["edict_disposition", "EDICT.md"], ["tasks_created_after_forge", "Staged after Forge"],
    ["crucible_run_count", "CRUCIBLE Run Count"], ["crucible_phase", "CRUCIBLE phase"],
    ["verdict_disposition", "VERDICT.md"], ["completion_status", "Completion Status"],
    ["tasks_approved_after_crucible", "Approved after Crucible"],
    ["crucible_verdict", "Crucible Verdict"], ["remarks", "Remarks"],
  ],
  manual: [
    ["input_bundles_created", "Manual Staged"], ["input_bundles_approved", "Bundles Approved"],
    ["trajectory_generated", "Trajectory Generated"], ["tasks_qced", "Tasks QCed"], ["remarks", "Remarks"],
  ],
};

const CLS_MAP = {
  added: "text-emerald-600 dark:text-emerald-400", removed: "text-rose-600 dark:text-rose-400",
  semantic: "text-primary", "raw-only": "text-muted-foreground",
};

const ZERO_COUNT_FIELDS = new Set([
  "assigned_target", "engram_run_count", "forge_run_count", "crucible_run_count",
  "tasks_created_after_forge", "tasks_approved_after_crucible",
  "input_bundles_created", "input_bundles_approved", "trajectory_generated", "tasks_qced",
]);
const WIDE_FIELDS = new Set(["tracking_md", "remarks"]);

function Field({ label, value, zeroWhenEmpty = false, wide = false }) {
  const empty = value == null || String(value).trim() === "";
  return (
    <div className={`grid gap-1 border-b border-border/50 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words font-medium [overflow-wrap:anywhere] ${wide ? "text-left" : "sm:text-right"}`}>
        {zeroWhenEmpty && empty ? 0 : cell(value)}
      </span>
    </div>
  );
}

function Section({ title, fields, person }) {
  return (
    <div className="rounded-md border border-border bg-card p-4" data-testid={`section-${title.toLowerCase()}`}>
      <h3 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        {fields.map(([k, l]) => (
          <Field key={k} label={l} value={person[k]}
                 zeroWhenEmpty={ZERO_COUNT_FIELDS.has(k)} wide={WIDE_FIELDS.has(k)} />
        ))}
      </div>
    </div>
  );
}

export default function UserDetail() {
  const { email } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("summary");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["user", email],
    queryFn: () => api.get(`/users/${encodeURIComponent(email)}`).then((r) => r.data),
  });

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}
              className="mb-3 gap-1.5 text-muted-foreground" data-testid="back-button">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      {isError ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">User not found.</div>
      ) : isLoading || !data ? (
        <Skeleton className="h-96 rounded-md" />
      ) : (
        <>
          <section className="mb-5 rounded-2xl bg-[hsl(var(--hero))] p-6 text-white shadow-xl shadow-emerald-950/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="text-[11px] font-semibold uppercase tracking-[.16em] text-teal-300">People intelligence</div>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">{cell(data.current.name)}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <Mail className="h-3.5 w-3.5" /> <span className="font-mono">{data.email}</span>
                <span>·</span> {cell(data.current.pod)} · {cell(data.current.role)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CompletionBadge state={data.current.completion_state} />
              {data.current.absent && <StatusBadge state="stale" text="Absent" />}
            </div>
          </div>
          <div className="mt-5 border-t border-white/10 pt-4" data-testid="user-insight">
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
              <div>
                <div className="font-medium">Working on: {data.current.workstream_label || "No workstream"}</div>
                <div className="mt-0.5 text-slate-300">{data.current.progress?.insight || "No workstream data recorded."}</div>
                {data.last_changed_at && (
                  <div className="mt-1 text-xs text-slate-400">Last detected change {fmtDate(data.last_changed_at)} · {data.change_count} total</div>
                )}
              </div>
            </div>
          </div>
          </section>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="thin-scroll mb-4 flex w-full justify-start overflow-x-auto" data-testid="user-tabs">
              <TabsTrigger value="summary" data-testid="user-tab-summary">Summary</TabsTrigger>
              <TabsTrigger value="current" data-testid="user-tab-current">Current Status</TabsTrigger>
              <TabsTrigger value="history" data-testid="user-tab-history">Daily History</TabsTrigger>
              <TabsTrigger value="audit" data-testid="user-tab-audit">Audit Trail</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <Section title="Information" fields={GROUPS.information} person={data.current} />
            </TabsContent>

            <TabsContent value="current" className="space-y-4">
              <Section title="Information" fields={GROUPS.information} person={data.current} />
              {data.current.progress?.show_trinity && (
                <Section title="Trinity" fields={GROUPS.trinity} person={data.current} />
              )}
              {data.current.progress?.show_manual && (
                <Section title="Manual" fields={GROUPS.manual} person={data.current} />
              )}
              {!data.current.progress?.show_trinity && !data.current.progress?.show_manual && (
                <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  No Trinity or Manual workstream data for this person.
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <table className="w-full text-sm" data-testid="user-history-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Reporting Date</th>
                      <th className="px-4 py-2 text-center font-medium">Rev</th>
                      <th className="px-4 py-2 font-medium">Tasking Status</th>
                      <th className="px-4 py-2 font-medium">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="px-4 py-2 font-mono">{h.reporting_date}</td>
                        <td className="px-4 py-2 text-center font-mono">{h.revision}</td>
                        <td className="px-4 py-2">{h.person.tasking_status || "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{h.person.completion_status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.history.length <= 1 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Only baseline captured so far. History grows as new reporting dates are synced.
                </p>
              )}
            </TabsContent>

            <TabsContent value="audit">
              {data.audit.length === 0 ? (
                <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  No detected changes yet for this person.
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                  <table className="w-full text-sm" data-testid="user-audit-table">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Detected (IST)</th>
                        <th className="px-4 py-2 font-medium">Field</th>
                        <th className="px-4 py-2 font-medium">Before</th>
                        <th className="px-4 py-2 font-medium">After</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.audit.map((e) => (
                        <tr key={e.id} className="border-b border-border/60">
                          <td className="px-4 py-2 font-mono text-xs">{fmtDate(e.detected_at)}</td>
                          <td className="px-4 py-2">{e.field_label}</td>
                          <td className="px-4 py-2 font-mono text-xs">{e.before || "—"}</td>
                          <td className="px-4 py-2 font-mono text-xs">{e.after || "—"}</td>
                          <td className={`px-4 py-2 text-xs font-medium ${CLS_MAP[e.classification]}`}>{e.classification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Changes are polling-detected (every 60s). Polling cannot identify the source editor or capture edits that revert between polls.
              </p>
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageContainer>
  );
}
