import { useQuery } from "@tanstack/react-query";
import { X, Filter } from "lucide-react";
import api from "@/lib/api";
import { useFilters } from "@/lib/useFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function FSelect({ label, k, value, options, onChange, testid }) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(k, v)}>
      <SelectTrigger data-testid={testid} className="h-9 w-[140px] shrink-0 text-sm">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function GlobalFilterBar() {
  const { filters, setFilter, clearAll, activeChips } = useFilters();
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get("/meta").then((r) => r.data) });
  const opt = meta?.options || {};

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto thin-scroll pb-1">
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="relative w-[200px] shrink-0">
            <Input
              data-testid="filter-search"
              placeholder="Search name or email…"
              value={filters.search || ""}
              onChange={(e) => setFilter("search", e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          {meta?.dates?.length > 1 && (
            <FSelect label="Date" k="date" value={filters.date} options={meta.dates}
                     onChange={setFilter} testid="filter-date" />
          )}
          <FSelect label="TPM" k="tpm" value={filters.tpm} options={opt.tpms || []}
                   onChange={setFilter} testid="filter-tpm" />
          <FSelect label="POD" k="pod" value={filters.pod} options={opt.pods || []}
                   onChange={setFilter} testid="filter-pod" />
          <FSelect label="Role" k="role" value={filters.role} options={opt.roles || []}
                   onChange={setFilter} testid="filter-role" />
          <FSelect label="Status" k="status" value={filters.status} options={opt.statuses || []}
                   onChange={setFilter} testid="filter-status" />
          <FSelect label="Completeness" k="completeness" value={filters.completeness}
                   options={["complete", "incomplete", "absent"]} onChange={setFilter}
                   testid="filter-completeness" />
          <Button
            variant={filters.attention === "true" ? "default" : "outline"}
            size="sm"
            data-testid="filter-attention"
            onClick={() => setFilter("attention", filters.attention === "true" ? "" : "true")}
            className="h-9 shrink-0 text-xs"
          >
            Attention only
          </Button>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map(([k, v]) => (
              <Badge key={k} variant="secondary" data-testid={`chip-${k}`}
                     className="gap-1 font-normal">
                <span className="text-muted-foreground">{k}:</span> {v}
                <button onClick={() => setFilter(k, "")} aria-label={`Remove ${k} filter`}
                        className="ml-0.5 rounded-full hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" data-testid="filter-clear-all"
                    onClick={clearAll} className="h-6 text-xs text-muted-foreground">
              Clear all
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
