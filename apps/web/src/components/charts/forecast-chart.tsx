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
import { Badge } from "@/components/ui/badge";
import { formatCompactUSD, useCountUp } from "@/lib/format";
import { useReveal } from "@/lib/use-reveal";
import { cn } from "@/lib/utils";

export interface ForecastPoint {
  /** actuals (null in the forecast window) */
  actual: number | null;
  /** [lower, upper] confidence band, only on forecast points */
  band?: [number, number];
  /** modeled forecast (null in the actuals window) */
  forecast: number | null;
  month: string;
}

interface ForecastChartProps {
  className?: string;
  data: ForecastPoint[];
  /** index where actuals end / forecast begins */
  nowIndex: number;
  projectedDelta?: string;
  projectedLabel?: string;
  projectedValue: number;
}

const CartesianTooltip = (props: {
  active?: boolean;
  payload?: Array<{ payload: ForecastPoint }>;
}) => {
  const point = props.payload?.[0]?.payload;
  if (!(props.active && point)) {
    return null;
  }
  const isForecast = point.actual == null;
  const headline = point.actual ?? point.forecast ?? 0;
  const rows = [
    {
      key: isForecast ? "Forecast" : "Revenue",
      value: formatCompactUSD(headline),
    },
  ];
  if (point.band) {
    rows.push({
      key: "Band",
      value: `${formatCompactUSD(point.band[0])} – ${formatCompactUSD(point.band[1])}`,
    });
  }
  return (
    <ChartTooltip
      active
      rows={rows}
      title={`${point.month}${isForecast ? " · modeled" : ""}`}
    />
  );
};

/**
 * Projected revenue with a confidence band that widens as certainty falls.
 * Lines draw on (recharts animation) and the headline counts up when the chart
 * scrolls into view; the live edge glows ember.
 */
export function ForecastChart({
  data,
  nowIndex,
  projectedLabel = "Projected · Dec",
  projectedValue,
  projectedDelta,
  className,
}: ForecastChartProps) {
  const { ref, lit } = useReveal<HTMLDivElement>();
  const counted = useCountUp(projectedValue / 1000, lit, {
    duration: 1100,
    decimals: 0,
  });
  const last = data.at(-1);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-lit={lit}
      data-slot="forecast-chart"
      ref={ref}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(460px_240px_at_82%_-12%,var(--ember-wash),transparent_60%)]"
      />
      <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display font-semibold text-foreground text-lg tracking-tight">
            Revenue forecast · 12 months
          </div>
          <div className="mt-1 font-mono text-[10.5px] text-mid uppercase tracking-wide">
            Portfolio · actuals → modeled · 88% confidence band
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10.5px] text-mid uppercase tracking-wide">
            {projectedLabel}
          </div>
          <div className="tnum font-display font-medium text-2xl text-acc-deep tracking-tight">
            ${counted}K
          </div>
          {projectedDelta && (
            <div className="font-bold text-[12px] text-pos">
              ▲ {projectedDelta}
            </div>
          )}
        </div>
      </div>

      <div className="relative h-[210px] w-full">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 10, bottom: 0, left: -8 }}
          >
            <defs>
              <linearGradient id="rpm-fc-area" x1="0" x2="0" y1="0" y2="1">
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
              dataKey="month"
              {...axisProps}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              {...axisProps}
              tickFormatter={(v: number) => formatCompactUSD(v)}
              width={48}
            />
            <Tooltip
              content={<CartesianTooltip />}
              cursor={{
                stroke: "var(--chart-1)",
                strokeDasharray: "3 3",
                strokeOpacity: 0.6,
              }}
            />
            {/* confidence band */}
            <Area
              activeDot={false}
              dataKey="band"
              dot={false}
              fill="var(--chart-1)"
              fillOpacity={0.14}
              isAnimationActive={lit}
              stroke="none"
              type="monotone"
            />
            {/* actuals */}
            <Area
              dataKey="actual"
              dot={false}
              fill="url(#rpm-fc-area)"
              isAnimationActive={lit}
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              type="monotone"
            />
            {/* forecast (dashed) */}
            <Line
              connectNulls
              dataKey="forecast"
              dot={false}
              isAnimationActive={lit}
              stroke="var(--chart-1)"
              strokeDasharray="7 5"
              strokeWidth={2.5}
              type="monotone"
            />
            <ReferenceLine
              stroke="color-mix(in srgb, var(--chart-1) 55%, var(--border))"
              strokeDasharray="2 4"
              x={data[nowIndex]?.month}
            />
            {last && (
              <ReferenceDot
                fill="var(--chart-1)"
                r={5}
                stroke="var(--card)"
                strokeWidth={2.5}
                x={last.month}
                y={last.forecast ?? 0}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="relative mt-3.5 flex flex-wrap gap-4 text-[11.5px] text-mid">
        <Legend color="var(--chart-1)" label="Actuals" />
        <Legend color="var(--chart-1)" dashed label="Forecast" />
        <Badge variant="ember">88% confidence band</Badge>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-0.5 w-4 rounded"
        style={
          dashed
            ? { borderTop: `2px dashed ${color}` }
            : { backgroundColor: color }
        }
      />
      {label}
    </span>
  );
}
