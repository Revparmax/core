import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
import { useReveal } from "@/lib/use-reveal";
import { cn } from "@/lib/utils";

export interface PacePoint {
  label: string;
  lastYear: number;
  thisYear: number;
}

const PaceTooltip = (props: {
  active?: boolean;
  payload?: Array<{ payload: PacePoint }>;
}) => {
  const p = props.payload?.[0]?.payload;
  if (!(props.active && p)) {
    return null;
  }
  return (
    <ChartTooltip
      active
      rows={[
        { key: "This year", value: `${p.thisYear}%` },
        { key: "Last year", value: `${p.lastYear}%` },
      ]}
      title={p.label}
    />
  );
};

export function PaceChart({
  data,
  nowIndex,
  className,
}: {
  data: PacePoint[];
  nowIndex: number;
  className?: string;
}) {
  const { ref, lit } = useReveal<HTMLDivElement>();
  const last = data.at(-1);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-lit={lit}
      data-slot="pace-chart"
      ref={ref}
    >
      <div className="mb-4 font-display font-semibold text-lg tracking-tight">
        Booking pace · cumulative occupancy
      </div>
      <div className="h-[188px] w-full">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 10, bottom: 0, left: -8 }}
          >
            <defs>
              <linearGradient id="rpm-pace-area" x1="0" x2="0" y1="0" y2="1">
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
            <XAxis dataKey="label" {...axisProps} />
            <YAxis
              {...axisProps}
              tickFormatter={(v: number) => `${v}%`}
              width={36}
            />
            <Tooltip
              content={<PaceTooltip />}
              cursor={{
                stroke: "var(--chart-1)",
                strokeDasharray: "3 3",
                strokeOpacity: 0.6,
              }}
            />
            <Line
              dataKey="lastYear"
              dot={false}
              isAnimationActive={lit}
              stroke="var(--chart-2)"
              strokeDasharray="5 5"
              strokeWidth={2}
              type="monotone"
            />
            <Area
              dataKey="thisYear"
              dot={false}
              fill="url(#rpm-pace-area)"
              isAnimationActive={lit}
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              type="monotone"
            />
            <ReferenceLine
              stroke="color-mix(in srgb, var(--chart-1) 55%, var(--border))"
              strokeDasharray="2 4"
              x={data[nowIndex]?.label}
            />
            {last && (
              <ReferenceDot
                fill="var(--chart-1)"
                r={4.5}
                stroke="var(--card)"
                strokeWidth={2.5}
                x={last.label}
                y={last.thisYear}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
