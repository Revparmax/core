import { cn } from "@/lib/utils";

interface SparklineProps {
  area?: boolean;
  className?: string;
  data: number[];
  height?: number;
  tone?: "ember" | "positive" | "negative";
  width?: number;
}

const stroke = {
  ember: "var(--chart-1)",
  positive: "var(--chart-3)",
  negative: "var(--chart-4)",
} as const;

/** Inline trend, no axis. Renders a normalized SVG path with an optional fill. */
export function Sparkline({
  data,
  tone = "ember",
  width = 120,
  height = 32,
  area = false,
  className,
}: SparklineProps) {
  if (data.length < 2) {
    return null;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const last = points.at(-1);

  return (
    <svg
      aria-hidden
      className={cn("overflow-visible", className)}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {area && last && (
        <path
          d={`${line} L${last[0]},${height} L${points[0][0]},${height} Z`}
          fill={stroke[tone]}
          opacity={0.12}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={stroke[tone]}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      {last && <circle cx={last[0]} cy={last[1]} fill={stroke[tone]} r={2.6} />}
    </svg>
  );
}
