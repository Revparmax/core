import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

/**
 * Continuous adjustment with a live ember read-out — the control behind the
 * counterfactual simulator's "Change ADR" and any what-if input.
 */
function Slider({ className, ...props }: SliderPrimitive.Root.Props) {
  return (
    <SliderPrimitive.Root
      className={cn("w-full", className)}
      data-slot="slider"
      {...props}
    >
      <SliderPrimitive.Control className="flex w-full touch-none select-none items-center py-2">
        <SliderPrimitive.Track className="h-1.5 w-full rounded-full bg-bar-2 dark:bg-white/14">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          <SliderPrimitive.Thumb className="size-[18px] rounded-full border-[3px] border-primary bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
