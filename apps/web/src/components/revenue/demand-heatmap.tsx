import { cn } from "@/lib/utils";

/** demand tier 0–5 → ember ramp over surface */
const tierClass = [
  "bg-secondary text-low",
  "bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))]",
  "bg-[color-mix(in_srgb,var(--primary)_34%,var(--card))]",
  "bg-[color-mix(in_srgb,var(--primary)_56%,var(--card))] text-white",
  "bg-[color-mix(in_srgb,var(--primary)_80%,var(--card))] text-white",
  "bg-primary text-white",
] as const;

export interface HeatCell {
  peak?: boolean;
  tier: number;
  value: string;
}
export interface HeatRow {
  cells: HeatCell[];
  label: string;
}

interface DemandHeatmapProps {
  className?: string;
  columns: string[];
  /** width of the row-label column */
  labelWidth?: number;
  rows: HeatRow[];
  subtitle?: string;
  title: string;
}

export function DemandHeatmap({
  title,
  subtitle,
  columns,
  rows,
  labelWidth = 138,
  className,
}: DemandHeatmapProps) {
  const gridTemplate = `${labelWidth}px repeat(${columns.length}, minmax(0, 1fr))`;
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-slot="demand-heatmap"
    >
      <div className="mb-4">
        <div className="font-display font-semibold text-lg tracking-tight">
          {title}
        </div>
        {subtitle && (
          <div className="mt-1 font-mono text-[10.5px] text-mid uppercase tracking-wide">
            {subtitle}
          </div>
        )}
      </div>

      <div
        className="grid gap-[5px]"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <span />
        {columns.map((c) => (
          <span
            className="pb-0.5 text-center font-mono text-[9.5px] text-low uppercase tracking-wide"
            key={c}
          >
            {c}
          </span>
        ))}
        {rows.map((row) => (
          <Row gridTemplate={gridTemplate} key={row.label} row={row} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 font-mono text-[10px] text-mid">
        Quiet
        <span className="inline-flex gap-[3px]">
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <span
              className={cn("size-3 rounded-[3px]", tierClass[t])}
              key={t}
            />
          ))}
        </span>
        Peak
      </div>
    </div>
  );
}

function Row({ row, gridTemplate }: { row: HeatRow; gridTemplate: string }) {
  return (
    <div className="contents" style={{ gridTemplateColumns: gridTemplate }}>
      <span className="flex items-center justify-end truncate pr-2.5 text-[11px] text-mid">
        {row.label}
      </span>
      {row.cells.map((cell, i) => (
        <button
          className={cn(
            "tnum relative flex min-h-10 items-center justify-center rounded-md font-mono font-semibold text-[11px] transition-transform hover:scale-[1.06]",
            tierClass[cell.tier]
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: positional grid cell
          key={`${row.label}-${i}`}
          type="button"
        >
          {cell.peak && (
            <span className="absolute top-1 right-1.5 size-[5px] rounded-full bg-white/90" />
          )}
          {cell.value}
        </button>
      ))}
    </div>
  );
}
