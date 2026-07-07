import { cn } from "@/lib/cn";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

function initials(name?: string) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  src,
  name,
  size = "md",
  ring,
  className,
}: {
  src?: string | null;
  name?: string;
  size?: Size;
  /** highlight ring — e.g. live creator or patron tier */
  ring?: "magenta" | "gold" | "live";
  className?: string;
}) {
  const ringCls =
    ring === "magenta"
      ? "ring-2 ring-itv-magenta ring-offset-2 ring-offset-itv-bg"
      : ring === "gold"
        ? "ring-2 ring-itv-gold ring-offset-2 ring-offset-itv-bg"
        : ring === "live"
          ? "ring-2 ring-itv-live ring-offset-2 ring-offset-itv-bg"
          : "";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-itv-surface3 font-semibold text-itv-muted",
        sizes[size],
        ringCls,
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
