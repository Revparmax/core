import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface CommandItem {
  group: string;
  icon?: React.ReactNode;
  id: string;
  label: string;
  meta?: string;
  onSelect?: () => void;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  placeholder?: string;
}

/** Keyboard-first jump to anything. Toggle with the host's shortcut (⌘K). */
export function CommandPalette({
  items,
  open,
  onOpenChange,
  placeholder = "Search or jump to…",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.group) ?? [];
      arr.push(it);
      map.set(it.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    setActive(0);
  }, []);

  const run = (item: CommandItem) => {
    item.onSelect?.();
    onOpenChange?.(false);
  };

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-foreground/26 backdrop-blur-[2px] data-closed:animate-out data-open:animate-in" />
        <DialogPrimitive.Popup
          className="data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 fixed top-[12vh] left-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-input bg-popover shadow-[0_30px_70px_-30px_rgb(0_0_0/0.6)] outline-none data-closed:animate-out data-open:animate-in"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(filtered.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && filtered[active]) {
              run(filtered[active]);
            }
          }}
        >
          <div className="flex items-center gap-3 border-border border-b px-4.5 py-4">
            <Search className="size-4.5 text-mid" />
            {/** biome-ignore lint/a11y/noAutofocus: command palette is intentional */}
            <input
              autoFocus
              className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-low"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              value={query}
            />
            <span className="rounded border border-input px-1.5 py-0.5 font-mono text-[10px] text-mid">
              ESC
            </span>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {groups.length === 0 ? (
              <div className="px-2.5 py-6 text-center text-[13px] text-mid">
                No results.
              </div>
            ) : (
              groups.map(([group, groupItems]) => (
                <div className="px-1 pb-1" key={group}>
                  <div className="px-2.5 pt-2 pb-1.5 font-mono text-[9.5px] text-low uppercase tracking-[0.14em]">
                    {group}
                  </div>
                  {groupItems.map((item) => {
                    const isActive = filtered[active]?.id === item.id;
                    return (
                      <button
                        className={cn(
                          "flex w-full items-center gap-3 rounded-sm px-2.5 py-2.5 text-left text-[14px] text-foreground",
                          isActive ? "bg-accent" : "hover:bg-accent"
                        )}
                        key={item.id}
                        onClick={() => run(item)}
                        onMouseEnter={() =>
                          setActive(filtered.findIndex((f) => f.id === item.id))
                        }
                        type="button"
                      >
                        {item.icon && (
                          <span
                            className={cn(
                              "flex size-7.5 items-center justify-center rounded-md bg-bar text-mid [&>svg]:size-3.5",
                              isActive && "bg-primary text-primary-foreground"
                            )}
                          >
                            {item.icon}
                          </span>
                        )}
                        {item.label}
                        {item.meta && (
                          <span className="ml-auto font-mono text-[10px] text-low">
                            {item.meta}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-4 border-border border-t px-4 py-2.5 font-mono text-[10px] text-mid">
            <span>
              <kbd className="mr-1.5 rounded border border-input px-1.5">
                ↑↓
              </kbd>
              navigate
            </span>
            <span>
              <kbd className="mr-1.5 rounded border border-input px-1.5">↵</kbd>
              open
            </span>
            <span>
              <kbd className="mr-1.5 rounded border border-input px-1.5">
                esc
              </kbd>
              close
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
