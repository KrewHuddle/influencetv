"use client";
import { useState } from "react";
import Link from "next/link";

export interface GuideItem {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  genre?: string | null;
}
export interface GuideChannel {
  id: string;
  name: string;
  slug: string;
  number?: number;
  items: GuideItem[];
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const PX_PER_MIN = 4;
const mins = (a: string, b: string) =>
  Math.max(20, (new Date(b).getTime() - new Date(a).getTime()) / 60000);

/** Two-column EPG: channel rail (left) + time-based schedule grid (right). */
export function ChannelGuide({ channels }: { channels: GuideChannel[] }) {
  const now = Date.now();
  const [active, setActive] = useState(channels[0]?.id ?? null);

  return (
    <div className="overflow-hidden border border-itv-border">
      {channels.map((ch) => {
        const isActive = ch.id === active;
        const current = ch.items.find(
          (it) => new Date(it.start_time).getTime() <= now && new Date(it.end_time).getTime() > now
        );
        return (
          <div key={ch.id} className="flex border-b border-itv-border last:border-b-0">
            {/* channel rail cell */}
            <div
              className={`flex h-16 w-[140px] shrink-0 items-center gap-3 px-4 text-left sm:w-[220px] ${
                isActive ? "border-l-2 border-itv-magenta bg-itv-magenta-dim" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setActive(ch.id)}
                aria-label={`Select ${ch.name}`}
                className="flex shrink-0 items-center gap-1.5"
              >
                <span className="w-6 text-left text-[13px] font-black text-itv-magenta">
                  {ch.number != null ? String(ch.number).padStart(2, "0") : "—"}
                </span>
                {current && <span className="h-1.5 w-1.5 rounded-full bg-itv-magenta" />}
              </button>
              <span className="min-w-0 flex-1">
                <Link href={`/live/${ch.slug}`} className="block truncate text-[12px] font-bold hover:text-itv-magenta">
                  {ch.name}
                </Link>
                <span className="hidden truncate text-[10px] text-itv-faint sm:block">
                  {current?.title ?? "Off air"}
                </span>
              </span>
            </div>

            {/* schedule blocks */}
            <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-1 items-center gap-1 overflow-x-auto px-2">
              {ch.items.length === 0 && (
                <span className="text-[10px] text-itv-faint">No programming</span>
              )}
              {ch.items.map((it) => {
                const started = new Date(it.start_time).getTime() <= now;
                const ended = new Date(it.end_time).getTime() < now;
                const isCurrent = started && !ended;
                return (
                  <div
                    key={it.id}
                    className={`h-[56px] shrink-0 border border-dashed border-itv-border2 bg-itv-surface px-3 py-2 ${
                      ended ? "opacity-40" : ""
                    } ${isCurrent ? "border-l-2 border-l-itv-magenta" : ""}`}
                    style={{ width: mins(it.start_time, it.end_time) * PX_PER_MIN }}
                  >
                    <p className="line-clamp-1 text-[11px] font-bold">{it.title}</p>
                    <p className="text-[9px] text-itv-faint">
                      {it.genre ? `${it.genre} · ` : ""}
                      {timeLabel(it.start_time)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
