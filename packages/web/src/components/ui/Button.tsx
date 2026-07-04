import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "subtle";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: "bg-apex-red text-white hover:bg-apex-red/90",
  ghost: "bg-transparent border border-white/20 text-apex-white hover:bg-white/[0.08]",
  subtle: "bg-apex-gray-800 text-apex-white hover:bg-apex-gray-700",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5",
        "text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
        styles[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
