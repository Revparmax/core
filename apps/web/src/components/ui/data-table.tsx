import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  key: string;
  numeric?: boolean;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** value used for sorting */
  sortValue?: (row: T) => number | string;
}

interface DataTableProps<T> {
  className?: string;
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  rows: T[];
}

/** The workhorse for rows of properties, recommendations and outcomes. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) {
      return rows;
    }
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) {
      return rows;
    }
    return [...rows].sort((a, b) => {
      const av = col.sortValue?.(a) ?? 0;
      const bv = col.sortValue?.(b) ?? 0;
      return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }
    );

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-card",
        className
      )}
      data-slot="data-table"
    >
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                className={cn(
                  "border-border border-b bg-secondary px-4.5 py-3.5 font-medium font-mono text-[10px] text-mid uppercase tracking-[0.13em]",
                  col.numeric ? "text-right" : "text-left",
                  col.sortable && "cursor-pointer select-none"
                )}
                key={col.key}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    col.numeric && "flex-row-reverse"
                  )}
                >
                  {col.header}
                  {col.sortable && (
                    <ChevronDown
                      className={cn(
                        "size-3 transition-transform",
                        sort?.key === col.key ? "text-acc-deep" : "opacity-50",
                        sort?.key === col.key && sort.dir === -1 && "rotate-180"
                      )}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              className="border-border border-b transition-colors last:border-b-0 hover:bg-accent"
              key={getRowKey(row)}
            >
              {columns.map((col) => (
                <td
                  className={cn(
                    "px-4.5 py-3.5 align-middle text-foreground",
                    col.numeric && "tnum text-right font-mono"
                  )}
                  key={col.key}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
