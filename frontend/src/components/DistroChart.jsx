import { useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PALETTE = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))",
  "hsl(var(--chart-7))", "hsl(var(--chart-8))", "hsl(var(--chart-9))", "hsl(var(--chart-10))",
];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="font-medium">{payload[0].payload.label}</div>
      <div className="font-mono text-muted-foreground">{payload[0].value}</div>
    </div>
  );
}

function AxisTick({ x, y, payload }) {
  const label = String(payload.value || "");
  const compact = label.length > 18 ? `${label.slice(0, 17)}…` : label;
  return <text x={x - 8} y={y} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11}>{compact}</text>;
}

export default function DistroChart({ title, data, type = "bar", testid }) {
  const [view, setView] = useState("chart");
  const rows = (data || []).map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }));
  const total = rows.reduce((a, b) => a + b.count, 0);
  const chartRows = rows.slice(0, 10);

  return (
    <div data-testid={testid} className="panel flex h-[360px] min-h-0 flex-col">
      <div className="panel-header">
        <h3 className="panel-title">
          {title}
        </h3>
        <Button
          variant="ghost" size="sm"
          data-testid={`${testid}-toggle`}
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="h-7 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label={view === "chart" ? "Show data table" : "Show chart"}
        >
          {view === "chart" ? <Table2 className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
          {view === "chart" ? "Table" : "Chart"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">No data</div>
      ) : view === "table" ? (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <table className="w-full text-sm">
            <caption className="sr-only">{title} distribution</caption>
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">Label</th>
                <th className="py-1.5 text-center font-medium">Count</th>
                <th className="py-1.5 text-center font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border/50">
                  <td className="py-1.5">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: r.fill }} />
                    {r.label}
                  </td>
                  <td className="py-1.5 text-center font-mono">{r.count}</td>
                  <td className="py-1.5 text-center font-mono text-muted-foreground">
                    {total ? Math.round((1000 * r.count) / total) / 10 : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : type === "pie" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 pb-4 sm:flex-row sm:gap-5">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="count" nameKey="label" innerRadius={58} outerRadius={90}
                     paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-bold tabular">{total}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total</span>
            </div>
          </div>
          <ul className="thin-scroll flex max-h-[220px] flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center gap-2.5 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.fill }} />
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                <span className="font-mono font-medium tabular">{r.count}</span>
                <span className="w-11 text-right font-mono text-xs text-muted-foreground">
                  {total ? Math.round((1000 * r.count) / total) / 10 : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="min-h-0 flex-1 px-2 pb-3">
          <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap={5}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={128}
                     tick={<AxisTick />} interval={0} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "hsl(var(--accent) / 0.5)" }} content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive={false}>
                {chartRows.map((r, i) => <Cell key={i} fill={r.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          {rows.length > chartRows.length && <p className="-mt-1 text-center text-[11px] text-muted-foreground">Top {chartRows.length} shown · switch to Table for all {rows.length}</p>}
        </div>
      )}
    </div>
  );
}
