import { useState } from "react";
import { MessageSquareText, MessagesSquare } from "lucide-react";
import Pagination from "@/components/Pagination";

function FeedbackValue({ value }) {
  const empty = !value || value === "NA";
  return <span className={empty ? "font-mono text-muted-foreground" : "text-foreground"}>{empty ? "NA" : value}</span>;
}

function Authors({ authors }) {
  return <div>{authors.length ? authors.map((author) => author.name || author.email).join(", ") : "NA"}</div>;
}

export default function FeedbackViews({ overall, tasks }) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const current = tasks.slice(page * pageSize, (page + 1) * pageSize);
  return <div className="grid gap-4">
    <section className="panel">
      <div className="panel-header block"><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Project-level signal</div>
        <h3 className="mt-1 panel-title flex items-center gap-2"><MessagesSquare className="h-4 w-4" /> Overall project feedback</h3></div>
      <div className="thin-scroll overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <caption className="sr-only">Overall feedback by project</caption>
          <thead><tr><th className="sticky left-0 z-20 bg-muted">Project</th><th>Client</th><th className="min-w-[280px]">Overall feedback</th><th>Date</th><th className="!text-center">Rating</th><th>Status</th></tr></thead>
          <tbody>{overall.map((row) => <tr key={row.project}><td className="sticky left-0 z-[1] bg-card font-medium">{row.project}</td>
            <td><FeedbackValue value={row.client} /></td><td><FeedbackValue value={row.feedback} /></td>
            <td><FeedbackValue value={row.date} /></td><td className="text-center"><FeedbackValue value={row.rating} /></td><td><FeedbackValue value={row.status} /></td></tr>)}</tbody>
        </table>
        {!overall.length && <div className="py-12 text-center text-sm text-muted-foreground">No projects in this selection</div>}
      </div>
    </section>
    <section className="panel">
      <div className="panel-header block"><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Task-level signal</div>
        <h3 className="mt-1 panel-title flex items-center gap-2"><MessageSquareText className="h-4 w-4" /> Individual task feedback</h3></div>
      <div className="thin-scroll overflow-x-auto">
        <table className="data-table min-w-[1080px]" data-testid="task-feedback-table">
          <caption className="sr-only">Client feedback for individual delivered tasks</caption>
          <thead><tr><th className="sticky left-0 z-20 bg-muted">Task ID</th><th>Project</th><th>Task</th><th>Task type</th><th>Authors</th><th>Delivery date</th><th className="min-w-[260px]">Client feedback</th></tr></thead>
          <tbody>{current.map((task) => <tr key={task.task_id}>
            <td className="sticky left-0 z-[1] max-w-[180px] truncate bg-card font-mono text-xs" title={task.task_id}>{task.task_id}</td>
            <td className="font-medium">{task.project_name}</td><td><FeedbackValue value={task.task || "NA"} /></td>
            <td>{task.task_type}</td><td className="max-w-[240px]"><Authors authors={task.authors} /></td><td>{task.delivery_date || "NA"}</td>
            <td><FeedbackValue value={task.client_feedback} />
              {task.feedback_history?.length > 1 && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer text-primary">View {task.feedback_history.length} feedback records</summary>
                <div className="mt-2 space-y-2">{task.feedback_history.map((item) => <div key={`${item.date}-${item.rating}-${item.status}-${item.feedback}`} className="rounded-md bg-muted p-2"><div>{item.feedback}</div><div className="mt-1 font-mono">{item.date} · {item.rating} · {item.status}</div></div>)}</div>
              </details>}
            </td>
          </tr>)}</tbody>
        </table>
        {!tasks.length && <div className="py-12 text-center text-sm text-muted-foreground">No task feedback records found</div>}
      </div>
      <Pagination page={page} pageSize={pageSize} total={tasks.length} onPageChange={setPage} label="tasks" />
    </section>
  </div>;
}
