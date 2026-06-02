import type * as React from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  action?: React.ReactNode;
  className?: string;
  description?: string;
  icon?: React.ReactNode;
  title: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-11 text-center",
        className
      )}
      data-slot="empty-state"
    >
      {icon && (
        <div className="mb-4.5 flex size-[58px] items-center justify-center rounded-2xl bg-bar text-mid dark:bg-white/6 [&>svg]:size-7">
          {icon}
        </div>
      )}
      <h4 className="font-display font-semibold text-foreground text-lg">
        {title}
      </h4>
      {description && (
        <p className="mt-1.5 max-w-[38ch] text-[13.5px] text-mid">
          {description}
        </p>
      )}
      {action && <div className="mt-4.5">{action}</div>}
    </div>
  );
}
