"use client";
import Link from "next/link";

export interface GuideItem {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
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

/** Simple EPG grid: channels as rows, program blocks laid out by time. */
export function ChannelGuide({ channels }: { channels: GuideChannel[] }) {
  const now = Date.now();
  return (
    <div className="space-y-3">
      {channels.map((ch) => (
        <div
          key={ch.id}
          className="flex items-stretch gap-3 border-b border-apex pb-3"
        >
          <Link
            href={`/live/${ch.slug}`}
            className="flex w-40 shrink-0 items-center gap-2"
          >
            {ch.number != null && (
              <span className="font-display text-2xl italic text-white/20">
                {String(ch.number).padStart(2, "0")}
              </span>
            )}
            <span className="text-sm font-medium">{ch.name}</span>
          </Link>
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {ch.items.length === 0 && (
              <span className="text-xs text-[color:var(--text-muted)]">
                No programming
              </span>
            )}
            {ch.items.map((it) => {
              const started = new Date(it.start_time).getTime() <= now;
              const ended = new Date(it.end_time).getTime() < now;
              return (
                <div
                  key={it.id}
                  className={`min-w-[160px] rounded-md border border-apex px-3 py-2 text-xs ${
                    ended
                      ? "opacity-40"
                      : started
                        ? "border-apex-red/50"
                        : ""
                  }`}
                >
                  <p className="line-clamp-1 font-medium">{it.title}</p>
                  <p className="text-[color:var(--text-muted)]">
                    {timeLabel(it.start_time)}–{timeLabel(it.end_time)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
