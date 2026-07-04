import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
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
      <div className="relative aspect-video overflow-hidden rounded-lg bg-apex-gray-800">
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt={video.title}
            fill
            sizes="(max-width:768px) 50vw, 300px"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-apex-gray-800" />
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
          <Play className="text-white" />
        </div>
        {video.duration_seconds ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px]">
            {formatDuration(video.duration_seconds)}
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 line-clamp-1 text-sm font-medium">{video.title}</h3>
      <p className="text-xs text-[color:var(--text-secondary)]">
        {video.creator_name ?? "Apex"} · {formatCount(video.view_count)} views
      </p>
    </Link>
  );
}
