import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const bannerVariants = cva(
  "flex items-start gap-3.5 rounded-md border p-4 [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "border-border bg-secondary [&>svg]:text-mid",
        ember:
          "border-primary/28 bg-accent [&>svg]:text-acc-deep [&_[data-banner-title]]:text-acc-deep",
        positive: "border-pos/26 bg-pos/10 [&>svg]:text-pos",
        negative: "border-neg/26 bg-neg/10 [&>svg]:text-neg",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

type BannerProps = React.ComponentProps<"div"> &
  VariantProps<typeof bannerVariants> & {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    onDismiss?: () => void;
  };

export function Banner({
  className,
  variant,
  icon,
  title,
  description,
  action,
  onDismiss,
  ...props
}: BannerProps) {
  return (
    <div
      className={cn(bannerVariants({ variant, className }))}
      data-slot="banner"
      {...props}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div
          className="font-semibold text-foreground text-sm"
          data-banner-title
        >
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-[13px] text-mid">{description}</div>
        )}
      </div>
      {action}
      {onDismiss && (
        <button
          aria-label="Dismiss"
          className="shrink-0 text-low transition-colors hover:text-foreground"
          onClick={onDismiss}
          type="button"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
