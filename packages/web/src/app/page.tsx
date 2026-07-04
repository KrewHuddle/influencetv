"use client";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { LiveBadge } from "@/components/channel/LiveBadge";
import { ChannelCard, type ChannelSummary } from "@/components/channel/ChannelCard";
import { VideoRow } from "@/components/video/VideoRow";
import type { VideoSummary } from "@/components/video/VideoCard";

export default function HomePage() {
  const { data: channels } = useSWR<{ channels: ChannelSummary[] }>(
    "/api/channels",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const { data: forYou } = useSWR<{ items: VideoSummary[] }>(
    "/api/browse?sort=new",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const live = (channels?.channels ?? []).filter((c) => c.status === "active");
  const featured = live[0];

  return (
    <div className="px-6 py-6">
      {/* Hero */}
      <section className="relative mb-10 flex min-h-[45vh] items-center overflow-hidden rounded-2xl border border-apex bg-apex-gray-900 p-8">
        <div className="relative z-10 max-w-lg">
          {featured ? <LiveBadge /> : null}
          <h1 className="mt-3 font-display text-5xl md:text-6xl">
            {featured?.name ?? "APEX"}
          </h1>
          <p className="mt-2 text-[color:var(--text-secondary)]">
            {featured?.current_show ?? "Live TV, VOD, creators, and live shopping."}
          </p>
          <div className="mt-6 flex gap-3">
            <Link href={featured ? `/live/${featured.slug}` : "/live"}>
              <Button>Watch Now</Button>
            </Link>
            <Link href="/live">
              <Button variant="ghost">See Schedule</Button>
            </Link>
          </div>
        </div>
        <span className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 select-none font-display text-[200px] italic leading-none text-white/[0.06]">
          {featured?.number != null ? String(featured.number).padStart(2, "0") : "04"}
        </span>
      </section>

      {/* Live strip */}
      {live.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-sm tracking-wide">Live Now</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {live.map((c) => (
              <ChannelCard key={c.id} channel={c} />
            ))}
          </div>
        </section>
      )}

      <VideoRow title="For You" videos={forYou?.items ?? []} />
      <VideoRow title="New Uploads" videos={forYou?.items ?? []} />
    </div>
  );
}
