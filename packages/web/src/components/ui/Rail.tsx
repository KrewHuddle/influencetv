import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Horizontal scroll rail with an optional titled header + "see all" link.
 * Children are laid out in a scroll-snapping row; each child sizes itself.
 */
export function Rail({
  title,
  href,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  href?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || action || href) && (
        <div className="flex items-end justify-between gap-4 px-1">
          {title && (
            <h2 className="font-display text-lg font-semibold tracking-tight text-itv-text">
              {title}
            </h2>
          )}
          {action ??
            (href && (
              <Link
                href={href}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-itv-muted transition-colors hover:text-itv-accent"
              >
                See all
                <ChevronRight size={14} />
              </Link>
            ))}
        </div>
      )}
      <div
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          contentClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}
