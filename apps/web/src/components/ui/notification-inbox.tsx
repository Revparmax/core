import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface Notification {
  group: string;
  icon?: React.ReactNode;
  id: string;
  time: string;
  title: React.ReactNode;
  tone?: "ember" | "positive" | "negative" | "neutral";
  unread?: boolean;
}

const toneClass = {
  ember: "bg-accent text-acc-deep",
  positive: "bg-pos/15 text-pos",
  negative: "bg-neg/14 text-neg",
  neutral: "bg-bar text-mid",
} as const;

export function NotificationInbox({
  notifications,
  className,
}: {
  notifications: Notification[];
  className?: string;
}) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [items, setItems] = useState(notifications);

  const shown = useMemo(
    () => (tab === "unread" ? items.filter((i) => i.unread) : items),
    [items, tab]
  );
  const unread = items.filter((i) => i.unread).length;
  const groups = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const n of shown) {
      const arr = map.get(n.group) ?? [];
      arr.push(n);
      map.set(n.group, arr);
    }
    return [...map.entries()];
  }, [shown]);

  const markRead = (id?: string) =>
    setItems((prev) =>
      prev.map((n) => (id == null || n.id === id ? { ...n, unread: false } : n))
    );

  return (
    <div
      className={cn(
        "w-full max-w-[420px] overflow-hidden rounded-lg border border-input bg-card shadow-[var(--shadow-card)]",
        className
      )}
      data-slot="notification-inbox"
    >
      <div className="flex items-center justify-between border-border border-b px-4 py-3.5">
        <h4 className="font-display font-semibold text-base">Notifications</h4>
        <button
          className="font-semibold text-[12.5px] text-acc-deep hover:underline"
          onClick={() => markRead()}
          type="button"
        >
          Mark all read
        </button>
      </div>
      <div className="flex gap-5 border-border border-b px-4 pt-2">
        {(["all", "unread"] as const).map((t) => (
          <button
            className={cn(
              "relative pb-2.5 font-semibold text-[13px]",
              tab === t ? "text-foreground" : "text-mid",
              tab === t &&
                "after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:rounded after:bg-primary"
            )}
            key={t}
            onClick={() => setTab(t)}
            type="button"
          >
            {t === "all" ? "All" : "Unread"}
            {t === "unread" && unread > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 py-px font-mono text-[10px] text-acc-deep">
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="max-h-[330px] overflow-y-auto">
        {groups.map(([group, groupItems]) => (
          <div key={group}>
            <div className="px-4 pt-3 pb-1.5 font-mono text-[9.5px] text-low uppercase tracking-[0.14em]">
              {group}
            </div>
            {groupItems.map((n) => (
              <button
                className={cn(
                  "relative flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary",
                  n.unread &&
                    "bg-[color-mix(in_srgb,var(--primary)_5%,var(--card))]"
                )}
                key={n.id}
                onClick={() => markRead(n.id)}
                type="button"
              >
                {n.unread && (
                  <span className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <span
                  className={cn(
                    "flex size-[34px] shrink-0 items-center justify-center rounded-md [&>svg]:size-4",
                    toneClass[n.tone ?? "neutral"]
                  )}
                >
                  {n.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] text-foreground leading-snug">
                    {n.title}
                  </span>
                  <span className="mt-1 block font-mono text-[10.5px] text-low">
                    {n.time}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
