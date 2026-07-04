import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, className, id, ...props }, ref) => (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          "w-full rounded-md border border-apex bg-apex-gray-900 px-3.5 py-2.5",
          "text-sm text-apex-white placeholder:text-[color:var(--text-muted)]",
          "focus:border-apex-red focus:outline-none",
          className
        )}
        {...props}
      />
    </label>
  )
);
Input.displayName = "Input";
