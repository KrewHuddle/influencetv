"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { ProductOverlay } from "@/components/shop/ProductOverlay";
import { useTuneIn } from "@/hooks/useTuneIn";
import { useAuth } from "@/hooks/useAuth";

interface Channel {
  id: string;
  name: string;
  slug: string;
  number?: number | null;
  hls_output_url: string | null;
  viewer_count?: number | null;
}

const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

export default function ChannelPlayerPage({
  params,
}: {
  params: { channelSlug: string };
}) {
  const { channelSlug } = params;
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const { data } = useSWR<{ channel: Channel }>(
    `/api/channels/slug/${channelSlug}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const channel = data?.channel;
  const { currentItem, elapsedSeconds } = useTuneIn(channel?.id ?? null);
  const canChat = user && user.plan !== "free";

  return (
    <div className="grid gap-4 px-6 py-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="relative">
          {channel?.hls_output_url ? (
            <VideoPlayer hlsUrl={channel.hls_output_url} startOffset={elapsedSeconds} />
          ) : (
            <div className="grid aspect-video place-items-center border border-itv-border bg-itv-surface text-sm text-white/[0.42]">
              Channel offline
            </div>
          )}

          {/* top-left: channel number + show */}
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-[11px] font-bold">
            <span className="text-itv-magenta">CH {channel?.number ?? "—"}</span>
            <span className="text-white/80">{currentItem?.title ?? channel?.name ?? channelSlug}</span>
          </div>

          {/* top-right: viewer count */}
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-[2px] bg-black/60 px-2 py-1 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-itv-magenta" />
            {kfmt(channel?.viewer_count)}
          </div>

          {channel && <ProductOverlay channelId={channel.id} />}
        </div>

        <div className="mt-4">
          <h1 className="text-[18px] font-black">{channel?.name ?? channelSlug}</h1>
          <p className="text-sm text-white/55">{currentItem?.title ?? "—"}</p>
        </div>
      </div>

      {/* chat panel */}
      <aside className="flex h-full flex-col border-l border-itv-border bg-itv-bg lg:min-h-[420px]">
        <h2 className="border-b border-itv-border px-4 py-3 text-[13px] font-extrabold">Live Chat</h2>
        {canChat ? (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm text-white/70">
              <p className="text-white/[0.42]">Say something to get the room going…</p>
            </div>
            <div className="border-t border-itv-border p-3">
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Say something..."
                className="w-full bg-itv-surface2 px-3 py-2 text-sm outline-none placeholder:text-white/[0.35] focus:ring-1 focus:ring-itv-magenta"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-white/55">Live chat is a Premium feature.</p>
            <Link
              href="/plans"
              className="bg-itv-magenta px-4 py-2 text-[11px] font-extrabold uppercase tracking-[1px] text-white"
            >
              Go Premium
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
