import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** Right-anchored side sheet for detail-on-demand without leaving the page. */
function Drawer({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-foreground/28 backdrop-blur-[1px] data-closed:animate-out data-open:animate-in" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(380px,86vw)] flex-col border-input border-l bg-card shadow-[-30px_0_60px_-30px_rgb(0_0_0/0.5)] outline-none transition-transform data-closed:translate-x-full data-open:translate-x-0",
          className
        )}
        data-slot="drawer-content"
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DrawerHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-border border-b px-5 py-4.5",
        className
      )}
      data-slot="drawer-header"
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Close"
        className="flex size-[30px] shrink-0 items-center justify-center rounded-md text-mid transition-colors hover:bg-bar hover:text-foreground"
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </div>
  );
}

function DrawerTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "font-display font-semibold text-foreground text-lg tracking-tight",
        className
      )}
      data-slot="drawer-title"
      {...props}
    />
  );
}

function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-4 overflow-y-auto p-5",
        className
      )}
      data-slot="drawer-body"
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex gap-2.5 border-border border-t px-5 py-3.5",
        className
      )}
      data-slot="drawer-footer"
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
};
