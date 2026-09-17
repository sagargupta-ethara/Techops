import { CheckCircle2, AlertTriangle, AlertOctagon, ShieldAlert, CircleDashed } from "lucide-react";

const MAP = {
  fresh: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "Fresh" },
  stale: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30", label: "Stale" },
  sync_failed: { icon: AlertOctagon, cls: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30", label: "Sync Failed" },
  unavailable: { icon: CircleDashed, cls: "text-slate-500 bg-slate-500/10 border-slate-500/30", label: "Unavailable" },
  attention: { icon: ShieldAlert, cls: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30", label: "Attention" },
  neutral: { icon: CircleDashed, cls: "text-muted-foreground bg-muted border-border", label: "" },
};

export default function StatusBadge({ state = "neutral", text, size = "sm", testid }) {
  const cfg = MAP[state] || MAP.neutral;
  const Icon = cfg.icon;
  const pad = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pad} ${cfg.cls}`}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
      <span>{text ?? cfg.label}</span>
    </span>
  );
}
