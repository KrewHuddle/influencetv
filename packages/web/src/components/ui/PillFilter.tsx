"use client";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface PillOption {
  value: string;
  label: string;
}

/**
 * Horizontal row of pill-shaped filter chips. Single-select, controlled.
 * Exposed as a radiogroup with roving tabindex + arrow-key navigation.
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
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const select = (index: number) => {
    const next = options[index];
    if (!next) return;
    onChange(next.value);
    refs.current[index]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (options.length === 0) return;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft")
      next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next !== null) {
      e.preventDefault();
      select(next);
    }
  };

  return (
    <div
      role="radiogroup"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={active}
            tabIndex={active || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-[--dur-fast]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-itv-accent",
              active
                ? "border-transparent bg-itv-accent text-itv-bg"
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
