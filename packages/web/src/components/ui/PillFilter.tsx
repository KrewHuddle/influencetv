"use client";
import { cn } from "@/lib/cn";

export interface PillOption {
  value: string;
  label: string;
}

/**
 * Horizontal row of pill-shaped filter chips. Single-select, controlled.
 */
export function PillFilter({
  options,
  value,
  onChange,
  className,
}: {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-[--dur-fast]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itv-magenta focus-visible:ring-offset-2 focus-visible:ring-offset-itv-bg",
              active
                ? "border-transparent bg-itv-magenta text-white"
                : "border-itv-border bg-itv-surface text-itv-muted hover:border-itv-border2 hover:text-itv-text"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
