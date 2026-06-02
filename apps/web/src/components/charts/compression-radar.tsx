import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { useReveal } from "@/lib/use-reveal";
import { cn } from "@/lib/utils";

export interface CompressionSignal {
  now: number;
  prior: number;
  signal: string;
}

export function CompressionRadar({
  data,
  score,
  className,
}: {
  data: CompressionSignal[];
  score: number;
  className?: string;
}) {
  const { ref, lit } = useReveal<HTMLDivElement>();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-lit={lit}
      data-slot="compression-radar"
      ref={ref}
    >
      <div className="mb-1 font-display font-semibold text-lg tracking-tight">
        Market compression
      </div>
      <div className="mb-4 font-mono text-[10.5px] text-mid uppercase tracking-wide">
        6 signals · now vs 30 days ago
      </div>
      <div className="grid items-center gap-6 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="h-[260px] w-full">
          <ResponsiveContainer height="100%" width="100%">
            <RadarChart data={data} outerRadius="78%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="signal"
                tick={{
                  fill: "var(--mid)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              />
              <Radar
                dataKey="prior"
                fill="none"
                isAnimationActive={lit}
                stroke="var(--chart-2)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <Radar
                dataKey="now"
                fill="var(--chart-1)"
                fillOpacity={0.2}
                isAnimationActive={lit}
                stroke="var(--chart-1)"
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="flex items-center gap-4 rounded-lg border border-primary/26 bg-accent p-4">
            <div className="tnum font-display font-semibold text-[46px] text-acc-deep leading-none">
              {score}
              <span className="text-lg text-mid">/100</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[15px]">Compression: High</span>
              <span className="font-mono text-[10.5px] text-acc-deep">
                ▲ Accelerating · +10 in 30d
              </span>
            </div>
          </div>
          <div className="mt-4">
            {data.map((s) => (
              <div
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-border border-t py-2 first:border-t-0"
                key={s.signal}
              >
                <span className="text-[13px]">{s.signal}</span>
                <span className="tnum font-mono font-semibold text-[12px] text-foreground">
                  {s.now}
                  <span className="ml-2 text-[10.5px] text-pos">
                    +{s.now - s.prior}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
