import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface PaginationProps {
  className?: string;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  rangeLabel?: string;
}

function pages(page: number, count: number): (number | "…")[] {
  if (count <= 6) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  const out: (number | "…")[] = [1, 2, 3];
  if (page > 4) {
    out.push("…");
  }
  if (page > 3 && page < count) {
    out.push(page);
  }
  out.push("…", count);
  return out.filter((v, i, a) => a.indexOf(v) === i);
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  rangeLabel,
  className,
}: PaginationProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3.5", className)}
      data-slot="pagination"
    >
      {rangeLabel && (
        <span className="font-mono text-[11.5px] text-mid">{rangeLabel}</span>
      )}
      <div className="inline-flex items-center gap-1">
        <button
          aria-label="Previous"
          className="flex size-[34px] items-center justify-center rounded-sm border border-input text-mid transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        {pages(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span
              className="flex size-[34px] items-center justify-center font-mono text-mid text-xs"
              // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis placeholder
              key={`ellipsis-${i}`}
            >
              …
            </span>
          ) : (
            <button
              className={cn(
                "flex h-[34px] min-w-[34px] items-center justify-center rounded-sm px-1.5 font-mono text-[13px] transition-colors",
                p === page
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "text-mid hover:bg-accent hover:text-foreground"
              )}
              key={p}
              onClick={() => onPageChange(p)}
              type="button"
            >
              {p}
            </button>
          )
        )}
        <button
          aria-label="Next"
          className="flex size-[34px] items-center justify-center rounded-sm border border-input text-mid transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
