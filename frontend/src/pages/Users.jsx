import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { PageContainer, PageHeader, CompletionBadge } from "@/components/Page";
import GlobalFilterBar from "@/components/GlobalFilterBar";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { cell } from "@/lib/format";

export default function Users() {
  const { queryString } = useFilters();
  const qs = queryString();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["users", qs],
    queryFn: () => api.get(`/users?${qs}`).then((r) => r.data),
  });

  return (
    <>
      <GlobalFilterBar />
      <PageContainer>
        <PageHeader
          title="Users Directory"
          subtitle={data ? `${data.total} people match current filters` : "People keyed by canonical email"}
        />
        {isLoading ? (
          <Skeleton className="h-96 rounded-md" />
        ) : data?.users?.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No people match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-card thin-scroll">
            <table className="w-full min-w-[820px] text-sm" data-testid="users-table">
              <caption className="sr-only">Users directory</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name / Email</th>
                  <th className="px-4 py-2.5 font-medium">POD</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Complete</th>
                  <th className="px-4 py-2.5 font-medium">Flag</th>
                </tr>
              </thead>
              <tbody>
                {data?.users?.map((u) => (
                  <tr key={u.email} data-testid={`users-table-row-${u.email}`}
                      onClick={() => navigate(`/users/${encodeURIComponent(u.email)}`)}
                      className="cursor-pointer border-b border-border/60 hover:bg-accent">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{u.name}</div>
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
                    <td className="px-4 py-2.5">{u.is_attention && <StatusBadge state="attention" text="Attention" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    </>
  );
}
