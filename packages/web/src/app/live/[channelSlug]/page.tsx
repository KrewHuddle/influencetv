"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { ProductOverlay } from "@/components/shop/ProductOverlay";
import { LiveBadge } from "@/components/channel/LiveBadge";
import { useTuneIn } from "@/hooks/useTuneIn";
import { useAuth } from "@/hooks/useAuth";

interface Channel {
  id: string;
  name: string;
  slug: string;
  hls_output_url: string | null;
  viewer_count?: number | null;
}

export default function ChannelPlayerPage({
  params,
}: {
  params: { channelSlug: string };
}) {
  const { channelSlug } = params;
  const { user } = useAuth();
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
            <VideoPlayer
              hlsUrl={channel.hls_output_url}
              startOffset={elapsedSeconds}
            />
          ) : (
            <div className="grid aspect-video place-items-center rounded-lg border border-apex bg-apex-gray-900 text-sm text-[color:var(--text-muted)]">
              Channel offline
            </div>
          )}
          {channel && <ProductOverlay channelId={channel.id} />}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {currentItem && <LiveBadge />}
              <h1 className="font-display text-xl">{channel?.name ?? channelSlug}</h1>
            </div>
            <p className="text-sm text-[color:var(--text-secondary)]">
              {currentItem?.title ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <aside className="rounded-lg border border-apex bg-apex-gray-900 p-4">
        <h2 className="mb-3 font-display text-sm">Chat</h2>
        {canChat ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            Live chat coming online…
          </p>
        ) : (
          <p className="text-sm text-[color:var(--text-secondary)]">
            Join Premium to chat.
          </p>
        )}
      </aside>
    </div>
  );
}
