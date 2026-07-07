import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, className, id, ...props }, ref) => (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-itv-muted">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          "w-full rounded-md border border-itv-border bg-itv-surface px-3.5 py-2.5",
          "text-sm text-itv-text placeholder:text-itv-faint",
          "transition-colors duration-[--dur-fast] focus:border-itv-magenta focus:outline-none",
          className
        )}
        {...props}
      />
    </label>
  )
);
Input.displayName = "Input";
