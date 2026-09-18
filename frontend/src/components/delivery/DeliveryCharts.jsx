import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))",
];

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((item) => <div key={item.dataKey} className="flex items-center justify-between gap-5 text-muted-foreground">
        <span>{item.name}</span><span className="font-mono font-semibold text-foreground">{item.value}</span>
      </div>)}
    </div>
  );
}

function ChartPanel({ title, eyebrow, children, empty }) {
  return (
    <section className="panel min-h-[340px]">
      <div className="panel-header block">
        <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">{eyebrow}</div>
        <h3 className="mt-1 panel-title">{title}</h3>
      </div>
      {empty ? <div className="flex h-[270px] items-center justify-center text-sm text-muted-foreground">No delivery data for this selection</div> : children}
    </section>
  );
}

export default function DeliveryCharts({ projects, trend, taskTypes, feedbackProjects }) {
  const typeNames = taskTypes.map((item) => item.label);
  const projectData = projects.map((project) => ({ name: project.project, ...project.task_types }));
  const feedbackData = feedbackProjects.map((project) => ({
    name: project.project, with: project.with_feedback, without: project.without_feedback,
  }));
  return (
    <div className="grid gap-4 xl:grid-cols-2" data-testid="delivery-charts">
      <ChartPanel title="Tasks delivered by project" eyebrow="Project mix" empty={!projectData.length}>
        <div className="h-[270px] px-2 pb-3 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectData} margin={{ top: 8, right: 14, left: -10, bottom: 42 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={72} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {typeNames.map((type, index) => <Bar key={type} dataKey={type} stackId="tasks" fill={COLORS[index % COLORS.length]}
                                                       radius={index === typeNames.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
      <ChartPanel title="Delivery trend over time" eyebrow="Throughput" empty={!trend.length}>
        <div className="h-[270px] px-3 pb-3 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ right: 16, left: -10, bottom: 14 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Line type="monotone" dataKey="count" name="Delivered" stroke="hsl(var(--chart-1))" strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--chart-1))" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
      <div className="xl:col-span-2">
        <ChartPanel title="Feedback coverage by project" eyebrow="Client feedback" empty={!feedbackData.length}>
          <div className="h-[270px] px-3 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feedbackData} layout="vertical" margin={{ left: 18, right: 18 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={120} interval={0}
                       tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<AnalyticsTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="with" name="With feedback" stackId="feedback" fill="hsl(var(--chart-4))" isAnimationActive={false} />
                <Bar dataKey="without" name="Without feedback" stackId="feedback" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}
