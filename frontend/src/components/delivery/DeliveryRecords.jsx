import { useMemo, useState } from "react";
import { ArrowDownUp, ClipboardList } from "lucide-react";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";

const COLUMNS = [
  ["project_name", "Project"], ["project_category", "Category"], ["pod_lead", "Pod lead"],
  ["quality_lead", "Quality lead"], ["tpm", "TPM"], ["task_id", "Task ID"],
  ["task", "Task"], ["task_type", "Task type"], ["authors", "Authors"],
  ["author_emails", "Author emails"], ["delivery_date", "Delivery date"], ["client_feedback", "Client feedback"],
];

function taskValue(task, column) {
  if (column === "authors") return task.authors.length ? task.authors.map((author) => author.name || author.email).join(", ") : "NA";
  if (column === "author_emails") return task.authors.length ? task.authors.map((author) => author.email || "NA").join(", ") : "NA";
  return task[column] || "NA";
}

export default function DeliveryRecords({ tasks }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ key: "delivery_date", direction: "desc" });
  const pageSize = 15;
  const sorted = useMemo(() => [...tasks].sort((left, right) => {
    const a = String(left[sort.key] || "");
    const b = String(right[sort.key] || "");
    return a.localeCompare(b) * (sort.direction === "asc" ? 1 : -1);
  }), [tasks, sort]);
  const current = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const changeSort = (key) => {
    setSort((currentSort) => ({ key, direction: currentSort.key === key && currentSort.direction === "asc" ? "desc" : "asc" }));
    setPage(0);
  };
  return <section className="panel" data-testid="delivery-records">
    <div className="panel-header block"><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Source records</div>
      <h3 className="mt-1 panel-title flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Detailed delivery table · {tasks.length} unique tasks</h3></div>
    <div className="thin-scroll overflow-x-auto">
      <table className="data-table min-w-[1720px]">
        <caption className="sr-only">Detailed unique delivery records from Google Sheets</caption>
        <thead><tr>{COLUMNS.map(([key, label], index) => <th key={key} className={index === 0 ? "sticky left-0 z-20 bg-muted" : ""}>
          {!["authors", "author_emails", "client_feedback"].includes(key) ? <Button variant="ghost" size="sm" className="-ml-3 h-7 px-2 text-[11px] uppercase tracking-[.08em]" onClick={() => changeSort(key)}>
            {label}<ArrowDownUp className="h-3 w-3" /></Button> : label}
        </th>)}</tr></thead>
        <tbody>{current.map((task) => <tr key={task.task_id}>{COLUMNS.map(([key], index) => {
          const value = taskValue(task, key);
          return <td key={key}
            className={`${index === 0 ? "sticky left-0 z-[1] bg-card" : ""} max-w-[220px] truncate whitespace-nowrap ${key === "task_id" ? "font-mono text-xs" : ""} ${key === "client_feedback" && task.client_feedback === "NA" ? "font-mono text-muted-foreground" : ""}`}
            title={value}>{value}</td>;
        })}</tr>)}</tbody>
      </table>
      {!tasks.length && <div className="py-12 text-center text-sm text-muted-foreground">No delivery records match the active filters</div>}
    </div>
    <Pagination page={page} pageSize={pageSize} total={tasks.length} onPageChange={setPage} label="deliveries" />
  </section>;
}
