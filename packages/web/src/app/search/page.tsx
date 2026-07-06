"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoGrid } from "@/components/video/VideoGrid";
import type { VideoSummary } from "@/components/video/VideoCard";

const POOL: VideoSummary[] = [
  { id: "s1", title: "The Last Broadcast — Ep 4", creator_name: "Influence Drama", duration_seconds: 1400, view_count: 82000 },
  { id: "s2", title: "Live Shopping Recap", creator_name: "Influence TV", duration_seconds: 520, view_count: 41000 },
  { id: "s3", title: "Creator Spotlight: Nova", creator_name: "Nova King", duration_seconds: 990, view_count: 120000 },
  { id: "s4", title: "Camera Basics", creator_name: "Influence Academy", duration_seconds: 640, view_count: 18200 },
  { id: "s5", title: "Evening Desk: Top Stories", creator_name: "Influence News", duration_seconds: 540, view_count: 61000 },
  { id: "s6", title: "Midnight Cypher", creator_name: "Mars", duration_seconds: 700, view_count: 33000 },
  { id: "s7", title: "Growth Playbook", creator_name: "Influence Academy", duration_seconds: 1220, view_count: 40300 },
  { id: "s8", title: "Market Watch", creator_name: "Influence News", duration_seconds: 320, view_count: 22800 },
];

function SearchResults() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();

  const { data } = useSWR<{ items: VideoSummary[] }>(
    q ? `/api/browse?q=${encodeURIComponent(q)}` : null,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const lc = q.toLowerCase();
  const fallback = q
    ? POOL.filter(
        (v) =>
          v.title.toLowerCase().includes(lc) ||
          (v.creator_name ?? "").toLowerCase().includes(lc)
      )
    : [];
  const items = data?.items?.length ? data.items : fallback;

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">
        {q ? `Results for “${q}”` : "Search"}
      </h1>
      <p className="mb-6 text-[12px] text-white/[0.55]">
        {q ? `${items.length} result${items.length === 1 ? "" : "s"}` : "Type a query in the header search."}
      </p>
      <VideoGrid items={items} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="px-6 py-6 text-sm text-white/[0.42]">Searching…</div>}>
      <SearchResults />
    </Suspense>
  );
}
