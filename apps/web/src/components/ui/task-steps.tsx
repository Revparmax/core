import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TaskStep {
  label: string;
  meta?: string;
  state: "done" | "active" | "pending";
}

/** A long, multi-step job shown mid-flight (done / active / pending). */
export function TaskSteps({
  steps,
  className,
}: {
  steps: TaskStep[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)} data-slot="task-steps">
      {steps.map((step) => (
        <div
          className={cn(
            "flex items-center gap-3 border-border border-t py-2.5 text-[13.5px] first:border-t-0",
            step.state === "pending" ? "text-mid" : "text-foreground"
          )}
          key={step.label}
        >
          <span
            className={cn(
              "flex size-[22px] shrink-0 items-center justify-center rounded-full",
              step.state === "done" && "bg-pos text-white",
              step.state === "active" && "border-2 border-primary",
              step.state === "pending" && "border-2 border-input"
            )}
          >
            {step.state === "done" && <Check className="size-3.5" />}
            {step.state === "active" && (
              <span className="size-[11px] animate-spin rounded-full border-2 border-input border-t-primary" />
            )}
          </span>
          {step.label}
          {step.meta && (
            <span className="ml-auto font-mono text-[11px] text-low">
              {step.meta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
