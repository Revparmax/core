import { Check, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface ComboOption {
  label: string;
  meta?: string;
  value: string;
}

interface ComboboxProps {
  className?: string;
  emptyText?: string;
  onValueChange: (value: string[]) => void;
  options: ComboOption[];
  placeholder?: string;
  value: string[];
}

/** Typeahead multi-select with removable ember tokens. */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Add…",
  emptyText = "No matches.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.meta?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  const toggle = (v: string) => {
    onValueChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v]
    );
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn("relative", className)}
      data-slot="combobox"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: focuses inner input */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-2 transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
          open && "border-ring ring-[3px] ring-ring/20"
        )}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((v) => {
          const opt = options.find((o) => o.value === v);
          return (
            <span
              className="inline-flex items-center gap-1.5 rounded-md bg-accent py-1 pr-1.5 pl-2.5 font-semibold text-[12.5px] text-acc-deep"
              key={v}
            >
              {opt?.label ?? v}
              <button
                aria-label={`Remove ${opt?.label ?? v}`}
                className="text-acc-deep/70 hover:text-acc-deep"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v);
                }}
                type="button"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
        <input
          aria-controls={listId}
          aria-expanded={open}
          className="min-w-20 flex-1 bg-transparent py-1 text-[13.5px] text-foreground outline-none placeholder:text-low"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          ref={inputRef}
          value={query}
        />
      </div>

      {open && (
        <div
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 max-h-60 overflow-y-auto rounded-md border border-input bg-popover p-1.5 shadow-[0_24px_54px_-26px_rgb(0_0_0/0.55)]"
          id={listId}
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="px-2.5 py-3.5 text-center text-[13px] text-mid">
              {emptyText}
            </div>
          ) : (
            filtered.map((o) => {
              const selected = value.includes(o.value);
              return (
                <button
                  aria-selected={selected}
                  className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[13.5px] text-foreground hover:bg-accent"
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  role="option"
                  type="button"
                >
                  <Check
                    className={cn(
                      "size-4 text-primary",
                      selected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {o.label}
                  {o.meta && (
                    <span className="ml-auto font-mono text-[11px] text-low">
                      {o.meta}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
