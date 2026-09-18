import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader } from "@/components/Page";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

const CLS_MAP = {
  added: "text-emerald-600 dark:text-emerald-400", removed: "text-rose-600 dark:text-rose-400",
  semantic: "text-primary", "raw-only": "text-muted-foreground",
};
const TABS = [
  { key: "all", label: "All Changes", filter: {} },
  { key: "people", label: "People Added/Removed", filter: {} },
  { key: "status", label: "Status Changes", filter: { group: "information" } },
  { key: "workflow", label: "Workflow Changes", filter: { group: "trinity" } },
  { key: "corrections", label: "Data Corrections", filter: { classification: "raw-only" } },
];

export default function Audit() {
  const { filters, setFilter, params } = useFilters();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const activeTab = params.get("audit_tab") || "all";

  const q = new URLSearchParams();
  if (filters.date) q.set("date", filters.date);
  if (filters.pod) q.set("pod", filters.pod);
  if (filters.search) q.set("search", filters.search);
  if (activeTab === "status") q.set("classification", "semantic");
  if (activeTab === "workflow") q.set("group", "trinity");
  if (activeTab === "corrections") q.set("classification", "raw-only");
  if (activeTab === "people") q.set("field", "_person");
  q.set("limit", PAGE_SIZE);
  q.set("offset", page * PAGE_SIZE);
  const qs = q.toString();

  useEffect(() => setPage(0), [filters.date, filters.pod, filters.search, activeTab]);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", qs, activeTab],
    queryFn: () => api.get(`/audit?${qs}`).then((r) => r.data),
  });

  const events = data?.events || [];
  const resultTotal = data?.total || 0;
  useEffect(() => {
    if (page > 0 && data && page * PAGE_SIZE >= data.total) setPage(Math.max(0, Math.ceil(data.total / PAGE_SIZE) - 1));
  }, [data, page]);

  return (
    <PageContainer>
      <PageHeader title="Audit" subtitle="Append-only detected-change history. Not an editor activity log." />

      {data?.summary && <section className="mb-5 grid gap-4 rounded-2xl bg-[hsl(var(--hero))] p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div><div className="text-[11px] font-semibold uppercase tracking-[.16em] text-teal-300">Change intelligence</div><h2 className="mt-2 font-heading text-2xl font-bold">{data.total} changes in this view</h2><p className="mt-1 text-sm text-slate-300">Separate meaningful workflow movement from raw source corrections.</p></div>
        <div className="flex gap-6 sm:text-right"><div><div className="font-heading text-2xl font-bold text-teal-300">{data.summary.semantic}</div><div className="text-xs text-slate-400">Semantic</div></div><div><div className="font-heading text-2xl font-bold text-amber-300">{data.summary.raw_only}</div><div className="text-xs text-slate-400">Raw only</div></div></div>
      </section>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border" data-testid="audit-tabs">
        {TABS.map((t) => (
          <button key={t.key} data-testid={`audit-tab-${t.key}`}
                  onClick={() => setFilter("audit_tab", t.key === "all" ? "" : t.key)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
            {t.label}
          </button>
        ))}
      </div>

      {data?.summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Added", data.summary.added, "text-emerald-500"], ["Removed", data.summary.removed, "text-rose-500"],
            ["Semantic", data.summary.semantic, "text-primary"], ["Raw-only", data.summary.raw_only, "text-muted-foreground"]].map(([l, v, c]) => (
            <div key={l} className="rounded-md border border-border bg-card p-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{l}</div>
              <div className={`mt-1 font-mono text-xl font-semibold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input data-testid="audit-search" placeholder="Search person…" value={filters.search || ""}
               onChange={(e) => setFilter("search", e.target.value)} className="h-9 max-w-xs text-sm" />
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-md" />
      ) : events.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No change events for this view. On a fresh baseline, changes appear after the next reporting date is synced.
        </div>
      ) : (
        <div className="panel">
          <div className="overflow-x-auto thin-scroll">
          <table className="data-table min-w-[760px]" data-testid="audit-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Detected (IST)</th>
                <th className="px-4 py-2 font-medium">Person</th>
                <th className="px-4 py-2 font-medium">POD</th>
                <th className="px-4 py-2 font-medium">Field</th>
                <th className="px-4 py-2 font-medium">Before</th>
                <th className="px-4 py-2 font-medium">After</th>
                <th className="px-4 py-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} data-testid={`audit-row-${e.id}`}
                    onClick={() => navigate(`/users/${encodeURIComponent(e.email)}`)}
                    className="cursor-pointer border-b border-border/60 hover:bg-accent">
                  <td className="px-4 py-2 font-mono text-xs">{fmtDate(e.detected_at)}</td>
                  <td className="px-4 py-2"><Link to={`/users/${encodeURIComponent(e.email)}`} onClick={(event) => event.stopPropagation()} className="font-medium hover:text-primary hover:underline">{e.name}</Link></td>
                  <td className="px-4 py-2 text-muted-foreground">{e.pod}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.field_label}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs" title={e.before || ""}>{e.before || "—"}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs" title={e.after || ""}>{e.after || "—"}</td>
                  <td className={`px-4 py-2 text-xs font-medium ${CLS_MAP[e.classification]}`}>{e.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={resultTotal} onPageChange={setPage} label="changes" />
        </div>
      )}
    </PageContainer>
  );
}
