import { cn } from "@/lib/utils";

interface MeterProps {
  className?: string;
  label?: React.ReactNode;
  max?: number;
  showValue?: boolean;
  /** ember (default) or positive-green semantic */
  tone?: "ember" | "positive";
  value: number;
}

/** Determinate horizontal progress / signal-strength bar. */
export function Meter({
  label,
  value,
  max = 100,
  tone = "ember",
  showValue = true,
  className,
}: MeterProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="meter">
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <span className="text-[13px] text-foreground">{label}</span>
          )}
          {showValue && (
            <span
              className={cn(
                "tnum font-mono font-semibold text-xs",
                tone === "positive" ? "text-pos" : "text-mid"
              )}
            >
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div className="h-[7px] overflow-hidden rounded-full bg-bar dark:bg-white/8">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            tone === "positive" ? "bg-pos" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
