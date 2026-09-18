import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALL_PODS, buildFlagCsv, filterFlagRows, WORKFLOW_COLUMNS } from "@/lib/operationsFlags";

const FLAG_TABS = [
  { key: "leave", label: "Leave", description: "People marked Leave who still have task or progress data." },
  { key: "trinity", label: "Trinity", description: "Trinity taskers without an assigned target. Project leads are excluded." },
  { key: "manual", label: "Manual", description: "Manual taskers without an assigned target. Project leads are excluded." },
];

export default function OperationsFlags({ flags }) {
  const [tab, setTab] = useState("leave");
  const [pod, setPod] = useState(ALL_PODS);
  const navigate = useNavigate();
  const rows = flags[tab] || [];
  const pods = [...new Set(rows.map((row) => row.pod || "Unknown"))].sort((a, b) => a.localeCompare(b));
  const visibleRows = filterFlagRows(rows, pod);

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setPod(ALL_PODS);
  };

  const exportRows = () => {
    const blob = new Blob(["\uFEFF", buildFlagCsv(visibleRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const podPart = pod === ALL_PODS ? "all-pods" : pod.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    link.href = url;
    link.download = `${tab}-assignment-flags-${podPart || "unknown"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel mt-6 overflow-hidden" data-testid="operations-flags">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">Assignment checks</div>
        <h2 className="mt-1 font-heading text-xl font-bold">Data and tasking flags</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Leave rows should contain no task data. Trinity and Manual taskers need an assigned target unless they are project leads.
        </p>
      </div>
      <Tabs value={tab} onValueChange={changeTab} className="p-4 sm:p-5">
        <TabsList className="mb-4 grid h-auto w-full grid-cols-3">
          {FLAG_TABS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key} className="px-2 text-xs sm:text-sm" data-testid={`flag-tab-${key}`}>
              {label} ({flags[key]?.length || 0})
            </TabsTrigger>
          ))}
        </TabsList>
        {FLAG_TABS.map(({ key, description }) => (
          <TabsContent key={key} value={key}>
            <div className="mb-4 flex flex-col gap-3 rounded-xl bg-muted/55 p-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{description}</p>
                <p className="mt-1 text-xs font-medium text-foreground" aria-live="polite">
                  Showing {visibleRows.length} of {rows.length} flags
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  POD lead
                  <Select value={pod} onValueChange={setPod}>
                    <SelectTrigger className="w-full bg-card sm:w-[220px]" data-testid={`flag-pod-filter-${key}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_PODS}>All POD leads ({rows.length})</SelectItem>
                      {pods.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name} ({rows.filter((row) => row.pod === name).length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <Button variant="outline" onClick={exportRows} disabled={!visibleRows.length} data-testid={`flag-export-${key}`}>
                  <Download aria-hidden="true" />
                  Export CSV
                </Button>
              </div>
            </div>
            {visibleRows.length ? (
              <div className="overflow-x-auto thin-scroll">
                <table className="data-table min-w-[1240px]" data-testid={`flag-table-${key}`}>
                  <caption className="sr-only">{description}</caption>
                  <thead>
                    <tr>
                      <th className="px-4 py-2.5 text-left">Person</th>
                      <th className="px-3 py-2.5 text-left">POD lead</th>
                      <th className="px-3 py-2.5 text-left">Issue</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                      {WORKFLOW_COLUMNS.map(([field, label]) => <th key={field} className="px-3 py-2.5 text-center">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.email} onClick={() => navigate(`/users/${encodeURIComponent(row.email)}`)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") navigate(`/users/${encodeURIComponent(row.email)}`);
                          }}
                          tabIndex={0} role="link"
                          className="cursor-pointer border-b border-border/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{row.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{row.role || "No role"} · {row.email}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{row.pod || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{row.tpm || "No TPM"}</div>
                        </td>
                        <td className="max-w-[300px] px-3 py-2.5 text-sm">
                          <div className="font-medium text-amber-700 dark:text-amber-300">{row.reason}</div>
                          {row.remarks ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.remarks}</div> : null}
                        </td>
                        <td className="max-w-[260px] px-3 py-2.5 text-sm text-muted-foreground">{row.status}</td>
                        {WORKFLOW_COLUMNS.map(([field]) => (
                          <td key={field} className="px-3 py-2.5 text-center font-mono tabular">{row[field] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-500/5 px-4 py-6 text-center text-sm text-emerald-700 dark:text-emerald-300">
                No issues found for this rule.
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
