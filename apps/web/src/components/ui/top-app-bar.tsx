import { Bell, ChevronDown, Search } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type TopAppBarProps = React.ComponentProps<"header"> & {
  scope?: { label: string; value: React.ReactNode };
  search?: { placeholder?: string; shortcut?: string; onClick?: () => void };
  actions?: React.ReactNode;
};

/**
 * Workspace-level app bar — brand mark on the left, an optional scope chip,
 * a click-to-open search trigger that opens the command palette in product
 * use, and trailing actions / notifications on the right.
 */
export function TopAppBar({
  className,
  scope,
  search,
  actions,
  children,
  ...props
}: TopAppBarProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-3.5 rounded-lg border border-border bg-card px-3.5 py-2.5",
        className
      )}
      data-slot="top-app-bar"
      {...props}
    >
      <div className="flex items-center gap-2.5">
        <BrandMark />
      </div>
      {scope && (
        <button
          className="inline-flex items-center gap-2 rounded-md border border-input bg-surface-2 px-2.5 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary"
          data-slot="top-app-bar-scope"
          type="button"
        >
          <span className="font-mono text-[9px] text-low uppercase tracking-[0.12em]">
            {scope.label}
          </span>
          <span>{scope.value}</span>
          <ChevronDown className="size-3.5 text-mid" />
        </button>
      )}
      {search && (
        <button
          className="flex min-w-[160px] max-w-[420px] flex-1 cursor-text items-center gap-2 rounded-md border border-input bg-surface-2 px-3 py-2 text-[13.5px] text-low transition-colors hover:border-primary"
          data-slot="top-app-bar-search"
          onClick={search.onClick}
          type="button"
        >
          <Search className="size-3.5" />
          <span className="truncate text-left">
            {search.placeholder ?? "Search…"}
          </span>
          {search.shortcut && (
            <span className="ml-auto rounded-sm border border-input px-1.5 py-[1px] font-mono text-[10px] text-mid">
              {search.shortcut}
            </span>
          )}
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <NotificationButton />
        {children}
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <span
      className="font-display font-semibold text-[15px] text-foreground tracking-tight"
      data-slot="top-app-bar-brand"
    >
      RevPAR
      <span className="font-normal text-primary">MAX</span>
    </span>
  );
}

function NotificationButton() {
  return (
    <button
      aria-label="Notifications"
      className="relative inline-flex size-9 items-center justify-center rounded-md border border-input bg-transparent text-mid transition-colors hover:border-transparent hover:bg-accent hover:text-acc-deep"
      data-slot="top-app-bar-notifications"
      type="button"
    >
      <Bell className="size-4" />
      <span
        aria-hidden
        className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary ring-2 ring-card"
      />
    </button>
  );
}
