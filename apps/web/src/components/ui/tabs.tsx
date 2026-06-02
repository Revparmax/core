import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-4", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn("flex gap-1 border-border border-b", className)}
      data-slot="tabs-list"
      {...props}
    />
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative mx-3 cursor-pointer border-none bg-transparent px-1 py-2.5 font-semibold text-mid text-sm outline-none transition-colors first:ml-0 hover:text-foreground data-[selected]:text-foreground",
        "after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:scale-x-0 after:rounded after:bg-primary after:transition-transform data-[selected]:after:scale-x-100",
        className
      )}
      data-slot="tabs-tab"
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn("outline-none", className)}
      data-slot="tabs-panel"
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTab, TabsPanel };
