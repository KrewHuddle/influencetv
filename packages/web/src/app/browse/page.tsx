"use client";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoCard, type VideoSummary } from "@/components/video/VideoCard";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Spinner";

const GENRES = ["All", "Drama", "News", "Entertainment", "Comedy", "Sports"];
const SORTS = ["new", "popular", "trending"];

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
    <div className="px-6 py-6">
      <Input
        placeholder="Search videos…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className={`rounded-full px-3 py-1 text-xs ${
              genre === g ? "bg-apex-red text-white" : "border border-apex text-[color:var(--text-secondary)]"
            }`}
          >
            {g}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto rounded border border-apex bg-apex-gray-900 px-2 py-1 text-xs"
        >
          {SORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video" />)}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--text-muted)]">No results.</p>
      )}
    </div>
  );
}
