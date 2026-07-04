"use client";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { ChannelGuide, type GuideChannel } from "@/components/channel/ChannelGuide";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";

export default function LiveTVPage() {
  const [liveOnly, setLiveOnly] = useState(false);
  const { data, isLoading } = useSWR<{ channels: GuideChannel[] }>(
    "/api/channels/guide",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const channels = data?.channels ?? [];

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl">Live TV Guide</h1>
        <Button
          variant={liveOnly ? "primary" : "ghost"}
          className="px-3 py-1.5 text-xs"
          onClick={() => setLiveOnly((v) => !v)}
        >
          {liveOnly ? "Showing Live" : "Live Now Only"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : channels.length ? (
        <ChannelGuide channels={channels} />
      ) : (
        <p className="text-sm text-[color:var(--text-muted)]">
          No channels available yet.
        </p>
      )}
    </div>
  );
}
