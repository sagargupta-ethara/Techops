import { CompletionBadge } from "@/components/Page";
import { Input } from "@/components/ui/input";
import { cell } from "@/lib/format";

const COUNT_FIELDS = new Set([
  "engram_run_count", "forge_run_count", "tasks_created_after_forge", "crucible_run_count",
  "tasks_approved_after_crucible",
  "input_bundles_created", "input_bundles_approved", "trajectory_generated", "tasks_qced",
]);

export function PeopleFilter({ search, setSearch, count }) {
  return <div className="mb-3 flex items-center gap-3">
    <Input data-testid="pod-people-search" placeholder="Search this POD…" value={search}
           onChange={(event) => setSearch(event.target.value)} className="h-9 max-w-xs text-sm" />
    <span className="text-xs text-muted-foreground">{count} people</span>
  </div>;
}

export function PeopleTable({ people, cols, navigate, completeness, showInsight, testid }) {
  return <div className="thin-scroll overflow-x-auto rounded-md border border-border bg-card">
    <table className="w-full min-w-[640px] text-sm" data-testid={testid}>
      <thead><tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <th className="px-4 py-2 font-medium">Name</th>
        {cols.map(([key, label]) => <th key={key} className={`px-4 py-2 font-medium ${COUNT_FIELDS.has(key) ? "text-center" : ""}`}>{label}</th>)}
        {showInsight && <th className="px-4 py-2 font-medium">Working On</th>}
        {completeness && <th className="px-4 py-2 font-medium">Complete</th>}
      </tr></thead>
      <tbody>{people.map((person) => <tr key={person.email} data-testid={`people-row-${person.email}`}
        onClick={() => navigate(`/users/${encodeURIComponent(person.email)}`)} className="cursor-pointer border-b border-border/60 hover:bg-accent">
        <td className="px-4 py-2"><div className="font-medium">{person.name}</div><div className="font-mono text-[11px] text-muted-foreground">{person.email}</div></td>
        {cols.map(([key]) => {
          const value = COUNT_FIELDS.has(key) && (person[key] == null || String(person[key]).trim() === "") ? 0 : cell(person[key]);
          return <td key={key} className={`px-4 py-2 text-muted-foreground ${COUNT_FIELDS.has(key) ? "text-center font-mono tabular" : ""}`}>{value}</td>;
        })}
        {showInsight && <td className="max-w-[320px] px-4 py-2 text-xs text-muted-foreground">{person.progress?.insight || "No data"}</td>}
        {completeness && <td className="px-4 py-2"><CompletionBadge state={person.completion_state} /></td>}
      </tr>)}</tbody>
    </table>
  </div>;
}
