import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import api from "@/lib/api";
import { PageContainer, CoverageBar } from "@/components/Page";
import KpiStat from "@/components/KpiStat";
import DistroChart from "@/components/DistroChart";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { pctText } from "@/lib/format";

const TRINITY_COLS = [
  ["engram_phase", "ENGRAM"], ["directive_disposition", "DIRECTIVE"],
  ["forge_phase", "FORGE"], ["edict_disposition", "EDICT"],
  ["crucible_phase", "CRUCIBLE"], ["verdict_disposition", "VERDICT"],
  ["completion_status", "Completion"],
];
const MANUAL_COLS = [
  ["input_bundles_created", "Bundles Created"], ["input_bundles_approved", "Bundles Approved"],
  ["trajectory_generated", "Trajectory"], ["tasks_qced", "QCed"],
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
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pod", name],
    queryFn: () => api.get(`/pods/${encodeURIComponent(name)}`).then((r) => r.data),
  });

  const people = (data?.people || []).filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.email.includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate("/pods")}
              className="mb-3 gap-1.5 text-muted-foreground" data-testid="back-button">
        <ArrowLeft className="h-4 w-4" /> All PODs
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
              {["overview", "people", "work-status", "trinity", "manual", "changes"].map((t) => (
                <TabsTrigger key={t} value={t} data-testid={`pod-tab-${t}`} className="capitalize">
                  {t.replace("-", " ")}
                  {t === "changes" && data.changes.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{data.changes.length}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiStat testid="pod-kpi-headcount" label="Headcount" value={data.metrics.headcount} accent />
                <KpiStat testid="pod-kpi-target" label="Target Coverage" value={pctText(data.metrics.target_coverage.pct)} />
                <KpiStat testid="pod-kpi-trinity" label="Trinity Coverage" value={pctText(data.metrics.trinity_coverage.pct)} />
                <KpiStat testid="pod-kpi-manual" label="Manual Coverage" value={pctText(data.metrics.manual_coverage.pct)} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DistroChart testid="pod-chart-status" title="Tasking Status" data={data.metrics.status_distribution} type="bar" />
                <DistroChart testid="pod-chart-role" title="Role Mix" data={data.metrics.role_mix} type="pie" />
              </div>
            </TabsContent>

            <TabsContent value="people">
              <PeopleFilter search={search} setSearch={setSearch} count={people.length} />
              <PeopleTable people={people} navigate={navigate}
                cols={[["role", "Role"], ["project_name", "Project"], ["tasking_status", "Status"]]}
                completeness testid="pod-people-table" />
            </TabsContent>

            <TabsContent value="work-status">
              <DistroChart testid="pod-ws-chart" title="Tasking Status Distribution" data={data.metrics.status_distribution} type="bar" />
              <div className="mt-4">
                <PeopleTable people={data.people} navigate={navigate}
                  cols={[["role", "Role"], ["tasking_status", "Tasking Status"], ["assigned_target", "Target"]]}
                  testid="pod-ws-table" />
              </div>
            </TabsContent>

            <TabsContent value="trinity">
              <PeopleTable people={data.people} navigate={navigate} cols={TRINITY_COLS} testid="pod-trinity-table" />
            </TabsContent>

            <TabsContent value="manual">
              <PeopleTable people={data.people} navigate={navigate} cols={MANUAL_COLS} testid="pod-manual-table" />
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

function PeopleFilter({ search, setSearch, count }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <Input data-testid="pod-people-search" placeholder="Search this POD…" value={search}
             onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs text-sm" />
      <span className="text-xs text-muted-foreground">{count} people</span>
    </div>
  );
}

function PeopleTable({ people, cols, navigate, completeness, testid }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card thin-scroll">
      <table className="w-full min-w-[640px] text-sm" data-testid={testid}>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Name</th>
            {cols.map(([k, label]) => <th key={k} className="px-4 py-2 font-medium">{label}</th>)}
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
              {cols.map(([k]) => <td key={k} className="px-4 py-2 text-muted-foreground">{p[k] || "—"}</td>)}
              {completeness && <td className="px-4 py-2"><CoverageBar value={p.completeness} /></td>}
              <td className="px-4 py-2">
                {p.is_attention && <StatusBadge state="attention" text="Attention" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
