import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  axisProps,
  ChartTooltip,
  gridProps,
} from "@/components/charts/chart-theme";
import { Badge } from "@/components/ui/badge";
import { useReveal } from "@/lib/use-reveal";
import { cn } from "@/lib/utils";

export interface RidgePoint {
  adr: number;
  revenue: number;
}

const RidgeTooltip = (props: {
  active?: boolean;
  payload?: Array<{ payload: RidgePoint }>;
}) => {
  const p = props.payload?.[0]?.payload;
  if (!(props.active && p)) {
    return null;
  }
  return (
    <ChartTooltip
      active
      rows={[{ key: "Revenue", value: `$${p.revenue.toFixed(1)}K` }]}
      title={`ADR $${p.adr}`}
    />
  );
};

/** The "revenue ridge" — expected revenue across every ADR at forecast occupancy. */
export function OptimalAdrChart({
  data,
  currentIndex,
  optimalIndex,
  className,
}: {
  data: RidgePoint[];
  currentIndex: number;
  optimalIndex: number;
  className?: string;
}) {
  const { ref, lit } = useReveal<HTMLDivElement>();
  const current = data[currentIndex];
  const optimal = data[optimalIndex];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-lit={lit}
      data-slot="optimal-adr-chart"
      ref={ref}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(460px_240px_at_78%_-10%,var(--ember-wash),transparent_60%)]"
      />
      <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display font-semibold text-lg tracking-tight">
            Revenue by ADR · at 90% occupancy
          </div>
          <div className="mt-1 font-mono text-[10.5px] text-mid uppercase tracking-wide">
            Current ${current?.adr} → optimal ${optimal?.adr}
          </div>
        </div>
        <Badge variant="ember">+12.2% uplift</Badge>
      </div>
      <div className="relative h-[200px] w-full">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
          >
            <defs>
              <linearGradient id="rpm-ridge-area" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.18}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="adr"
              {...axisProps}
              tickFormatter={(v: number) => `$${v}`}
            />
            <YAxis
              {...axisProps}
              tickFormatter={(v: number) => `$${v}k`}
              width={40}
            />
            <Tooltip content={<RidgeTooltip />} cursor={false} />
            <Area
              dataKey="revenue"
              dot={false}
              fill="url(#rpm-ridge-area)"
              isAnimationActive={lit}
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              type="monotone"
            />
            <ReferenceLine
              stroke="color-mix(in srgb, var(--chart-1) 55%, var(--border))"
              strokeDasharray="2 4"
              x={optimal?.adr}
            />
            {current && (
              <ReferenceDot
                fill="var(--chart-2)"
                r={5}
                stroke="var(--card)"
                strokeWidth={2.5}
                x={current.adr}
                y={current.revenue}
              />
            )}
            {optimal && (
              <ReferenceDot
                fill="var(--chart-1)"
                r={5.5}
                stroke="var(--card)"
                strokeWidth={2.5}
                x={optimal.adr}
                y={optimal.revenue}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
