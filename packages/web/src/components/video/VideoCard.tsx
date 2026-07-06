import Link from "next/link";
import { formatCount, formatDuration } from "@/lib/constants";

export interface VideoSummary {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  creator_name?: string | null;
  duration_seconds?: number | null;
  view_count?: number | null;
}

export function VideoCard({ video }: { video: VideoSummary }) {
  return (
    <Link
      href={`/watch/${video.id}`}
      className="group block w-full"
      aria-label={video.title}
    >
      <div className="relative aspect-video overflow-hidden rounded-[4px] bg-apex-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail_url || "/placeholder.svg"}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
        {video.duration_seconds ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px]">
            {formatDuration(video.duration_seconds)}
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 line-clamp-1 text-sm font-medium">{video.title}</h3>
      <p className="text-xs text-[color:var(--text-secondary)]">
        {video.creator_name ?? "Influence TV"} · {formatCount(video.view_count)} views
      </p>
    </Link>
  );
}
