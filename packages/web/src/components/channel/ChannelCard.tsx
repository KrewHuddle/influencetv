import Link from "next/link";
import { LiveBadge } from "./LiveBadge";
import { formatCount } from "@/lib/constants";
import { Card } from "@/components/ui/Card";

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
    <Link href={`/live/${channel.slug}`} className="block w-72 shrink-0">
      <Card interactive className="relative overflow-hidden p-4">
        <div className="flex items-start justify-between">
          <div>
            {isLive ? (
              <LiveBadge />
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-widest text-itv-faint">
                Offline
              </span>
            )}
            <h3 className="mt-2 font-display text-lg font-semibold text-itv-text">
              {channel.name}
            </h3>
            <p className="text-xs text-itv-muted">
              {channel.current_show ?? channel.genre ?? "—"}
            </p>
          </div>
          {channel.number != null && (
            <span className="select-none font-display text-5xl font-bold italic text-white/[0.06]">
              {String(channel.number).padStart(2, "0")}
            </span>
          )}
        </div>
        <p className="mt-4 font-mono text-xs tabular-nums text-itv-faint">
          {isLive ? `${formatCount(channel.viewer_count)} watching` : "—"}
        </p>
      </Card>
    </Link>
  );
}
