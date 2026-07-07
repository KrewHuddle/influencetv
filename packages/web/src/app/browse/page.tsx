"use client";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoCard, type VideoSummary } from "@/components/video/VideoCard";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Spinner";
import { PillFilter } from "@/components/ui/PillFilter";

const GENRES = ["All", "Drama", "News", "Entertainment", "Comedy", "Sports"];
const SORTS = [
  { value: "new", label: "New" },
  { value: "popular", label: "Popular" },
  { value: "trending", label: "Trending" },
];

export default function BrowsePage() {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("All");
  const [sort, setSort] = useState("new");

  const key = `/api/browse?sort=${sort}${genre !== "All" ? `&genre=${genre}` : ""}${
    q ? `&q=${encodeURIComponent(q)}` : ""
  }`;
  const { data, isLoading } = useSWR<{ items: VideoSummary[] }>(key, swrFetcher, {
    shouldRetryOnError: false,
  });
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-itv-text">Watch</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PillFilter
          options={GENRES.map((g) => ({ value: g, label: g }))}
          value={genre}
          onChange={setGenre}
        />
        <PillFilter options={SORTS} value={sort} onChange={setSort} />
      </div>

      <Input
        placeholder="Search videos…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-6 max-w-md"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-itv-border py-12 text-center text-sm text-itv-muted">
          No results.
        </p>
      )}
    </div>
  );
}
