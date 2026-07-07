import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "gold" | "live" | "ghost" | "subtle";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-itv-magenta text-white hover:bg-itv-magenta-strong hover:shadow-glow-magenta",
  gold: "bg-itv-gold text-itv-bg hover:brightness-105 hover:shadow-glow-gold",
  live: "bg-itv-live text-white hover:brightness-105 hover:shadow-glow-live",
  ghost:
    "bg-transparent border border-itv-border text-itv-text hover:bg-white/[0.06]",
  subtle: "bg-itv-surface2 text-itv-text hover:bg-itv-surface3",
};

const sizes: Record<Size, string> = {
  sm: "gap-1.5 rounded-sm px-3 py-1.5 text-xs",
  md: "gap-2 rounded-md px-4 py-2.5 text-sm",
  lg: "gap-2.5 rounded-lg px-6 py-3 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium",
        "transition-[background-color,box-shadow,border-color] duration-[--dur-fast] ease-[--ease-out]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-itv-magenta focus-visible:ring-offset-2 focus-visible:ring-offset-itv-bg",
        "disabled:pointer-events-none disabled:opacity-40",
        sizes[size],
        styles[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
