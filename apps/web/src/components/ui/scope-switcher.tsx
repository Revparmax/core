import { ChevronRight, Grid2x2, Hotel, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ScopeLevel {
  id: string;
  kind: "portfolio" | "region" | "property";
  label: string;
}

const ICON = {
  portfolio: Grid2x2,
  region: MapPin,
  property: Hotel,
} as const;

interface ScopeSwitcherProps {
  activeId: string;
  className?: string;
  levels: ScopeLevel[];
  onSelect: (id: string) => void;
}

/**
 * The lens for the whole product. A property-management group rolls up across
 * the portfolio, optionally a region, down to one property.
 */
export function ScopeSwitcher({
  levels,
  activeId,
  onSelect,
  className,
}: ScopeSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border border-input bg-card",
        className
      )}
      data-slot="scope-switcher"
    >
      {levels.map((level, i) => {
        const Icon = ICON[level.kind];
        const active = level.id === activeId;
        return (
          <div className="flex items-stretch" key={level.id}>
            {i > 0 && (
              <span className="flex items-center text-low">
                <ChevronRight className="size-3.5" />
              </span>
            )}
            <button
              className={cn(
                "flex min-w-0 items-center gap-3 px-3.5 py-2 transition-colors hover:bg-accent",
                active && "bg-accent"
              )}
              onClick={() => onSelect(level.id)}
              type="button"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md bg-bar text-mid",
                  active && "bg-primary text-primary-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="font-mono text-[9px] text-low uppercase tracking-[0.13em]">
                  {level.kind}
                </span>
                <span className="truncate font-semibold text-[13px] text-foreground">
                  {level.label}
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
