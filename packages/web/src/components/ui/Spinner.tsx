import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-itv-border border-t-itv-accent",
        className
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md bg-gradient-to-r from-itv-surface via-itv-surface2 to-itv-surface",
        "bg-[length:200%_100%] animate-shimmer",
        className
      )}
    />
  );
}
