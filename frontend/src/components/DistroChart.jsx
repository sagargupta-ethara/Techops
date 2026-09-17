import { useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PALETTE = [
  "hsl(217, 91%, 60%)", "hsl(160, 84%, 39%)", "hsl(38, 92%, 50%)",
  "hsl(340, 82%, 52%)", "hsl(271, 91%, 65%)", "hsl(189, 94%, 43%)",
  "hsl(20, 90%, 55%)", "hsl(140, 60%, 45%)",
];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="font-medium">{payload[0].payload.label}</div>
      <div className="font-mono text-muted-foreground">{payload[0].value}</div>
    </div>
  );
}

export default function DistroChart({ title, data, type = "bar", testid }) {
  const [view, setView] = useState("chart");
  const rows = (data || []).map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] }));
  const total = rows.reduce((a, b) => a + b.count, 0);

  return (
    <div data-testid={testid} className="card-lift rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <Button
          variant="ghost" size="sm"
          data-testid={`${testid}-toggle`}
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="h-7 gap-1.5 text-xs"
          aria-label={view === "chart" ? "Show data table" : "Show chart"}
        >
          {view === "chart" ? <Table2 className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
          {view === "chart" ? "Table" : "Chart"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No data</div>
      ) : view === "table" ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{title} distribution</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1.5 font-medium">Label</th>
              <th className="py-1.5 text-right font-medium">Count</th>
              <th className="py-1.5 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/60">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right font-mono">{r.count}</td>
                <td className="py-1.5 text-right font-mono text-muted-foreground">
                  {total ? Math.round((1000 * r.count) / total) / 10 : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : type === "pie" ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="label" innerRadius={45} outerRadius={80} paddingAngle={2}>
              {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 34)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="category" dataKey="label" width={110}
                   tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip cursor={{ fill: "hsl(var(--accent))" }} content={<ChartTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
