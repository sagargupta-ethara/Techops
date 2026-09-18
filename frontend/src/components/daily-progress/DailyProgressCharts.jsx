import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = { assigned: "hsl(var(--chart-2))", created: "hsl(var(--chart-1))", delivered: "hsl(var(--chart-3))" };
const tooltip = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 };

function Empty() {
  return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No progress data matches these filters.</div>;
}

function Panel({ title, subtitle, children }) {
  return <section className="panel"><div className="panel-header"><div><h2 className="panel-title">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></div></div><div className="p-4">{children}</div></section>;
}

export default function DailyProgressCharts({ daily, weekly, taskTypes }) {
  const leadingTypes = [...taskTypes].sort((a, b) => b.assigned - a.assigned).slice(0, 8);
  const typeMaximum = Math.max(1, ...leadingTypes.flatMap((row) => [row.assigned, row.created, row.delivered]));
  return <div className="grid gap-4 xl:grid-cols-2">
    <Panel title="Daily workflow trend" subtitle="Assigned, created and delivered by progress date.">
      {!daily.length ? <Empty /> : <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={daily} margin={{ left: 0, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltip} /><Legend /><Line isAnimationActive={false} type="monotone" dataKey="assigned" stroke={colors.assigned} strokeWidth={2} dot={false} />
        <Line isAnimationActive={false} type="monotone" dataKey="created" stroke={colors.created} strokeWidth={2} dot={false} /><Line isAnimationActive={false} type="monotone" dataKey="delivered" stroke={colors.delivered} strokeWidth={2} dot={false} />
      </LineChart></ResponsiveContainer></div>}
    </Panel>
    <Panel title="Progress by task type" subtitle="Top task types by assigned volume; the breakdown table includes every type.">
      {!taskTypes.length ? <Empty /> : <div className="space-y-3" role="img" aria-label="Assigned, created and delivered by task type">
        {leadingTypes.map((row) => <div key={row.label} className="grid gap-1.5 border-b border-border/50 pb-3 last:border-0 last:pb-0 sm:grid-cols-[150px_1fr] sm:items-center">
          <div className="text-xs font-semibold leading-snug text-foreground">{row.label}</div>
          <div className="space-y-1">
            {[["Assigned", row.assigned, "bg-[hsl(var(--chart-2))]"], ["Created", row.created, "bg-[hsl(var(--chart-1))]"], ["Delivered", row.delivered, "bg-[hsl(var(--chart-3))]"]].map(([label, value, color]) => <div className="grid grid-cols-[64px_1fr_48px] items-center gap-2" key={label}>
              <span className="text-[11px] text-muted-foreground">{label}</span><span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${color}`} style={{ width: `${value ? Math.max(1, value / typeMaximum * 100) : 0}%` }} /></span><span className="text-right font-mono text-[11px] text-foreground">{Number(value).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</span>
            </div>)}
          </div>
        </div>)}
      </div>}
    </Panel>
    <div className="xl:col-span-2"><Panel title="Monday–Sunday weekly progress" subtitle="Weekly totals use a consistent Monday start and Sunday end.">
      {!weekly.length ? <Empty /> : <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekly} margin={{ left: 0, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltip} /><Legend />
        <Bar isAnimationActive={false} dataKey="assigned" fill={colors.assigned} /><Bar isAnimationActive={false} dataKey="created" fill={colors.created} /><Bar isAnimationActive={false} dataKey="delivered" fill={colors.delivered} />
      </BarChart></ResponsiveContainer></div>}
    </Panel></div>
  </div>;
}
