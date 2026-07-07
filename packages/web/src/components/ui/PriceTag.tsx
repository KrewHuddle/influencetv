import { cn } from "@/lib/cn";

/** Formats integer cents as a currency string. */
export function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Monospace price display (tabular figures) with optional struck-through
 * original price for sales.
 */
export function PriceTag({
  cents,
  compareAtCents,
  currency = "USD",
  size = "md",
  className,
}: {
  cents: number;
  compareAtCents?: number | null;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls =
    size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm";
  const onSale = compareAtCents != null && compareAtCents > cents;

  return (
    <span className={cn("inline-flex items-baseline gap-1.5 font-mono tabular-nums", sizeCls, className)}>
      <span className={cn("font-semibold", onSale ? "text-itv-live" : "text-itv-text")}>
        {formatPrice(cents, currency)}
      </span>
      {onSale && (
        <span className="text-itv-faint line-through">
          {formatPrice(compareAtCents!, currency)}
        </span>
      )}
    </span>
  );
}
