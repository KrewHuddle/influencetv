import Link from "next/link";
import { formatCount, formatDuration } from "@/lib/constants";
import { Card } from "@/components/ui/Card";

export interface VideoSummary {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  creator_name?: string | null;
  creator_username?: string | null;
  duration_seconds?: number | null;
  view_count?: number | null;
}

export function VideoCard({ video }: { video: VideoSummary }) {
  return (
    <div className="w-full">
      <Link href={`/watch/${video.id}`} className="group block" aria-label={video.title}>
        <Card interactive className="overflow-hidden">
          <div className="relative aspect-video bg-itv-surface3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnail_url || "/placeholder.svg"}
              alt={video.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {video.duration_seconds ? (
              <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-itv-text">
                {formatDuration(video.duration_seconds)}
              </span>
            ) : null}
          </div>
          <div className="p-3">
            <h3 className="line-clamp-1 text-[13px] font-semibold text-itv-text">{video.title}</h3>
          </div>
        </Card>
      </Link>
      <p className="mt-1 px-1 text-xs text-itv-muted">
        <CreatorLink name={video.creator_name} username={video.creator_username} /> ·{" "}
        {formatCount(video.view_count)} views
      </p>
    </div>
  );
}

/** Bridges to the unified Creator Hub when a username is present. */
export function CreatorLink({
  name,
  username,
}: {
  name?: string | null;
  username?: string | null;
}) {
  const label = name ?? "Influence TV";
  if (!username) return <span>{label}</span>;
  return (
    <Link href={`/creator/${username}`} className="transition-colors hover:text-itv-magenta">
      {label}
    </Link>
  );
}
