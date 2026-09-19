import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Check, DatabaseBackup, RotateCcw } from "lucide-react";
import api from "@/lib/api";
import { fmtDay } from "@/lib/format";
import { filterDateOptions } from "@/lib/podHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

const SOURCE_LABELS = {
  backup: "CSV backup",
  snapshot: "Snapshot",
  "snapshot+backup": "CSV backup + snapshot",
};

export default function PodBackupHistory({ selectedDate, onSelectDate }) {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: meta, isLoading } = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.get("/meta").then((response) => response.data),
  });
  const visibleOptions = useMemo(
    () => filterDateOptions(meta?.date_options || [], dateFrom, dateTo),
    [meta?.date_options, dateFrom, dateTo],
  );
  const resetRange = () => {
    setDateFrom("");
    setDateTo("");
  };
  const chooseDate = (date) => {
    onSelectDate(date);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={selectedDate ? "secondary" : "outline"} className="h-11 gap-2 lg:h-9" data-testid="pod-backup-button">
          <DatabaseBackup className="h-4 w-4" />
          <span>{selectedDate ? fmtDay(selectedDate) : "Backup history"}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="pod-backup-drawer">
        <SheetHeader className="pr-10 sm:pr-8">
          <SheetTitle className="flex items-center gap-2 font-heading">
            <CalendarRange className="h-5 w-5 text-primary" /> POD backup history
          </SheetTitle>
          <SheetDescription>
            Backups run at 04:00 IST for the previous reporting day. Narrow the range, then select a day to load it.
          </SheetDescription>
        </SheetHeader>

        <section className="mt-6 rounded-xl border border-border bg-muted/35 p-4" aria-label="Backup date range">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-heading text-sm font-semibold">Date range</h3>
            <Button variant="ghost" size="sm" className="h-11 gap-1.5 text-xs sm:h-8" onClick={resetRange}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset range
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              From
              <Input type="date" value={dateFrom} max={dateTo || undefined} className="h-11 sm:h-9"
                     onChange={(event) => setDateFrom(event.target.value)} aria-label="Backup date from" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              To
              <Input type="date" value={dateTo} min={dateFrom || undefined} className="h-11 sm:h-9"
                     onChange={(event) => setDateTo(event.target.value)} aria-label="Backup date to" />
            </label>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className="font-heading text-sm font-semibold">Available reporting days</h3>
          <span className="font-mono text-xs text-muted-foreground">{visibleOptions.length}</span>
        </div>

        <div className="mt-3 space-y-2" data-testid="pod-backup-date-list">
          {selectedDate && (
            <button type="button" onClick={() => chooseDate("")}
                    className="flex min-h-12 w-full items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span><strong className="block">Return to live data</strong><span className="text-xs text-muted-foreground">Latest Google Sheet snapshot</span></span>
              <RotateCcw className="h-4 w-4 text-primary" />
            </button>
          )}
          {isLoading ? (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Loading backup dates…</div>
          ) : visibleOptions.length ? visibleOptions.map((option) => {
            const active = option.date === selectedDate;
            return (
              <button key={option.date} type="button" onClick={() => chooseDate(option.date)} aria-pressed={active}
                      data-testid={`pod-backup-date-${option.date}`}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"}`}>
                <span><strong className="block text-sm">{fmtDay(option.date)}</strong><span className="text-xs text-muted-foreground">{SOURCE_LABELS[option.source] || option.source}</span></span>
                {active ? <Check className="h-4 w-4 text-primary" /> : <span className="font-mono text-xs text-muted-foreground">View</span>}
              </button>
            );
          }) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No backup dates match this range.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
