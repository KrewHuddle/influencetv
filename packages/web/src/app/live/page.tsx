"use client";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { ChannelGuide, type GuideChannel } from "@/components/channel/ChannelGuide";
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
        <h1 className="text-[22px] font-black">Live TV Guide</h1>
        <button
          onClick={() => setLiveOnly((v) => !v)}
          className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[1px]"
          style={
            liveOnly
              ? { background: "#D946EF", color: "#fff" }
              : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }
          }
        >
          {liveOnly ? "Showing Live" : "Live Now Only"}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : channels.length ? (
        <ChannelGuide channels={channels} />
      ) : (
        <p className="text-sm text-white/[0.42]">No channels available yet.</p>
      )}
    </div>
  );
}
