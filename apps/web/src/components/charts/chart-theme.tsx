import type { ReactNode } from "react";

/**
 * Brand chart tokens — reference the CSS variables so charts theme in light &
 * dark automatically. Pass these strings straight to recharts stroke/fill.
 */
export const chartColors = {
  ember: "var(--chart-1)",
  neutral: "var(--chart-2)",
  positive: "var(--chart-3)",
  negative: "var(--chart-4)",
  low: "var(--chart-5)",
  grid: "var(--border)",
  axis: "var(--low)",
} as const;

export const axisProps = {
  stroke: "transparent",
  tick: {
    fill: "var(--low)",
    fontSize: 10,
    fontFamily: "var(--font-mono)",
  },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: "var(--border)",
  strokeDasharray: "0",
  vertical: false,
} as const;

interface TooltipRow {
  key: string;
  value: string;
}

export function ChartTooltip({
  active,
  title,
  rows,
}: {
  active?: boolean;
  title?: ReactNode;
  rows?: TooltipRow[];
}) {
  if (!(active && rows?.length)) {
    return null;
  }
  return (
    <div className="rounded-[10px] bg-foreground px-3 py-2 text-background shadow-lg dark:bg-[#f0efe9] dark:text-[#1a1714]">
      {title && (
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide opacity-70">
          {title}
        </div>
      )}
      {rows.map((r) => (
        <div
          className="flex items-center justify-between gap-4 text-[12.5px] leading-relaxed"
          key={r.key}
        >
          <span className="opacity-70">{r.key}</span>
          <span className="font-mono font-semibold">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
