import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "magenta" | "gold" | "live" | "success" | "warn";

const tones: Record<Tone, string> = {
  neutral: "bg-itv-surface2 text-itv-muted",
  magenta: "bg-itv-magenta-dim text-itv-magenta ring-1 ring-inset ring-itv-magenta-border",
  gold: "bg-itv-gold-dim text-itv-gold ring-1 ring-inset ring-itv-gold-border",
  live: "bg-itv-live-dim text-itv-live",
  success: "bg-itv-success-dim text-itv-success",
  warn: "bg-itv-warn-dim text-itv-warn",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
