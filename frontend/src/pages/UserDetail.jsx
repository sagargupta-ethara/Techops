import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import api from "@/lib/api";
import { PageContainer } from "@/components/Page";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/format";

const GROUPS = {
  information: [
    ["tpm", "TPM"], ["pod_lead", "POD Lead"], ["role", "Role"], ["project_name", "Project Name"],
    ["internal_name", "Internal Name"], ["employment", "Intern/FTE"], ["tasking_status", "Tasking Status"],
    ["assigned_target", "Assigned Target"],
  ],
  trinity: [
    ["tracking_md", "Tracking.MD"], ["engram_run_count", "ENGRAM Run Count"], ["engram_phase", "ENGRAM phase"],
    ["directive_disposition", "DIRECTIVE.md"], ["forge_phase", "FORGE phase"], ["forge_run_count", "FORGE Run Count"],
    ["edict_disposition", "EDICT.md"], ["crucible_run_count", "CRUCIBLE Run Count"], ["crucible_phase", "CRUCIBLE phase"],
    ["verdict_disposition", "VERDICT.md"], ["completion_status", "Completion Status"],
    ["tasks_completed", "Tasks Completed"], ["crucible_verdict", "Crucible Verdict"], ["remarks", "Remarks"],
  ],
  manual: [
    ["input_bundles_created", "Input Bundles Created"], ["input_bundles_approved", "Bundles Approved"],
    ["trajectory_generated", "Trajectory Generated"], ["tasks_qced", "Tasks QCed"], ["remark", "Remark"],
  ],
};

const CLS_MAP = {
  added: "text-emerald-600 dark:text-emerald-400", removed: "text-rose-600 dark:text-rose-400",
  semantic: "text-primary", "raw-only": "text-muted-foreground",
};

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-words">{value || "—"}</span>
    </div>
  );
}

function Section({ title, fields, person }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h3 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {fields.map(([k, l]) => <Field key={k} label={l} value={person[k]} />)}
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight">{data.current.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> <span className="font-mono">{data.email}</span>
                <span>·</span> {data.current.pod} · {data.current.role}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.current.is_attention && <StatusBadge state="attention" text="Attention" size="lg" />}
              <span className="text-xs text-muted-foreground">
                {data.change_count} detected change{data.change_count === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4" data-testid="user-tabs">
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
              <Section title="Trinity" fields={GROUPS.trinity} person={data.current} />
              <Section title="Manual" fields={GROUPS.manual} person={data.current} />
            </TabsContent>

            <TabsContent value="history">
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <table className="w-full text-sm" data-testid="user-history-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Reporting Date</th>
                      <th className="px-4 py-2 font-medium">Rev</th>
                      <th className="px-4 py-2 font-medium">Tasking Status</th>
                      <th className="px-4 py-2 font-medium">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="px-4 py-2 font-mono">{h.reporting_date}</td>
                        <td className="px-4 py-2 font-mono">{h.revision}</td>
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
