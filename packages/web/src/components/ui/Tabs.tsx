"use client";
import { useRef, type KeyboardEvent } from "react";
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
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = items.findIndex((t) => t.value === value);

  const select = (index: number) => {
    const next = items[index];
    if (!next) return;
    onChange(next.value);
    refs.current[index]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (items.length === 0) return;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next !== null) {
      e.preventDefault();
      select(next);
    }
  };

  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-6 border-b border-itv-border",
        className
      )}
    >
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
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
