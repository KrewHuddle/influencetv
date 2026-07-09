"use client";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { ChannelGuide, type GuideChannel } from "@/components/channel/ChannelGuide";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { PillFilter } from "@/components/ui/PillFilter";

export default function LiveTVPage() {
  const [filter, setFilter] = useState("all");
  const { data, error, isLoading, mutate } = useSWR<{ channels: GuideChannel[] }>(
    "/api/channels/guide",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const all = data?.channels ?? [];
  const now = Date.now();
  const isLiveNow = (c: GuideChannel) =>
    c.items?.some(
      (it) =>
        new Date(it.start_time).getTime() <= now &&
        new Date(it.end_time).getTime() > now
    );
  const channels = filter === "live" ? all.filter(isLiveNow) : all;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-itv-text">Live TV Guide</h1>
        <PillFilter
          options={[
            { value: "all", label: "All Channels" },
            { value: "live", label: "Live Now" },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-itv-border py-12 text-center">
          <p className="text-sm text-itv-muted">Couldn&apos;t load the guide.</p>
          <Button variant="subtle" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      ) : channels.length ? (
        <ChannelGuide channels={channels} />
      ) : (
        <p className="rounded-lg border border-dashed border-itv-border py-12 text-center text-sm text-itv-muted">
          {filter === "live" ? "Nothing live right now." : "No channels available yet."}
        </p>
      )}
    </div>
  );
}
