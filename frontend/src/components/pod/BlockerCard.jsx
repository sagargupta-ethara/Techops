import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";

export default function BlockerCard({ current, analyzing, onRun }) {
  const result = current?.result;
  return <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-4" data-testid="blocker-analysis">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        <Sparkles className="h-4 w-4" /> AI Blocker Analysis
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] normal-case tracking-normal">Claude Haiku</span>
      </h3>
      <Button size="sm" variant="outline" onClick={onRun} disabled={analyzing}
              data-testid="run-blocker-analysis" className="h-8 gap-1.5 text-xs">
        <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`} />
        {analyzing ? "Analyzing remarks…" : current ? "Re-run" : "Analyze remarks"}
      </Button>
    </div>
    {!current && !analyzing && <p className="mt-2 text-sm text-muted-foreground">Run an AI pass over every member remark to surface why completion is stuck and the top blockers.</p>}
    {result && <div className="mt-3 space-y-3 text-sm" data-testid="blocker-result">
      <p className="font-medium">{result.headline}</p>
      {result.blockers?.length > 0 && <ul className="space-y-1.5">{result.blockers.map((blocker, index) => <li key={index} className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-xs text-amber-700 dark:text-amber-400">{blocker.count ?? "?"}</span>
        <span><span className="font-medium">{blocker.issue}</span> — <span className="text-muted-foreground">{blocker.detail}</span></span>
      </li>)}</ul>}
      {result.recommendation && <div className="rounded border border-border bg-card p-2.5">
        <span className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Recommendation</span>
        <p className="mt-0.5">{result.recommendation}</p>
      </div>}
      {current?.generated_at && <p className="text-[11px] text-muted-foreground">Generated {fmtDate(current.generated_at)}</p>}
    </div>}
  </div>;
}
