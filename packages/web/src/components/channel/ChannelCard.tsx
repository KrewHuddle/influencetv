import Link from "next/link";
import { LiveBadge } from "./LiveBadge";
import { formatCount } from "@/lib/constants";

export interface ChannelSummary {
  id: string;
  name: string;
  slug: string;
  genre?: string | null;
  status: string;
  viewer_count?: number | null;
  current_show?: string | null;
  number?: number;
}

export function ChannelCard({ channel }: { channel: ChannelSummary }) {
  const isLive = channel.status === "active";
  return (
    <Link
      href={`/live/${channel.slug}`}
      className="group relative block w-72 shrink-0 overflow-hidden rounded-lg border border-apex bg-apex-gray-900 p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          {isLive && <LiveBadge />}
          <h3 className="mt-2 font-display text-lg">{channel.name}</h3>
          <p className="text-xs text-[color:var(--text-secondary)]">
            {channel.current_show ?? channel.genre ?? "—"}
          </p>
        </div>
        {channel.number != null && (
          <span className="select-none font-display text-5xl italic text-white/10">
            {String(channel.number).padStart(2, "0")}
          </span>
        )}
      </div>
      <p className="mt-4 text-xs text-[color:var(--text-muted)]">
        {isLive ? `${formatCount(channel.viewer_count)} watching` : "Offline"}
      </p>
    </Link>
  );
}
