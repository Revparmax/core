import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "flat" | "ember";

const deltaColor: Record<Direction, string> = {
  up: "text-pos",
  down: "text-neg",
  flat: "text-mid",
  ember: "text-acc-deep",
};

const deltaGlyph: Record<Direction, string> = {
  up: "▲",
  down: "▼",
  flat: "",
  ember: "▲",
};

export interface MetricCardProps {
  children?: React.ReactNode;
  className?: string;
  delta?: string;
  deltaNote?: string;
  direction?: Direction;
  /** ember focus treatment for the one metric being steered */
  focus?: boolean;
  label: string;
  value: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  delta,
  direction = "up",
  deltaNote,
  focus = false,
  children,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-5",
        focus && "border-primary/40",
        className
      )}
      data-slot="metric-card"
    >
      {focus && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(340px_200px_at_86%_4%,var(--ember-wash),transparent_62%)]"
        />
      )}
      <div className="relative font-mono text-[10px] text-mid uppercase tracking-[0.14em]">
        {label}
      </div>
      <div className="tnum relative mt-3 font-display font-medium text-3xl text-foreground tracking-tight">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "relative mt-2 flex items-center gap-1.5 font-bold text-[13px]",
            deltaColor[direction]
          )}
        >
          {deltaGlyph[direction]} {delta}
          {deltaNote && (
            <span className="font-medium text-mid">{deltaNote}</span>
          )}
        </div>
      )}
      {children && <div className="relative mt-3.5">{children}</div>}
    </div>
  );
}
