"use client";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { ProductOverlay } from "@/components/shop/ProductOverlay";
import { HaggleOverlay } from "@/components/shop/HaggleOverlay";
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
  const { data, error, isLoading, mutate } = useSWR<{ channel: Channel }>(
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
          {isLoading ? (
            <Skeleton className="aspect-video w-full" />
          ) : error ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 border border-itv-border bg-itv-surface">
              <p className="text-sm text-itv-muted">Couldn&apos;t load channel.</p>
              <Button variant="subtle" size="sm" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : channel?.hls_output_url ? (
            <VideoPlayer hlsUrl={channel.hls_output_url} startOffset={elapsedSeconds} />
          ) : (
            <div className="grid aspect-video place-items-center border border-itv-border bg-itv-surface text-sm text-itv-faint">
              Channel offline
            </div>
          )}

          {/* top-left: channel number + show */}
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-[11px] font-bold">
            <span className="text-itv-accent">CH {channel?.number ?? "—"}</span>
            <span className="text-itv-text">{currentItem?.title ?? channel?.name ?? channelSlug}</span>
          </div>

          {/* top-right: viewer count */}
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-[2px] bg-black/60 px-2 py-1 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-itv-accent" />
            {kfmt(channel?.viewer_count)}
          </div>

          {channel && <ProductOverlay channelId={channel.id} />}
          {channel && <HaggleOverlay channelId={channel.id} />}
        </div>

        <div className="mt-4">
          <h1 className="text-[18px] font-black">{channel?.name ?? channelSlug}</h1>
          <p className="text-sm text-itv-muted">{currentItem?.title ?? "—"}</p>
        </div>
      </div>

      {/* chat panel */}
      <aside className="flex h-full flex-col border-l border-itv-border bg-itv-bg lg:min-h-[420px]">
        <h2 className="border-b border-itv-border px-4 py-3 text-[13px] font-extrabold">Live Chat</h2>
        {canChat ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3" />
            <div className="border-t border-itv-border p-3">
              <input
                disabled
                placeholder="Chat coming soon"
                className="w-full bg-itv-surface2 px-3 py-2 text-sm text-itv-text outline-none placeholder:text-itv-faint disabled:opacity-60"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-itv-muted">Live chat is a Premium feature.</p>
            <Link
              href="/plans"
              className="bg-itv-accent px-4 py-2 text-[11px] font-extrabold uppercase tracking-[1px] text-itv-bg"
            >
              Go Premium
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
