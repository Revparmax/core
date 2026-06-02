import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-mono text-[10px] uppercase tracking-wide [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-bar px-2.5 py-1 text-mid",
        ember: "bg-ember-50 px-2.5 py-1 text-ember-600 dark:bg-accent",
        live: "bg-ember-50 px-2.5 py-1 text-ember-600 dark:bg-accent",
        win: "bg-pos/15 px-2.5 py-1 text-pos",
        loss: "bg-neg/15 px-2.5 py-1 text-neg",
        partial: "bg-bar px-2.5 py-1 text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

function Badge({
  className,
  variant,
  dot,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span
      className={cn(badgeVariants({ variant, className }))}
      data-slot="badge"
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full bg-current",
            variant === "live" && "animate-pulse bg-primary"
          )}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
