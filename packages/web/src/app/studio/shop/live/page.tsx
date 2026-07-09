"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { apiPost, swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/components/ui/Toast";
import {
  Badge,
  Button,
  Card,
  Input,
  PillFilter,
  Spinner,
  type PillOption,
} from "@/components/ui";

/* ---------------------------------- types --------------------------------- */

interface Product {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  base_price_cents: number;
}

interface Auction {
  id: string;
  productId?: string;
  product_id?: string;
  title?: string;
  thumbnail_url?: string | null;
  currentBidCents?: number;
  current_bid_cents?: number;
  winning_bid_cents?: number;
  status?: string;
}

interface Bid {
  username: string;
  amountCents: number;
  at: number;
}

interface QueueItem {
  productId: string;
  title: string;
  thumbnail_url?: string | null;
  startingBid: string;
}

/* -------------------------------- constants ------------------------------- */

const DURATION_OPTIONS: PillOption[] = [
  { value: "30", label: "30s" },
  { value: "60", label: "60s" },
  { value: "120", label: "2 min" },
  { value: "300", label: "5 min" },
];

const INCREMENT_OPTIONS: PillOption[] = [
  { value: "100", label: "$1" },
  { value: "500", label: "$5" },
  { value: "1000", label: "$10" },
  { value: "2500", label: "$25" },
];

/* --------------------------------- helpers -------------------------------- */

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

const timeAgo = (at: number) => {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

/* ------------------------------- sub-components ---------------------------- */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card tone="surface2" className="p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-itv-faint">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg text-itv-text">{value}</p>
    </Card>
  );
}

function ProductThumb({
  product,
  className,
}: {
  product: { thumbnail_url?: string | null; title: string };
  className?: string;
}) {
  return product.thumbnail_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.thumbnail_url}
      alt={product.title}
      className={className}
    />
  ) : (
    <div
      className={`flex items-center justify-center bg-itv-surface2 text-itv-faint ${className ?? ""}`}
    >
      <span className="font-display text-xs">{product.title.slice(0, 1)}</span>
    </div>
  );
}

function ProductGrid({
  products,
  onPick,
  selectedId,
}: {
  products: Product[];
  onPick: (p: Product) => void;
  selectedId?: string;
}) {
  if (!products.length) {
    return (
      <p className="text-sm text-itv-muted">
        No approved products yet. Add products in the Shop tab first.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {products.map((p) => (
        <Card
          key={p.id}
          interactive
          onClick={() => onPick(p)}
          className={`overflow-hidden ${
            selectedId === p.id ? "border-itv-magenta" : ""
          }`}
        >
          <ProductThumb product={p} className="h-24 w-full object-cover" />
          <div className="p-2">
            <p className="truncate text-xs font-medium text-itv-text">
              {p.title}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-itv-muted">
              {fmt(p.base_price_cents)}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------- launch haggle form ------------------------- */

function LaunchForm({
  product,
  onCancel,
  onLaunch,
  busy,
}: {
  product: Product;
  onCancel: () => void;
  onLaunch: (payload: {
    startingBidCents: number;
    reservePriceCents: number | null;
    durationSeconds: number;
    bidIncrementCents: number;
    autoExtend: boolean;
  }) => void;
  busy: boolean;
}) {
  const [startingBid, setStartingBid] = useState("1.00");
  const [reserve, setReserve] = useState("");
  const [duration, setDuration] = useState("60");
  const [increment, setIncrement] = useState("100");
  const [autoExtend, setAutoExtend] = useState(true);

  const submit = () => {
    onLaunch({
      startingBidCents: Math.round(parseFloat(startingBid || "0") * 100),
      reservePriceCents: reserve.trim()
        ? Math.round(parseFloat(reserve) * 100)
        : null,
      durationSeconds: parseInt(duration, 10),
      bidIncrementCents: parseInt(increment, 10),
      autoExtend,
    });
  };

  return (
    <Card className="mt-4 space-y-4 p-4">
      <div className="flex items-center gap-3">
        <ProductThumb
          product={product}
          className="h-12 w-12 shrink-0 rounded object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-itv-text">
            {product.title}
          </p>
          <p className="font-mono text-xs text-itv-muted">
            Launch Haggle
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Starting bid (USD)"
          type="number"
          step="0.01"
          min="0.01"
          value={startingBid}
          onChange={(e) => setStartingBid(e.target.value)}
        />
        <div>
          <Input
            label="Reserve price (USD)"
            type="number"
            step="0.01"
            min="0"
            value={reserve}
            onChange={(e) => setReserve(e.target.value)}
            placeholder="optional"
          />
          <p className="mt-1 text-[11px] text-itv-faint">
            Hidden from bidders
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-medium uppercase tracking-wide text-itv-muted">
          Duration
        </span>
        <PillFilter
          options={DURATION_OPTIONS}
          value={duration}
          onChange={setDuration}
        />
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-medium uppercase tracking-wide text-itv-muted">
          Bid increment
        </span>
        <PillFilter
          options={INCREMENT_OPTIONS}
          value={increment}
          onChange={setIncrement}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-itv-muted">
          Auto-extend
        </span>
        <Button
          variant={autoExtend ? "primary" : "subtle"}
          size="sm"
          onClick={() => setAutoExtend((v) => !v)}
        >
          {autoExtend ? "On" : "Off"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="md" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Starting…" : "Start Haggle Now"}
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------- live auction ----------------------------- */

function LiveAuction({
  auction,
  currentBidCents,
  leading,
  endsAt,
  bids,
  onExtend,
  onEnd,
  busy,
}: {
  auction: Auction;
  currentBidCents: number;
  leading: string | null;
  endsAt: number | null;
  bids: Bid[];
  onExtend: () => void;
  onEnd: () => void;
  busy: boolean;
}) {
  const [remaining, setRemaining] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const urgent = remaining < 10;
  const mm = Math.floor(remaining / 60);
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <ProductThumb
          product={{
            thumbnail_url: auction.thumbnail_url,
            title: auction.title ?? "Product",
          }}
          className="h-20 w-20 shrink-0 rounded object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="live">HAGGLE LIVE</Badge>
          </div>
          <h2 className="truncate text-sm font-semibold text-itv-text">
            {auction.title ?? "Live product"}
          </h2>
        </div>
        <div
          className={`font-mono text-2xl tabular-nums ${
            urgent ? "text-itv-live" : "text-itv-text"
          }`}
        >
          {mm}:{ss}
        </div>
      </div>

      <div className="rounded-lg border border-itv-border bg-itv-surface2 p-4 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-itv-faint">
          Current bid
        </p>
        <p className="mt-1 font-mono text-4xl text-itv-magenta">
          {fmt(currentBidCents)}
        </p>
        <p className="mt-1 text-xs text-itv-muted">
          {leading ? `Leading @${leading}` : "No bids yet"}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-itv-faint">
          Bid history
        </p>
        {bids.length ? (
          <ul className="space-y-1">
            {bids.slice(0, 5).map((b, i) => (
              <li
                key={`${b.username}-${b.at}-${i}`}
                className="flex items-center justify-between rounded bg-itv-surface2 px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-itv-text">@{b.username}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-itv-magenta">
                    {fmt(b.amountCents)}
                  </span>
                  <span className="text-itv-faint">{timeAgo(b.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-itv-muted">Waiting for the first bid…</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="md"
          className="flex-1"
          onClick={onExtend}
          disabled={busy}
        >
          Extend +30s
        </Button>
        {confirmEnd ? (
          <>
            <Button
              variant="live"
              size="md"
              className="flex-1"
              onClick={() => {
                setConfirmEnd(false);
                onEnd();
              }}
              disabled={busy}
            >
              {busy ? "Cancelling…" : "Confirm cancel?"}
            </Button>
            <Button
              variant="ghost"
              size="md"
              aria-label="Keep auction running"
              onClick={() => setConfirmEnd(false)}
              disabled={busy}
            >
              ✕
            </Button>
          </>
        ) : (
          <Button
            variant="live"
            size="md"
            className="flex-1"
            onClick={() => setConfirmEnd(true)}
            disabled={busy}
          >
            Cancel Auction
          </Button>
        )}
      </div>
    </section>
  );
}

/* --------------------------------- upcoming ------------------------------- */

function UpcomingQueue({
  queue,
  onUpdateBid,
  onRemove,
}: {
  queue: QueueItem[];
  onUpdateBid: (productId: string, value: string) => void;
  onRemove: (productId: string) => void;
}) {
  if (!queue.length) {
    return (
      <p className="text-xs text-itv-muted">
        Queue is empty. Pick a product and tap “Add to Queue”.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {queue.map((q) => (
        <li
          key={q.productId}
          className="flex items-center gap-3 rounded-lg border border-itv-border bg-itv-surface2 p-2"
        >
          <ProductThumb
            product={q}
            className="h-10 w-10 shrink-0 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-itv-text">
              {q.title}
            </p>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={q.startingBid}
              onChange={(e) => onUpdateBid(q.productId, e.target.value)}
              className="mt-1 py-1 text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(q.productId)}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------- page --------------------------------- */

export default function LiveShopControlPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const { toast } = useToast();
  const channelId = useSearchParams().get("channelId");

  // products
  const { data: productData } = useSWR<{ items: Product[] }>(
    user ? `/api/shop/products?sellerId=${user.id}` : null,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const products = useMemo(() => productData?.items ?? [], [productData]);

  // seller auction history (stats seed)
  const { data: sellerData } = useSWR<{
    auctions: Auction[];
    gmvCents: number;
  }>("/api/haggle/seller/auctions", swrFetcher, { shouldRetryOnError: false });

  // active auction + live state
  const [selected, setSelected] = useState<Product | null>(null);
  const [activeAuction, setActiveAuction] = useState<Auction | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [currentBidCents, setCurrentBidCents] = useState(0);
  const [leading, setLeading] = useState<string | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [launching, setLaunching] = useState(false);
  const [acting, setActing] = useState(false);

  // session / live-shop stubs
  const [liveShopId, setLiveShopId] = useState<string | null>(null);
  const [liveShopOn, setLiveShopOn] = useState(false);

  // live stats
  const [viewers, setViewers] = useState(0);
  const [liveBidCount, setLiveBidCount] = useState(0);

  // queue (local only)
  const [queue, setQueue] = useState<QueueItem[]>([]);

  /* ------------------------------ socket wiring ----------------------------- */

  useEffect(() => {
    if (!socket || !channelId) return;
    socket.emit("join-channel", channelId);

    const onBid = (p: {
      auctionId?: string;
      username?: string;
      amountCents?: number;
      currentBidCents?: number;
    }) => {
      const amount = p.amountCents ?? p.currentBidCents ?? 0;
      setCurrentBidCents(amount);
      if (p.username) setLeading(p.username);
      setBids((prev) =>
        [
          { username: p.username ?? "bidder", amountCents: amount, at: Date.now() },
          ...prev,
        ].slice(0, 5)
      );
      setLiveBidCount((n) => n + 1);
    };

    const onStarted = (p: {
      auction?: Auction;
      endsAt?: string | number;
    }) => {
      if (p.auction) setActiveAuction(p.auction);
      if (p.endsAt) setEndsAt(new Date(p.endsAt).getTime());
    };

    const onWon = () => {
      setActiveAuction(null);
      setEndsAt(null);
    };

    const onViewers = (p: { count?: number }) => {
      if (typeof p.count === "number") setViewers(p.count);
    };

    socket.on("haggle-bid", onBid);
    socket.on("haggle-started", onStarted);
    socket.on("haggle-won", onWon);
    socket.on("viewer-count", onViewers);

    return () => {
      socket.off("haggle-bid", onBid);
      socket.off("haggle-started", onStarted);
      socket.off("haggle-won", onWon);
      socket.off("viewer-count", onViewers);
      socket.emit("leave-channel", channelId);
    };
  }, [socket, channelId]);

  /* ------------------------------- launch flow ------------------------------ */

  const launch = useCallback(
    async (payload: {
      startingBidCents: number;
      reservePriceCents: number | null;
      durationSeconds: number;
      bidIncrementCents: number;
      autoExtend: boolean;
    }) => {
      if (!selected) return;
      setLaunching(true);
      try {
        const { auction } = await apiPost<{ auction: Auction }>(
          "/api/haggle/auctions",
          {
            productId: selected.id,
            channelId,
            startingBidCents: payload.startingBidCents,
            reservePriceCents: payload.reservePriceCents,
            durationSeconds: payload.durationSeconds,
            bidIncrementCents: payload.bidIncrementCents,
            autoExtend: payload.autoExtend,
          }
        );
        const started = await apiPost<{ auction: Auction; endsAt: string }>(
          `/api/haggle/auctions/${auction.id}/start`,
          {}
        );
        setActiveAuction({
          ...auction,
          ...started.auction,
          title: selected.title,
          thumbnail_url: selected.thumbnail_url,
        });
        setEndsAt(
          started.endsAt
            ? new Date(started.endsAt).getTime()
            : Date.now() + payload.durationSeconds * 1000
        );
        setCurrentBidCents(payload.startingBidCents);
        setLeading(null);
        setBids([]);
        setSelected(null);
        toast({ title: "Haggle is live!" });
      } catch {
        toast({ title: "Failed to start haggle", variant: "error" });
      } finally {
        setLaunching(false);
      }
    },
    [selected, channelId, toast]
  );

  const extend = useCallback(async () => {
    if (!activeAuction) return;
    setActing(true);
    try {
      await apiPost(`/api/haggle/auctions/${activeAuction.id}/extend`, {});
      setEndsAt((prev) => (prev ?? Date.now()) + 30_000);
      toast({ title: "Extended +30s" });
    } catch {
      toast({ title: "Failed to extend", variant: "error" });
    } finally {
      setActing(false);
    }
  }, [activeAuction, toast]);

  const endAuction = useCallback(async () => {
    if (!activeAuction) return;
    setActing(true);
    try {
      await apiPost(`/api/haggle/auctions/${activeAuction.id}/cancel`, {});
      setActiveAuction(null);
      setEndsAt(null);
      toast({ title: "Auction ended" });
    } catch {
      toast({ title: "Failed to end auction", variant: "error" });
    } finally {
      setActing(false);
    }
  }, [activeAuction, toast]);

  /* ---------------------------- session controls ---------------------------- */

  const toggleLiveShop = useCallback(async () => {
    try {
      if (liveShopOn) {
        setLiveShopOn(false);
        toast({ title: "Live shop ended" });
        return;
      }
      const res = await apiPost<{ liveShop?: { id: string } }>(
        "/api/live-shops",
        { channelId }
      );
      if (res.liveShop?.id) setLiveShopId(res.liveShop.id);
      setLiveShopOn(true);
      toast({ title: "Live shop started" });
    } catch {
      toast({ title: "Failed to toggle live shop", variant: "error" });
    }
  }, [liveShopOn, channelId, toast]);

  const pinProduct = useCallback(async () => {
    if (!liveShopId || !selected) return;
    try {
      await apiPost(`/api/live-shops/${liveShopId}/pin-product`, {
        productId: selected.id,
      });
      toast({ title: `Pinned ${selected.title}` });
    } catch {
      toast({ title: "Failed to pin product", variant: "error" });
    }
  }, [liveShopId, selected, toast]);

  /* -------------------------------- queue ops ------------------------------- */

  const addToQueue = useCallback(() => {
    if (!selected) return;
    setQueue((prev) =>
      prev.some((q) => q.productId === selected.id)
        ? prev
        : [
            ...prev,
            {
              productId: selected.id,
              title: selected.title,
              thumbnail_url: selected.thumbnail_url,
              startingBid: "1.00",
            },
          ]
    );
    toast({ title: "Added to queue" });
  }, [selected, toast]);

  const updateQueueBid = useCallback((productId: string, value: string) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.productId === productId ? { ...q, startingBid: value } : q
      )
    );
  }, []);

  const removeFromQueue = useCallback((productId: string) => {
    setQueue((prev) => prev.filter((q) => q.productId !== productId));
  }, []);

  /* --------------------------------- stats ---------------------------------- */

  const stats = useMemo(() => {
    const auctions = sellerData?.auctions ?? [];
    const gmvCents = sellerData?.gmvCents ?? 0;
    const highest = auctions.reduce((max, a) => {
      const v = a.winning_bid_cents ?? a.current_bid_cents ?? 0;
      return v > max ? v : max;
    }, 0);
    const sold = auctions.filter(
      (a) => (a.winning_bid_cents ?? 0) > 0 || a.status === "settled"
    ).length;
    const run = auctions.length + (activeAuction ? 1 : 0);
    const conversion = run ? Math.round((sold / run) * 100) : 0;
    return {
      totalBids: liveBidCount,
      auctionsRun: run,
      gmvCents,
      highestCents: highest,
      conversion,
    };
  }, [sellerData, activeAuction, liveBidCount]);

  /* -------------------------------- guards ---------------------------------- */

  if (!user) {
    return (
      <div className="flex justify-center px-4 py-24">
        <Spinner />
      </div>
    );
  }

  /* --------------------------------- render --------------------------------- */

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] text-itv-text">Live Shop</h1>
          <p className="text-xs text-itv-muted">
            {channelId
              ? "Connected to your channel — bids update in real time."
              : "No channel linked. Start a stream to sync live bids."}
          </p>
        </div>
        <Button
          variant={liveShopOn ? "live" : "primary"}
          size="md"
          onClick={toggleLiveShop}
        >
          {liveShopOn ? "End Live Shop" : "Start Live Shop"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* LEFT — active panel */}
        <div className="space-y-4 lg:col-span-3">
          {activeAuction ? (
            <LiveAuction
              auction={activeAuction}
              currentBidCents={currentBidCents}
              leading={leading}
              endsAt={endsAt}
              bids={bids}
              onExtend={extend}
              onEnd={endAuction}
              busy={acting}
            />
          ) : (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-itv-text">
                Pick a product to haggle
              </h2>
              <ProductGrid
                products={products}
                onPick={setSelected}
                selectedId={selected?.id}
              />
              {selected && (
                <LaunchForm
                  product={selected}
                  onCancel={() => setSelected(null)}
                  onLaunch={launch}
                  busy={launching}
                />
              )}
            </section>
          )}

          {/* session controls */}
          <Card className="flex flex-wrap items-center gap-2 p-4">
            <p className="w-full text-[11px] font-medium uppercase tracking-wide text-itv-faint">
              Session controls
            </p>
            <Button
              variant="subtle"
              size="sm"
              onClick={pinProduct}
              disabled={!liveShopId || !selected}
            >
              Pin Product
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={addToQueue}
              disabled={!selected}
            >
              Add to Queue
            </Button>
            {!liveShopId && (
              <span className="text-[11px] text-itv-faint">
                Start the live shop to enable pinning.
              </span>
            )}
          </Card>
        </div>

        {/* RIGHT — stats */}
        <div className="space-y-4 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-itv-faint">
              Session stats
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Viewers" value={viewers.toString()} />
              <StatCard label="Total Bids" value={stats.totalBids.toString()} />
              <StatCard
                label="Auctions Run"
                value={stats.auctionsRun.toString()}
              />
              <StatCard label="GMV" value={fmt(stats.gmvCents)} />
              <StatCard label="Highest Sale" value={fmt(stats.highestCents)} />
              <StatCard
                label="Conversion Rate"
                value={`${stats.conversion}%`}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-itv-faint">
              Upcoming Queue
            </h2>
            <UpcomingQueue
              queue={queue}
              onUpdateBid={updateQueueBid}
              onRemove={removeFromQueue}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
