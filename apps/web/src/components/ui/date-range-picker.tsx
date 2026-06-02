import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRange {
  end: Date | null;
  start: Date;
}

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PRESETS = [
  "Today",
  "Next 7 days",
  "Next 30 days",
  "This month",
  "Custom",
] as const;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function sameDay(a: Date | null, b: Date | null) {
  return !!a && !!b && a.toDateString() === b.toDateString();
}
function fmt(d: Date | null) {
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
}

interface DateRangePickerProps {
  className?: string;
  onValueChange: (range: DateRange) => void;
  value: DateRange;
}

export function DateRangePicker({
  value,
  onValueChange,
  className,
}: DateRangePickerProps) {
  const [month, setMonth] = useState(() => startOfMonth(value.start));
  const [preset, setPreset] = useState<string>("Custom");

  const total = daysInMonth(month);
  const lead = startOfMonth(month).getDay();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: total },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)
    ),
  ];

  const pick = (d: Date) => {
    setPreset("Custom");
    if (!value.end && d >= value.start) {
      onValueChange({ start: value.start, end: d });
    } else {
      onValueChange({ start: d, end: null });
    }
  };

  const inRange = (d: Date) => value.end && d > value.start && d < value.end;

  const nights =
    value.end != null
      ? Math.round((+value.end - +value.start) / 86_400_000)
      : 0;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-2.5 rounded-md border border-input bg-card px-3.5 py-2.5 text-[13.5px] text-foreground transition-colors hover:border-primary",
          className
        )}
      >
        <Calendar className="size-3.5 text-mid" />
        {fmt(value.start)} – {fmt(value.end)}, {value.start.getFullYear()}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="flex">
          <div className="flex min-w-[124px] flex-col gap-px border-border border-r p-2.5">
            {PRESETS.map((p) => (
              <button
                className={cn(
                  "rounded-sm px-2.5 py-2 text-left text-[13px] transition-colors",
                  preset === p
                    ? "bg-accent font-semibold text-acc-deep"
                    : "text-mid hover:bg-accent hover:text-foreground"
                )}
                key={p}
                onClick={() => setPreset(p)}
                type="button"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <button
                aria-label="Previous month"
                className="flex size-7 items-center justify-center rounded-md text-mid hover:bg-bar hover:text-foreground"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1)
                  )
                }
                type="button"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="font-display font-semibold text-sm">
                {month.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                aria-label="Next month"
                className="flex size-7 items-center justify-center rounded-md text-mid hover:bg-bar hover:text-foreground"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1)
                  )
                }
                type="button"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {DOW.map((d) => (
                <span
                  className="pb-1.5 text-center font-mono text-[9px] text-low uppercase"
                  key={d}
                >
                  {d}
                </span>
              ))}
              {cells.map((d, i) =>
                d ? (
                  <button
                    className={cn(
                      "flex aspect-square min-w-[34px] items-center justify-center font-mono text-[12.5px] text-foreground transition-colors hover:bg-accent",
                      inRange(d) && "rounded-none bg-accent",
                      sameDay(d, value.start) &&
                        "rounded-l-md bg-primary text-white",
                      sameDay(d, value.end) &&
                        "rounded-r-md bg-primary text-white",
                      !(
                        inRange(d) ||
                        sameDay(d, value.start) ||
                        sameDay(d, value.end)
                      ) && "rounded-md"
                    )}
                    key={d.toISOString()}
                    onClick={() => pick(d)}
                    type="button"
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: leading blank
                  <span key={`blank-${i}`} />
                )
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-border border-t px-3.5 py-3">
          <span className="font-mono text-[11.5px] text-mid">
            {fmt(value.start)} – {fmt(value.end)} · {nights} night
            {nights === 1 ? "" : "s"}
          </span>
          <Button size="sm">Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
