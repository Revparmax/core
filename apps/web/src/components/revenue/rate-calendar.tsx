import { cn } from "@/lib/utils";

export interface RateDay {
  day: number;
  /** 0–1 demand intensity */
  demand: number;
  muted?: boolean;
  peak?: boolean;
  recommendation?: boolean;
  value: string;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Published ADR with demand intensity baked into each cell. */
export function RateCalendar({
  title,
  subtitle,
  days,
  leadBlanks = 0,
  className,
}: {
  title: string;
  subtitle?: string;
  days: RateDay[];
  leadBlanks?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-slot="rate-calendar"
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

      <div className="grid grid-cols-7 gap-1.5">
        {DOW.map((d) => (
          <span
            className="pb-1 text-center font-mono text-[9.5px] text-low uppercase tracking-wide"
            key={d}
          >
            {d}
          </span>
        ))}
        {Array.from({ length: leadBlanks }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: leading blank cell
          <span key={`blank-${i}`} />
        ))}
        {days.map((d) => (
          <div
            className={cn(
              "relative flex min-h-[74px] cursor-pointer flex-col gap-1 rounded-[10px] border border-border p-2.5 transition-transform hover:-translate-y-px hover:border-primary",
              d.peak && "border-primary/38 bg-accent",
              d.muted && "opacity-40"
            )}
            key={d.day}
          >
            {d.recommendation && (
              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary" />
            )}
            <span className="font-mono text-[11px] text-mid">{d.day}</span>
            <span
              className={cn(
                "tnum font-mono font-semibold text-sm",
                d.peak ? "text-acc-deep" : "text-foreground"
              )}
            >
              {d.value}
            </span>
            <span className="mt-auto h-1 overflow-hidden rounded-full bg-bar">
              <span
                className={cn(
                  "block h-full rounded-full",
                  d.peak ? "bg-primary" : "bg-mid"
                )}
                style={{ width: `${Math.round(d.demand * 100)}%` }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
