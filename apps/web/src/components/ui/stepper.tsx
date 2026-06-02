import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface StepperProps {
  className?: string;
  defaultValue?: number;
  max?: number;
  min?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  value?: number;
}

/** Discrete numeric input for small bounded counts — min LOS, lead days, blocks. */
export function Stepper({
  value,
  defaultValue = 0,
  onValueChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  className,
}: StepperProps) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;

  const set = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    setInternal(clamped);
    onValueChange?.(clamped);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-md border border-input bg-card",
        className
      )}
      data-slot="stepper"
    >
      <button
        aria-label="Decrease"
        className="flex h-[42px] w-[38px] items-center justify-center text-foreground transition-colors hover:bg-accent hover:text-acc-deep"
        onClick={() => set(current - step)}
        type="button"
      >
        <Minus className="size-4" />
      </button>
      <span className="tnum flex h-[42px] min-w-14 items-center justify-center border-border border-x font-mono font-semibold text-foreground text-sm">
        {current}
      </span>
      <button
        aria-label="Increase"
        className="flex h-[42px] w-[38px] items-center justify-center text-foreground transition-colors hover:bg-accent hover:text-acc-deep"
        onClick={() => set(current + step)}
        type="button"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
