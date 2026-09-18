import { useMemo, useState } from "react";
import { ListChecks, Percent, TableProperties, UserRoundCog, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const contribution = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 4 });

function PanelTitle({ icon: Icon, eyebrow, title, right }) {
  return <div className="panel-header flex-col items-start sm:flex-row sm:items-center">
    <div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">{eyebrow}</div>
      <h3 className="mt-1 panel-title flex items-center gap-2"><Icon className="h-4 w-4" /> {title}</h3></div>
    {right}
  </div>;
}

export function ProjectBreakdown({ projects, taskTypes }) {
  return <section className="panel">
    <PanelTitle icon={ListChecks} eyebrow="Delivery mix" title="Project-level delivery" />
    <div className="thin-scroll overflow-x-auto">
      <table className="data-table min-w-[680px]">
        <caption className="sr-only">Project delivery breakdown</caption>
        <thead><tr><th className="sticky left-0 z-20 bg-muted">Project</th><th className="!text-center">Total delivered</th>
          {taskTypes.map((type) => <th key={type.label} className="!text-center">{type.label}</th>)}</tr></thead>
        <tbody>{projects.map((project) => <tr key={project.project}>
          <td className="sticky left-0 z-[1] bg-card font-medium">{project.project}</td><td className="text-center font-mono">{project.total}</td>
          {taskTypes.map((type) => <td key={type.label} className="text-center font-mono">{project.task_types[type.label] || 0}</td>)}
        </tr>)}</tbody>
      </table>
      {!projects.length && <div className="py-12 text-center text-sm text-muted-foreground">No project deliveries found</div>}
    </div>
  </section>;
}

function OwnerProjectMatrix({ rows, projects, title, eyebrow, icon: Icon, testid }) {
  const projectNames = projects.map((project) => project.project);
  return <section className="panel">
    <PanelTitle icon={Icon} eyebrow={eyebrow} title={title} />
    <div className="thin-scroll max-h-[480px] overflow-auto">
      <table className="data-table min-w-max" data-testid={testid}>
        <caption className="sr-only">{title}</caption>
        <thead><tr><th className="sticky left-0 z-20 bg-muted">Name</th>
          {projectNames.map((project) => <th key={project} className="min-w-[120px] !text-center">{project}</th>)}
          <th className="!text-center">Total delivered</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.name}>
          <td className="sticky left-0 z-[1] bg-card font-medium">{row.name}</td>
          {projectNames.map((project) => <td key={project} className="text-center font-mono">{row.projects[project] || 0}</td>)}
          <td className="text-center font-mono font-bold text-primary">{row.task_count}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <div className="py-12 text-center text-sm text-muted-foreground">No delivery ownership found</div>}
    </div>
  </section>;
}

export function TaskerContributions({ taskers, projects, tpms, podLeads }) {
  const [mode, setMode] = useState("contribution");
  const rows = useMemo(() => [...taskers].sort((a, b) => b[mode === "tasks" ? "task_count" : "contribution"] - a[mode === "tasks" ? "task_count" : "contribution"]), [taskers, mode]);
  const projectNames = projects.map((project) => project.project);
  const controls = <div className="flex rounded-lg bg-muted p-1">
    <Button size="sm" variant={mode === "tasks" ? "default" : "ghost"} className="h-7" onClick={() => setMode("tasks")}>Task count</Button>
    <Button size="sm" variant={mode === "contribution" ? "default" : "ghost"} className="h-7" onClick={() => setMode("contribution")}>Fractional contribution</Button>
  </div>;
  return <div className="grid gap-4">
    <OwnerProjectMatrix rows={tpms} projects={projects} title="TPM delivery by project" eyebrow="Delivery ownership"
                        icon={UserRoundCog} testid="tpm-delivery-table" />
    <OwnerProjectMatrix rows={podLeads} projects={projects} title="Pod Lead delivery by project" eyebrow="Delivery ownership"
                        icon={UsersRound} testid="pod-lead-delivery-table" />
    <section className="panel">
      <PanelTitle icon={TableProperties} eyebrow="Cross-project view" title="Tasker × project contribution" />
      <div className="thin-scroll max-h-[560px] overflow-auto">
        <table className="data-table min-w-max">
          <caption className="sr-only">Tasker contribution by project</caption>
          <thead><tr><th className="sticky left-0 z-20 bg-muted">Tasker</th>
            {projectNames.map((project) => <th key={project} className="min-w-[120px] !text-center">{project}</th>)}
            <th className="!text-center">Total contribution</th></tr></thead>
          <tbody>{rows.map((tasker) => <tr key={tasker.email || tasker.tasker}>
            <td className="sticky left-0 z-[1] bg-card font-medium">{tasker.tasker}</td>
            {projectNames.map((project) => <td key={project} className="text-center font-mono">{contribution(tasker.projects[project])}</td>)}
            <td className="text-center font-mono font-bold text-primary">{contribution(tasker.contribution)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="panel">
      <PanelTitle icon={Percent} eyebrow="Overall attribution" title="Tasker contribution summary" right={controls} />
      <div className="thin-scroll max-h-[560px] overflow-auto">
        <table className="data-table min-w-[760px]" data-testid="tasker-contribution-table">
          <caption className="sr-only">Overall fractional tasker contributions</caption>
          <thead><tr><th className="sticky left-0 z-20 bg-muted">Tasker</th><th>Email</th><th className="!text-center">Tasks contributed</th>
            <th className="!text-center">Contribution</th><th className="!text-center">With feedback</th><th className="!text-center">Coverage</th></tr></thead>
          <tbody>{rows.map((tasker) => <tr key={tasker.email || tasker.tasker}>
            <td className="sticky left-0 z-[1] bg-card font-medium">{tasker.tasker}{tasker.unassigned && <span className="ml-2 text-xs font-normal text-amber-600">Missing author data</span>}</td><td className="text-muted-foreground">{tasker.email || "NA"}</td>
            <td className={`text-center font-mono ${mode === "tasks" ? "font-bold text-primary" : ""}`}>{tasker.task_count}</td>
            <td className={`text-center font-mono ${mode === "contribution" ? "font-bold text-primary" : ""}`}>{contribution(tasker.contribution)}</td>
            <td className="text-center font-mono">{tasker.with_feedback}</td><td className="text-center font-mono">{tasker.feedback_coverage}%</td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <div className="py-12 text-center text-sm text-muted-foreground">No tasker contributions found</div>}
      </div>
    </section>
  </div>;
}
