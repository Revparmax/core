import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  label: React.ReactNode;
  value: T;
}

interface SegmentedProps<T extends string> {
  "aria-label"?: string;
  className?: string;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  value: T;
}

/**
 * Single-select range / view switcher. The active segment lifts onto an
 * elevated surface so selection reads without color — ember stays for data.
 */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  className,
  ...props
}: SegmentedProps<T>) {
  return (
    <div
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex gap-0.5 rounded-md bg-bar p-0.5 dark:bg-white/6",
        className
      )}
      data-slot="segmented"
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            aria-selected={active}
            className={cn(
              "rounded-sm px-3 py-1.5 font-mono text-xs transition-colors",
              active
                ? "bg-popover text-foreground shadow-sm dark:bg-[#2c2d26]"
                : "text-mid hover:text-foreground"
            )}
            data-state={active ? "active" : "inactive"}
            key={opt.value}
            onClick={() => onValueChange(opt.value)}
            role="tab"
            type="button"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
