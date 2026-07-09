"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoGrid } from "@/components/video/VideoGrid";
import type { VideoSummary } from "@/components/video/VideoCard";

const FALLBACK: VideoSummary[] = [
  { id: "nw1", title: "Evening Desk: Top Stories", creator_name: "Influence News", duration_seconds: 540, view_count: 61200 },
  { id: "nw2", title: "Market Watch", creator_name: "Influence News", duration_seconds: 320, view_count: 22800 },
  { id: "nw3", title: "City Hall Recap", creator_name: "Influence News", duration_seconds: 410, view_count: 17400 },
  { id: "nw4", title: "The Weekend Brief", creator_name: "Influence News", duration_seconds: 600, view_count: 28900 },
  { id: "nw5", title: "Culture Report", creator_name: "Influence News", duration_seconds: 480, view_count: 34100 },
  { id: "nw6", title: "Late Brief", creator_name: "Influence News", duration_seconds: 260, view_count: 12600 },
];

export default function NewsPage() {
  const { data } = useSWR<{ items: VideoSummary[] }>(
    "/api/browse?category=news",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const items = data?.items?.length ? data.items : FALLBACK;

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">News</h1>
      <p className="mb-6 text-[12px] text-itv-muted">
        Breaking coverage, market watch, and culture from the Influence newsroom.
      </p>
      <VideoGrid items={items} />
    </div>
  );
}
