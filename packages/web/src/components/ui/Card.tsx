import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** interactive cards lift + glow on hover */
  interactive?: boolean;
  /** surface elevation level */
  tone?: "surface" | "surface2";
}

export const Card = forwardRef<HTMLDivElement, Props>(
  ({ interactive, tone = "surface", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-itv-border",
        tone === "surface2" ? "bg-itv-surface2" : "bg-itv-surface",
        interactive &&
          "cursor-pointer transition-[transform,border-color,box-shadow] duration-[--dur] ease-[--ease-out] hover:-translate-y-0.5 hover:border-itv-accent-border hover:shadow-card",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";
