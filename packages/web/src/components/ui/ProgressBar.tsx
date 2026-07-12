import { cn } from "@/lib/cn";

type Tone = "accent" | "gold" | "live" | "success";

const fills: Record<Tone, string> = {
  accent: "bg-itv-accent",
  gold: "bg-itv-gold",
  live: "bg-itv-live",
  success: "bg-itv-success",
};

/** Thin determinate progress bar. `value` is 0–100. */
export function ProgressBar({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-itv-surface3", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-[--dur] ease-[--ease-out]", fills[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
