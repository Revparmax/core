import { cn } from "@/lib/utils";

export interface Channel {
  amount: string;
  /** any CSS color; Direct should be ember to mark the valuable channel */
  color: string;
  name: string;
  pct: number;
  textDark?: boolean;
}

export function ChannelMix({
  channels,
  total,
  className,
}: {
  channels: Channel[];
  total: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]",
        className
      )}
      data-slot="channel-mix"
    >
      <div className="mb-1 font-display font-semibold text-lg tracking-tight">
        Revenue by channel · trailing 30 days
      </div>
      <div className="mb-4 font-mono text-[10.5px] text-mid uppercase tracking-wide">
        Portfolio · {total} total
      </div>
      <div className="flex h-[30px] gap-0.5 overflow-hidden rounded-lg">
        {channels.map((c) => (
          <div
            className={cn(
              "flex h-full min-w-0 items-center justify-center font-mono font-semibold text-[10px]",
              c.textDark ? "text-[#2a2722]" : "text-white"
            )}
            key={c.name}
            style={{ width: `${c.pct}%`, backgroundColor: c.color }}
          >
            {c.pct}%
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {channels.map((c) => (
          <div className="flex items-center gap-2.5" key={c.name}>
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: c.color }}
            />
            <span className="text-[13px]">{c.name}</span>
            <span className="ml-auto font-mono text-[11px] text-mid">
              {c.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
