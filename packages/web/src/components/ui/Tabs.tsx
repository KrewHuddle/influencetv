"use client";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: string;
}

/** Underline-style tab bar. Controlled via value/onChange. */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-6 border-b border-itv-border",
        className
      )}
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative -mb-px whitespace-nowrap border-b-2 px-0.5 py-3 text-sm font-medium transition-colors duration-[--dur-fast]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itv-magenta focus-visible:rounded-sm",
              active
                ? "border-itv-magenta text-itv-text"
                : "border-transparent text-itv-muted hover:text-itv-text"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
