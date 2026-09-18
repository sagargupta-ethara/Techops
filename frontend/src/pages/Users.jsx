import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader, CompletionBadge } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cell } from "@/lib/format";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 25;

export default function Users() {
  const { queryString } = useFilters();
  const qs = queryString();
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  useEffect(() => setPage(0), [qs]);
  const pageQs = new URLSearchParams(qs);
  pageQs.set("limit", PAGE_SIZE);
  pageQs.set("offset", page * PAGE_SIZE);
  const { data, isLoading } = useQuery({
    queryKey: ["users", qs, page],
    queryFn: () => api.get(`/users?${pageQs}`).then((r) => r.data),
  });
  useEffect(() => {
    if (page > 0 && data && page * PAGE_SIZE >= data.total) setPage(Math.max(0, Math.ceil(data.total / PAGE_SIZE) - 1));
  }, [data, page]);

  return (
    <>
      <GlobalFilterBar />
      <PageContainer>
        <PageHeader
          title="Users Directory"
          subtitle={data ? `${data.total} people match current filters` : "People keyed by canonical email"}
        />
        {data && <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <DirectoryFact value={data.total} label="People in this view" detail="Updates with every active filter" />
          <DirectoryFact value={Math.ceil(data.total / PAGE_SIZE)} label="Result pages" detail={`${PAGE_SIZE} focused records per page`} />
          <DirectoryFact value={data.users?.filter((u) => u.completion_state !== "absent").length || 0} label="Active on this page" detail="Excludes people marked Leave" tone />
        </div>}
        {isLoading ? (
          <Skeleton className="h-96 rounded-md" />
        ) : data?.users?.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No people match the current filters.
          </div>
        ) : (
          <div className="panel">
            <div className="overflow-x-auto thin-scroll">
            <table className="data-table min-w-[820px]" data-testid="users-table">
              <caption className="sr-only">Users directory</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name / Email</th>
                  <th className="px-4 py-2.5 font-medium">POD</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Complete</th>
                </tr>
              </thead>
              <tbody>
                {data?.users?.map((u) => (
                  <tr key={u.email} data-testid={`users-table-row-${u.email}`}
                      onClick={() => navigate(`/users/${encodeURIComponent(u.email)}`)}
                      className="cursor-pointer border-b border-border/60 hover:bg-accent">
                    <td className="px-4 py-2.5">
                      <Link to={`/users/${encodeURIComponent(u.email)}`} onClick={(event) => event.stopPropagation()} className="font-medium hover:text-primary hover:underline">{u.name}</Link>
                      <div className="font-mono text-[11px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.pod || "No data"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.role || "No data"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.project_name || "No data"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {u.status_tokens?.length ? u.status_tokens.slice(0, 2).map((s) => (
                          <span key={s} className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{s}</span>
                        )) : <span className="text-[11px] text-muted-foreground">No data</span>}
                        {u.status_tokens?.length > 2 && (
                          <span className="text-[11px] text-muted-foreground">+{u.status_tokens.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><CompletionBadge state={u.completion_state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onPageChange={setPage} label="people" />
          </div>
        )}
      </PageContainer>
    </>
  );
}

function DirectoryFact({ value, label, detail, tone }) {
  return <div className="panel flex items-center gap-4 p-4"><div className={`flex h-12 min-w-12 items-center justify-center rounded-xl font-heading text-xl font-bold ${tone ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>{value}</div><div><div className="text-sm font-semibold">{label}</div><div className="mt-0.5 text-xs text-muted-foreground">{detail}</div></div></div>;
}
