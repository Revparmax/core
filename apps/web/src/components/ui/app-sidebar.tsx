import { ChevronDown } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export interface SidebarItem {
  count?: number;
  icon: React.ReactNode;
  id: string;
  label: string;
}

export interface SidebarSection {
  items: SidebarItem[];
  label: string;
}

interface AppSidebarProps {
  activeId: string;
  className?: string;
  onSelect: (id: string) => void;
  property?: { name: string; location: string };
  sections: SidebarSection[];
}

/** The primary navigation rail, with a property switcher pinned to the foot. */
export function AppSidebar({
  sections,
  activeId,
  onSelect,
  property,
  className,
}: AppSidebarProps) {
  return (
    <nav
      className={cn(
        "flex w-[248px] flex-col gap-1 border-border border-r bg-secondary p-3.5",
        className
      )}
      data-slot="app-sidebar"
    >
      <div className="flex items-center gap-2.5 px-2 pt-1 pb-4">
        <svg className="size-6" fill="none" viewBox="0 0 48 48">
          <title>RevPARMAX</title>
          <rect
            height="44"
            rx="12"
            stroke="currentColor"
            strokeWidth="2.4"
            width="44"
            x="2"
            y="2"
          />
          <path
            d="M12 33 L24 17 L36 33"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <circle cx="24" cy="17" fill="var(--primary)" r="3.2" />
        </svg>
        <span className="font-display font-semibold text-base tracking-tight">
          RevPAR<span className="font-normal">MAX</span>
        </span>
      </div>

      {sections.map((section) => (
        <div key={section.label}>
          <div className="px-2.5 pt-3.5 pb-1.5 font-mono text-[9px] text-low uppercase tracking-[0.16em]">
            {section.label}
          </div>
          {section.items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 font-medium text-[13.5px] transition-colors [&>svg]:size-4",
                  active
                    ? "bg-accent font-bold text-acc-deep"
                    : "text-mid hover:bg-accent hover:text-foreground"
                )}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                {item.icon}
                {item.label}
                {item.count != null && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 font-mono text-[10px]",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-bar text-mid"
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {property && (
        <button
          className="mt-auto flex items-center gap-2.5 border-border border-t px-2 pt-3 pb-1"
          type="button"
        >
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-[linear-gradient(135deg,#3a3b33,#23241e)] text-primary">
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <title>Property</title>
              <path
                d="M4 21V8l6-4 6 4v13M4 21h12M9 21v-4h2v4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="flex min-w-0 flex-col text-left leading-tight">
            <span className="truncate font-semibold text-[13px] text-foreground">
              {property.name}
            </span>
            <span className="font-mono text-[10px] text-mid">
              {property.location}
            </span>
          </span>
          <ChevronDown className="ml-auto size-3.5 text-low" />
        </button>
      )}
    </nav>
  );
}
