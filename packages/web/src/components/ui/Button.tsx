import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "gold" | "live" | "ghost" | "subtle";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Disables the button, sets aria-busy, and shows an inline spinner. */
  isLoading?: boolean;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-itv-magenta text-white hover:bg-itv-magenta-strong hover:shadow-glow-magenta",
  gold: "bg-itv-gold text-itv-bg hover:brightness-105 hover:shadow-glow-gold",
  live: "bg-itv-live text-white hover:brightness-105 hover:shadow-glow-live",
  ghost:
    "bg-transparent border border-itv-border text-itv-text hover:bg-itv-hover",
  subtle: "bg-itv-surface2 text-itv-text hover:bg-itv-surface3",
};

const sizes: Record<Size, string> = {
  sm: "gap-1.5 rounded-sm px-3 py-1.5 text-xs",
  md: "gap-2 rounded-md px-4 py-2.5 text-sm",
  lg: "gap-2.5 rounded-lg px-6 py-3 text-[15px]",
};

/**
 * Class builder shared by Button. Use it directly on non-button elements
 * (e.g. next/link `<Link className={buttonClasses("gold", "sm")}>`) to reuse
 * Button styling without nesting interactive elements.
 */
export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string
): string {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap font-medium",
    "transition-[background-color,box-shadow,border-color] duration-[--dur-fast] ease-[--ease-out]",
    "active:translate-y-px active:brightness-95",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-itv-magenta",
    "disabled:pointer-events-none disabled:opacity-40",
    sizes[size],
    styles[variant],
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    { variant = "primary", size = "md", className, isLoading, disabled, children, ...props },
    ref
  ) => (
    <button
      ref={ref}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color-mix(in_srgb,currentColor_30%,transparent)] border-t-current"
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
