import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FILTERS = [
  ["project", "Project", "projects"], ["category", "Category", "categories"],
  ["task_type", "Task type", "task_types"], ["pod_lead", "Pod lead", "pod_leads"],
  ["quality_lead", "Quality lead", "quality_leads"], ["tpm", "TPM", "tpms"],
  ["author", "Tasker", "authors"], ["client", "Client", "clients"],
  ["feedback", "Feedback", "feedback_statuses"],
];

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function presetRange(preset) {
  const end = new Date();
  const start = new Date(end);
  if (preset === "today") return { date_from: iso(end), date_to: iso(end) };
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  return { date_from: iso(start), date_to: iso(end) };
}

function DeliverySelect({ name, label, options, value, onChange }) {
  const values = name === "feedback" ? ["with", "without", ...(options || [])] : (options || []);
  return (
    <Select value={value || "all"} onValueChange={(next) => onChange(name, next === "all" ? "" : next)}>
      <SelectTrigger className="h-9 w-full min-w-0 bg-card text-sm" data-testid={`delivery-filter-${name}`}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}</SelectItem>
        {[...new Set(values)].map((option) => (
          <SelectItem key={option} value={option}>
            {name === "feedback" && option === "with" ? "With feedback" :
             name === "feedback" && option === "without" ? "Without feedback" : option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function DeliveryFilters({ filters, meta, onChange, onReplace, onClear }) {
  const setPreset = (preset) => {
    if (preset === "all") onReplace({ ...filters, preset: "all", date_from: "", date_to: "" });
    else if (preset === "custom") onReplace({ ...filters, preset, date_from: filters.date_from || meta?.min_date || "", date_to: filters.date_to || meta?.max_date || "" });
    else onReplace({ ...filters, preset, ...presetRange(preset) });
  };
  const active = Object.entries(filters).filter(([key, value]) => key !== "preset" && value).length;

  return (
    <section className="panel mb-6" data-testid="delivery-filters">
      <div className="panel-header">
        <div>
          <h2 className="panel-title flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Delivery filters</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Every KPI, chart and contribution recalculates from this selection.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={active === 0}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset filters
        </Button>
      </div>
      <div className="space-y-3 p-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={filters.search || ""} onChange={(event) => onChange("search", event.target.value)}
                 placeholder="Search task ID, project or author…" className="h-9 bg-card pl-9" data-testid="delivery-search" />
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Delivery date range">
          {[["all", "All time"], ["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["month", "This month"], ["custom", "Custom"]].map(([value, label]) => (
            <Button key={value} size="sm" variant={(filters.preset || "all") === value ? "default" : "outline"}
                    onClick={() => setPreset(value)}>{label}</Button>
          ))}
          {(filters.preset === "custom") && <>
            <Input type="date" aria-label="Delivery date from" value={filters.date_from || ""}
                   onChange={(event) => onChange("date_from", event.target.value)} className="h-8 w-full sm:w-[150px]" />
            <Input type="date" aria-label="Delivery date to" value={filters.date_to || ""}
                   onChange={(event) => onChange("date_to", event.target.value)} className="h-8 w-full sm:w-[150px]" />
          </>}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {FILTERS.map(([name, label, optionKey]) => (
            <DeliverySelect key={name} name={name} label={label} options={meta?.[optionKey]}
                            value={filters[name]} onChange={onChange} />
          ))}
        </div>
      </div>
    </section>
  );
}
