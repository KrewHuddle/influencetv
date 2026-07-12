"use client";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Validation message. Sets aria-invalid and renders below the input. */
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  (
    { label, error, className, id, "aria-describedby": ariaDescribedBy, ...props },
    ref
  ) => {
    const errorId = useId();
    const describedBy =
      [ariaDescribedBy, error ? errorId : null].filter(Boolean).join(" ") ||
      undefined;
    return (
      <label className="block">
        {label && (
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-itv-muted">
            {label}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-md border border-itv-border bg-itv-surface px-3.5 py-2.5",
            "text-sm text-itv-text placeholder:text-itv-faint",
            "transition-colors duration-[--dur-fast] focus:border-itv-accent",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-itv-accent",
            "disabled:opacity-40 disabled:pointer-events-none",
            error && "border-itv-live",
            className
          )}
          {...props}
        />
        {error && (
          <span id={errorId} className="mt-1 block text-xs text-itv-live">
            {error}
          </span>
        )}
      </label>
    );
  }
);
Input.displayName = "Input";
