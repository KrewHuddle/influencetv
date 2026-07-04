import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        "bg-apex-gray-800 text-[color:var(--text-secondary)]",
        className
      )}
    >
      {children}
    </span>
  );
}
