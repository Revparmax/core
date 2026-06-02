import { ChevronRight } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex flex-wrap items-center gap-2.5 text-[13.5px] text-mid",
        className
      )}
      data-slot="breadcrumb"
      {...props}
    />
  );
}

function BreadcrumbLink({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      className={cn(
        "flex items-center gap-1.5 text-mid transition-colors hover:text-acc-deep [&_svg]:size-3.5",
        className
      )}
      data-slot="breadcrumb-link"
      {...props}
    />
  );
}

function BreadcrumbSeparator() {
  return (
    <span className="text-low" data-slot="breadcrumb-separator">
      <ChevronRight className="size-3.5" />
    </span>
  );
}

function BreadcrumbCurrent({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={cn("font-semibold text-foreground", className)}
      data-slot="breadcrumb-current"
      {...props}
    />
  );
}

export { Breadcrumb, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbCurrent };
