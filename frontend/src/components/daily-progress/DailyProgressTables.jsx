import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/Pagination";

const metricColumns = [
  ["assigned", "Assigned"], ["created", "Created"], ["delivered", "Delivered"],
  ["pending_creation", "Pending creation"], ["pending_delivery", "Pending delivery"],
  ["completion_pct", "Completion %"], ["delivery_rate", "Delivery rate %"],
];

const number = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });

export function MetricTable({ title, subtitle, rows, identity = "label", identityLabel = "Period" }) {
  return <section className="panel"><div className="panel-header"><div><h2 className="panel-title">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></div></div>
    {!rows.length ? <div className="empty-state border-0 shadow-none">No matching rows.</div> : <div className="thin-scroll overflow-x-auto"><table className="data-table min-w-[920px]"><caption className="sr-only">{title}</caption>
      <thead><tr><th className="sticky left-0 z-20 bg-muted">{identityLabel}</th>{metricColumns.map(([, label]) => <th className="text-center" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[identity]}><td className="sticky left-0 bg-card font-medium">{row[identity]}</td>{metricColumns.map(([key]) => <td className="text-center tabular" key={key}>{number(row[key])}{key.includes("pct") || key === "delivery_rate" ? "%" : ""}</td>)}</tr>)}</tbody>
    </table></div>}
  </section>;
}

export function TaskerTable({ rows }) {
  return <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Tasker-level progress</h2><p className="mt-0.5 text-xs text-muted-foreground">Delivered uses the same fractional multi-author contribution rule as Delivery.</p></div></div>
    {!rows.length ? <div className="empty-state border-0 shadow-none">No taskers match these filters.</div> : <div className="thin-scroll overflow-x-auto"><table className="data-table min-w-[980px]"><caption className="sr-only">Tasker progress</caption>
      <thead><tr><th className="sticky left-0 z-20 bg-muted">Tasker</th><th>Email</th>{metricColumns.map(([, label]) => <th className="text-center" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.email}><td className="sticky left-0 bg-card font-medium">{row.name}</td><td className="text-muted-foreground">{row.email || "NA"}</td>{metricColumns.map(([key]) => <td className="text-center tabular" key={key}>{number(row[key])}{key.includes("pct") || key === "delivery_rate" ? "%" : ""}</td>)}</tr>)}</tbody>
    </table></div>}
  </section>;
}

export function RecordsTable({ rows }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("date");
  useEffect(() => setPage(0), [rows, sort]);
  const ordered = useMemo(() => [...rows].sort((a, b) => String(b[sort] ?? "").localeCompare(String(a[sort] ?? ""))), [rows, sort]);
  const pageSize = 15;
  const visible = ordered.slice(page * pageSize, (page + 1) * pageSize);
  return <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Daily progress records</h2><p className="mt-0.5 text-xs text-muted-foreground">Source-level details. Blank remarks show NA; missing delivery shows 0.</p></div></div>
    {!rows.length ? <div className="empty-state border-0 shadow-none">No records match these filters.</div> : <><div className="thin-scroll overflow-x-auto"><table className="data-table min-w-[1320px]"><caption className="sr-only">Detailed daily progress records</caption>
      <thead><tr>{[["date", "Date"], ["name", "Name"], ["email", "Email"], ["task_type", "Task type"], ["assigned", "Assigned"], ["created", "Created"], ["delivered", "Delivered"], ["pending_delivery", "Pending delivery"], ["completion_pct", "Completion %"], ["remarks", "Remarks"]].map(([key, label], index) => <th className={`${index === 0 ? "sticky left-0 z-20 bg-muted" : ""} ${index >= 4 && index <= 8 ? "text-center" : ""}`} key={key}><button className="font-semibold" onClick={() => setSort(key)}>{label}{sort === key ? " ↓" : ""}</button></th>)}</tr></thead>
      <tbody>{visible.map((row) => <tr key={row.record_key}><td className="sticky left-0 bg-card font-mono text-xs">{row.date}</td><td className="font-medium">{row.name}</td><td>{row.email || "NA"}</td><td>{row.task_type}</td><td className="text-center tabular">{number(row.assigned)}</td><td className="text-center tabular">{number(row.created)}</td><td className="text-center tabular">{number(row.delivered)}</td><td className="text-center tabular">{number(row.pending_delivery)}</td><td className="text-center tabular">{number(row.completion_pct)}%</td><td className="max-w-[280px] whitespace-normal">{row.remarks || "NA"}</td></tr>)}</tbody>
    </table></div><Pagination page={page} pageSize={pageSize} total={rows.length} onPageChange={setPage} label="records" /></>}
  </section>;
}
