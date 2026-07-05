"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { formatCount } from "@/lib/constants";

interface Video {
  id: string;
  title: string;
  description?: string | null;
  hls_url: string | null;
  thumbnail_url?: string | null;
  creator_name?: string | null;
  view_count?: number | null;
  published_at?: string | null;
}

export default function WatchPage({
  params,
}: {
  params: { videoId: string };
}) {
  const { videoId } = params;
  const { data, isLoading } = useSWR<{ video: Video }>(
    `/api/videos/${videoId}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const video = data?.video;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {isLoading ? (
        <Skeleton className="aspect-video w-full" />
      ) : video?.hls_url ? (
        <VideoPlayer hlsUrl={video.hls_url} posterUrl={video.thumbnail_url ?? undefined} autoPlay={false} />
      ) : (
        <div className="grid aspect-video place-items-center rounded-lg border border-apex bg-apex-gray-900 text-sm text-[color:var(--text-muted)]">
          Video unavailable
        </div>
      )}

      <div className="mt-4">
        <h1 className="font-display text-2xl">{video?.title ?? "Untitled"}</h1>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          {video?.creator_name ?? "Influence TV"} · {formatCount(video?.view_count)} views
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" className="text-xs">Add to Watchlist</Button>
          <Button variant="ghost" className="text-xs">Share</Button>
        </div>
        {video?.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-[color:var(--text-secondary)]">
            {video.description}
          </p>
        )}
      </div>
    </div>
  );
}
