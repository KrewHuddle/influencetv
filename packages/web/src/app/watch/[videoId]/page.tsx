"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ShoppingBag, X } from "lucide-react";
import { swrFetcher } from "@/lib/api";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { formatCount } from "@/lib/constants";
import { useCartStore } from "@/store/cartStore";

interface Video {
  id: string;
  title: string;
  description?: string | null;
  hls_url: string | null;
  thumbnail_url?: string | null;
  creator_name?: string | null;
  view_count?: number | null;
}
interface TaggedProduct {
  product_id: string;
  timestamp_seconds: number;
  is_featured: boolean;
  title: string;
  thumbnail_url?: string | null;
  base_price_cents: number;
}

const PRODUCT_WINDOW = 15; // seconds a tagged product stays on screen

export default function WatchPage({ params }: { params: { videoId: string } }) {
  const { videoId } = params;
  const add = useCartStore((s) => s.add);
  const [t, setT] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const { data, isLoading } = useSWR<{ video: Video }>(`/api/videos/${videoId}`, swrFetcher, { shouldRetryOnError: false });
  const { data: prodData } = useSWR<{ products: TaggedProduct[] }>(`/api/videos/${videoId}/products`, swrFetcher, { shouldRetryOnError: false });
  const video = data?.video;
  const products = prodData?.products ?? [];

  // The tagged product whose window covers the current playback time.
  const active = useMemo(() => {
    const hit = [...products]
      .filter((p) => t >= p.timestamp_seconds && t < p.timestamp_seconds + PRODUCT_WINDOW)
      .sort((a, b) => b.timestamp_seconds - a.timestamp_seconds)[0];
    return hit && hit.product_id !== dismissed ? hit : null;
  }, [products, t, dismissed]);

  const addToCart = (p: TaggedProduct) =>
    add({ productId: p.product_id, title: p.title, priceCents: p.base_price_cents, quantity: 1, thumbnail: p.thumbnail_url });

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="relative">
        {isLoading ? (
          <Skeleton className="aspect-video w-full" />
        ) : video?.hls_url ? (
          <VideoPlayer hlsUrl={video.hls_url} posterUrl={video.thumbnail_url ?? undefined} autoPlay={false} vodVideoId={video.id} onTimeUpdate={setT} />
        ) : (
          <div className="grid aspect-video place-items-center border border-itv-border bg-itv-surface text-sm text-white/[0.42]">
            Video unavailable
          </div>
        )}

        {/* time-synced shoppable overlay */}
        {active && (
          <div className="absolute bottom-4 left-1/2 z-20 flex w-[85%] max-w-md -translate-x-1/2 items-center gap-3 border-t-2 border-itv-magenta bg-itv-surface p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.thumbnail_url || "/placeholder.svg"} alt={active.title} className="h-12 w-12 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{active.title}</p>
              <p className="text-sm font-bold text-itv-magenta">${(active.base_price_cents / 100).toFixed(2)}</p>
            </div>
            <button onClick={() => addToCart(active)} className="bg-itv-magenta px-3 py-2 text-xs font-extrabold text-white hover:brightness-110">Add</button>
            <button aria-label="Dismiss" onClick={() => setDismissed(active.product_id)} className="text-white/40 hover:text-itv-text"><X size={16} /></button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-black">{video?.title ?? "Untitled"}</h1>
        <p className="mt-1 text-sm text-white/55">{video?.creator_name ?? "Influence TV"} · {formatCount(video?.view_count)} views</p>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" className="text-xs">Add to Watchlist</Button>
          <Button variant="ghost" className="text-xs">Share</Button>
        </div>
        {video?.description && <p className="mt-4 whitespace-pre-line text-sm text-white/[0.7]">{video.description}</p>}
      </div>

      {/* shop-this-video rail */}
      {products.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-extrabold">
            <ShoppingBag size={15} className="text-itv-magenta" /> Shop this video
          </h2>
          <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex gap-3 overflow-x-auto pb-2">
            {products.map((p) => (
              <div key={`${p.product_id}-${p.timestamp_seconds}`} className="w-[140px] shrink-0 border border-itv-border bg-itv-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail_url || "/placeholder.svg"} alt={p.title} loading="lazy" className="h-[100px] w-full object-cover" />
                <div className="p-2">
                  <p className="line-clamp-1 text-[12px] font-bold">{p.title}</p>
                  <p className="text-[12px] font-bold text-itv-magenta">${(p.base_price_cents / 100).toFixed(2)}</p>
                  <button onClick={() => addToCart(p)} className="mt-1.5 w-full bg-itv-magenta py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-white">Add to cart</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
