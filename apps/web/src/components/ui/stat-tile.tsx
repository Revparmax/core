import { cn } from "@/lib/utils";

interface StatTileProps {
  className?: string;
  delta?: string;
  direction?: "up" | "down";
  label: string;
  value: React.ReactNode;
}

/** Compact KPI tile — packs four-up across a header. */
export function StatTile({
  label,
  value,
  delta,
  direction = "up",
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-secondary px-4 py-3.5",
        className
      )}
      data-slot="stat-tile"
    >
      <div className="font-mono text-[9.5px] text-mid uppercase tracking-[0.13em]">
        {label}
      </div>
      <div className="tnum mt-1.5 font-display font-medium text-2xl text-foreground tracking-tight">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 font-bold text-[11.5px]",
            direction === "up" ? "text-pos" : "text-neg"
          )}
        >
          {direction === "up" ? "▲" : "▼"} {delta}
        </div>
      )}
    </div>
  );
}
