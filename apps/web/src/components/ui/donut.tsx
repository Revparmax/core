import { cn } from "@/lib/utils";

interface DonutProps {
  className?: string;
  label?: string;
  max?: number;
  size?: number;
  tone?: "ember" | "positive";
  value: number;
}

/** Single headline ratio with a mono read-out at center. */
export function Donut({
  value,
  max = 100,
  label,
  tone = "ember",
  size = 132,
  className,
}: DonutProps) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circ * (1 - pct);
  return (
    <div
      className={cn("inline-flex flex-col items-center gap-3", className)}
      data-slot="donut"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg aria-hidden className="size-full -rotate-90" viewBox="0 0 120 120">
          <circle
            className="fill-none stroke-bar dark:stroke-white/8"
            cx="60"
            cy="60"
            r={r}
            strokeWidth="11"
          />
          <circle
            className={cn(
              "fill-none transition-[stroke-dashoffset] duration-700 ease-out",
              tone === "positive" ? "stroke-pos" : "stroke-primary"
            )}
            cx="60"
            cy="60"
            r={r}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="11"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum font-display font-semibold text-3xl text-foreground tracking-tight">
            {Math.round(pct * 100)}%
          </span>
          {label && (
            <span className="mt-0.5 font-mono text-[9px] text-mid uppercase tracking-[0.13em]">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
