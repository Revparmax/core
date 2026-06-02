import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn("flex flex-col gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  children,
  value,
  ...props
}: RadioPrimitive.Root.Props & { value: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <RadioPrimitive.Root
        className={cn(
          "flex size-[19px] shrink-0 items-center justify-center rounded-full border-[1.6px] border-input bg-card outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-45 data-[checked]:border-primary",
          className
        )}
        data-slot="radio-group-item"
        value={value}
        {...props}
      >
        <RadioPrimitive.Indicator className="size-[9px] rounded-full bg-primary" />
      </RadioPrimitive.Root>
      {children}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
