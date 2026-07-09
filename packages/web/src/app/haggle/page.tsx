"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Check } from "lucide-react";
import { swrFetcher, apiPost } from "@/lib/api";
import { Tabs, Card, Badge, Skeleton, PriceTag, Button, useToast } from "@/components/ui";

type HaggleStatus = "live" | "upcoming" | "ended";

interface Auction {
  id: string;
  title: string;
  status: HaggleStatus;
  current_bid_cents: number;
  final_price_cents: number;
  ends_at: string;
  scheduled_for?: string | null;
  channel_id: string;
  thumbnail_url: string | null;
  product_title: string;
  bid_count: number;
}

interface BrowseResponse {
  items: Auction[];
  total: number;
}

const TABS = [
  { value: "live", label: "Live Now" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ended", label: "Ended" },
];

/** Live countdown to `target` (ISO string). Turns red under 60s. */
function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = new Date(target).getTime() - now;
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const label =
    total <= 0
      ? "Ended"
      : h > 0
      ? `${h}:${pad(m)}:${pad(s)}`
      : `${pad(m)}:${pad(s)}`;
  const urgent = total > 0 && total < 60;

  return (
    <span
      className={`font-mono text-sm font-semibold tabular-nums ${
        urgent || total <= 0 ? "text-itv-live" : "text-itv-text"
      }`}
    >
      {label}
    </span>
  );
}

/** Product image with surface fallback. */
function AuctionImage({
  src,
  alt,
  ratio,
}: {
  src: string | null;
  alt: string;
  ratio: "square" | "video";
}) {
  const aspect = ratio === "square" ? "aspect-square" : "aspect-video";
  return (
    <div className={`${aspect} w-full overflow-hidden rounded-md bg-itv-surface3`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

function WatchButton({ id }: { id: string }) {
  const { toast } = useToast();
  const [watching, setWatching] = useState(false);
  const [pending, setPending] = useState(false);

  async function watch() {
    setPending(true);
    try {
      await apiPost(`/api/haggle/auctions/${id}/watch`, {});
      setWatching(true);
    } catch {
      toast({ title: "Couldn't watch this auction. Try again.", variant: "error" });
    } finally {
      setPending(false);
    }
  }

  if (watching) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-itv-success">
        <Check size={14} /> Watching
      </span>
    );
  }
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={watch}>
      Watch
    </Button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-itv-border py-12 text-center text-sm text-itv-muted">
      {message}
    </p>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square" />
      ))}
    </div>
  );
}

function formatStart(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HagglePage() {
  const [status, setStatus] = useState<HaggleStatus>("live");

  const { data, error, isLoading, mutate } = useSWR<BrowseResponse>(
    `/api/haggle/browse?status=${status}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-itv-text">Haggle</h1>
      <p className="mb-4 text-sm text-itv-muted">Live auctions inside the stream.</p>

      <Tabs
        items={TABS}
        value={status}
        onChange={(v) => setStatus(v as HaggleStatus)}
        className="mb-6"
      />

      {isLoading ? (
        <LoadingGrid />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-itv-border py-12 text-center">
          <p className="text-sm text-itv-muted">Couldn&apos;t load auctions.</p>
          <Button variant="subtle" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      ) : !items.length ? (
        <EmptyState
          message={
            status === "live"
              ? "No live auctions right now."
              : status === "upcoming"
              ? "No upcoming auctions scheduled."
              : "No ended auctions to show."
          }
        />
      ) : status === "live" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => (
            <Link key={a.id} href="/live" className="block">
              <Card interactive className="overflow-hidden p-3">
                <AuctionImage src={a.thumbnail_url} alt={a.product_title} ratio="video" />
                <div className="mt-3 space-y-2">
                  <h3 className="line-clamp-1 text-sm font-semibold text-itv-text">
                    {a.title}
                  </h3>
                  <p className="line-clamp-1 text-xs text-itv-faint">{a.product_title}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-itv-muted">
                        Current bid
                      </p>
                      <PriceTag cents={a.current_bid_cents} size="lg" className="text-itv-magenta" />
                    </div>
                    <div className="text-right">
                      <Badge tone="live">On air now</Badge>
                      <div className="mt-1">
                        <Countdown target={a.ends_at} />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-itv-muted">{a.bid_count} bids</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : status === "upcoming" ? (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <Card key={a.id} className="flex items-center gap-4 p-3">
              <div className="w-16 shrink-0 sm:w-20">
                <AuctionImage src={a.thumbnail_url} alt={a.product_title} ratio="square" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-semibold text-itv-text">
                  {a.title}
                </h3>
                <p className="line-clamp-1 text-xs text-itv-faint">{a.product_title}</p>
                <p className="mt-1 text-xs text-itv-muted">
                  {a.scheduled_for ? `Starts ${formatStart(a.scheduled_for)}` : "Not scheduled yet"}
                </p>
              </div>
              <WatchButton id={a.id} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((a) => {
            const sold = a.final_price_cents > 0;
            return (
              <Card key={a.id} className="overflow-hidden p-3">
                <AuctionImage src={a.thumbnail_url} alt={a.product_title} ratio="square" />
                <div className="mt-3 space-y-2">
                  <h3 className="line-clamp-1 text-sm font-semibold text-itv-text">
                    {a.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-itv-muted">
                        Final price
                      </p>
                      <PriceTag cents={a.final_price_cents} size="md" />
                    </div>
                    <Badge tone={sold ? "success" : "neutral"}>
                      {sold ? "Sold" : "Unsold"}
                    </Badge>
                  </div>
                  <p className="text-xs text-itv-muted">{a.bid_count} bids</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
