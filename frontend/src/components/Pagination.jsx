import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Pagination({ page, pageSize, total, onPageChange, label = "results" }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? page * pageSize + 1 : 0;
  const end = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/35 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{start}–{end}</span> of {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="mr-1 text-xs text-muted-foreground">Page {page + 1} of {pages}</span>
        <Button variant="outline" size="sm" className="h-11 gap-1 lg:h-8" disabled={page === 0}
                onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Button>
        <Button variant="outline" size="sm" className="h-11 gap-1 lg:h-8" disabled={page + 1 >= pages}
                onClick={() => onPageChange(page + 1)} aria-label="Next page">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
