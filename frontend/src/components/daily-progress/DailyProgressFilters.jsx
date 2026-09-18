import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function localIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeFor(preset) {
  const end = new Date();
  const start = new Date(end);
  if (preset === "today") return [localIso(end), localIso(end)];
  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    return [localIso(start), localIso(start)];
  }
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (preset === "last-week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  }
  if (preset === "month") start.setDate(1);
  return [localIso(start), localIso(end)];
}

function FilterSelect({ label, name, value, options, onChange }) {
  return <Select value={value || "all"} onValueChange={(next) => onChange(name, next === "all" ? "" : next)}>
    <SelectTrigger className="h-11 bg-card lg:h-9" aria-label={label}><SelectValue placeholder={label} /></SelectTrigger>
    <SelectContent><SelectItem value="all">All {label.toLowerCase()}</SelectItem>
      {(options || []).map((option) => <SelectItem value={option} key={option}>{option}</SelectItem>)}
    </SelectContent>
  </Select>;
}

export default function DailyProgressFilters({ filters, meta, onChange, onReplace, onClear }) {
  const preset = (value) => {
    if (value === "all") return onReplace({ preset: "all" });
    if (value === "custom") return onReplace({ ...filters, preset: value, dates: "", date_from: filters.date_from || meta?.min_date || "", date_to: filters.date_to || meta?.max_date || "" });
    const [date_from, date_to] = rangeFor(value);
    onReplace({ ...filters, preset: value, dates: "", date_from, date_to });
  };
  const setSingleDate = (date) => onReplace({ ...filters, preset: "single", dates: date, date_from: "", date_to: "" });
  const toggleDate = (date) => {
    const selected = new Set((filters.dates || "").split(",").filter(Boolean));
    selected.has(date) ? selected.delete(date) : selected.add(date);
    onReplace({ ...filters, preset: "multiple", dates: [...selected].sort().join(","), date_from: "", date_to: "" });
  };
  const active = Object.entries(filters).filter(([key, value]) => key !== "preset" && value).length;

  return <section className="panel mb-6" data-testid="daily-progress-filters">
    <div className="panel-header">
      <div><h2 className="panel-title flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Progress filters</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">One selection recalculates every KPI, chart, tasker and record.</p></div>
      {active > 0 && <Button className="h-11 lg:h-8" variant="ghost" size="sm" onClick={onClear}><RotateCcw /> Reset {active}</Button>}
    </div>
    <div className="space-y-3 p-4">
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={filters.search || ""} onChange={(event) => onChange("search", event.target.value)} placeholder="Search name, email, task type or remarks…" className="h-11 pl-9 lg:h-9" />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Date shortcuts">
        {[["all", "All dates"], ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["week", "This week"], ["last-week", "Last week"], ["month", "This month"], ["custom", "Custom range"]].map(([value, label]) =>
          <Button className="h-11 lg:h-8" key={value} size="sm" variant={(filters.preset || "all") === value ? "default" : "outline"} onClick={() => preset(value)}>{label}</Button>)}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input className="h-11 lg:h-9" type="date" aria-label="Single progress date" value={filters.preset === "single" ? filters.dates || "" : ""} onChange={(event) => setSingleDate(event.target.value)} />
        <FilterSelect label="Name" name="name" value={filters.name} options={meta?.names} onChange={onChange} />
        <FilterSelect label="Email" name="email" value={filters.email} options={meta?.emails} onChange={onChange} />
        <FilterSelect label="Task type" name="task_type" value={filters.task_type} options={meta?.task_types} onChange={onChange} />
      </div>
      {filters.preset === "custom" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input className="h-11 lg:h-9" type="date" aria-label="Progress date from" value={filters.date_from || ""} onChange={(event) => onChange("date_from", event.target.value)} />
        <Input className="h-11 lg:h-9" type="date" aria-label="Progress date to" value={filters.date_to || ""} onChange={(event) => onChange("date_to", event.target.value)} />
      </div>}
      <details className="rounded-lg border border-border/70 bg-muted/25 p-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-foreground lg:min-h-0">Select multiple individual dates</summary>
        <div className="mt-3 flex flex-wrap gap-2">{(meta?.dates || []).map((date) => {
          const checked = (filters.dates || "").split(",").includes(date);
          return <Button className="h-11 lg:h-8" key={date} size="sm" variant={checked ? "default" : "outline"} onClick={() => toggleDate(date)}>{date}</Button>;
        })}</div>
      </details>
    </div>
  </section>;
}
