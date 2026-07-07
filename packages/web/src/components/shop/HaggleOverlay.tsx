"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/hooks/useAuth";
import { apiGet, apiPost } from "@/lib/api";
import { Button, Badge, Input } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Phase = "live" | "sold" | "unsold" | "cancelled" | "won";

interface AuctionState {
  auctionId: string;
  title: string;
  image?: string | null;
  startingBid: number; // cents
  increment: number; // cents
  currentBid: number | null; // cents
  currentWinnerName: string | null;
  currentWinnerId: string | null;
  endsAt: number | null; // ms epoch
  bidCount: number;
  extended: boolean;
}

interface EndState {
  phase: Exclude<Phase, "live">;
  winnerName?: string;
  finalPrice?: number; // cents
  reason?: string;
  orderId?: string;
  downloadUrl?: string;
}

/* --- socket payloads --- */
interface StartedPayload {
  auctionId: string;
  title: string;
  productId: string;
  image?: string | null;
  startingBid: number;
  endsAt: number;
  increment: number;
  duration: number;
}
interface BidPayload {
  auctionId: string;
  amount: number;
  displayName: string;
  bidderId: string;
  endsAt: number;
  bidCount: number;
  wasExtended: boolean;
}
interface ExtendedPayload {
  newEndsAt: number;
}
interface WonPayload {
  winnerName: string;
  finalPrice: number;
}
interface UnsoldPayload {
  reason: string;
}
interface OutbidPayload {
  newAmount: number;
  newWinner: string;
}
interface ProxyPlacedPayload {
  amount: number;
  note?: string;
}
interface WonConfirmedPayload {
  orderId: string;
  amount: number;
  downloadUrl?: string;
}

interface ActiveResponse {
  auction: {
    id: string;
    title: string;
    image?: string | null;
    startingBid: number;
    increment: number;
  } | null;
  live: {
    currentBid?: number;
    currentWinner?: string;
    currentWinnerId?: string;
    endsAt?: number;
    bidCount?: number;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const money = (c: number): string => `$${(c / 100).toFixed(2)}`;

function isPaymentRequired(err: unknown): boolean {
  const e = err as {
    response?: { status?: number; data?: { requiresPaymentMethod?: boolean; data?: { requiresPaymentMethod?: boolean } } };
  };
  return (
    e?.response?.status === 402 ||
    e?.response?.data?.requiresPaymentMethod === true ||
    e?.response?.data?.data?.requiresPaymentMethod === true
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/** Live-auction ("haggle") overlay that slides up from the player. */
export function HaggleOverlay({ channelId }: { channelId: string }) {
  const socket = useSocket();
  const router = useRouter();
  const { user } = useAuth();

  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [ended, setEnded] = useState<EndState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [shown, setShown] = useState(false);
  const [secsLeft, setSecsLeft] = useState(0);
  const [flashRed, setFlashRed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [showMax, setShowMax] = useState(false);
  const [maxDollars, setMaxDollars] = useState("");
  const [bidding, setBidding] = useState(false);

  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFade = () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = null;
  };

  const flashNote = useCallback((text: string, ms = 4000) => {
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), ms);
  }, []);

  /* --- seed a fresh auction from a started payload / active fetch --- */
  const seedAuction = useCallback((next: AuctionState) => {
    clearFade();
    setEnded(null);
    setDismissed(false);
    setShowMax(false);
    setNote(null);
    setAuction(next);
  }, []);

  /* --- finish: show an end state then fade out --- */
  const finish = useCallback((end: EndState, fadeMs: number) => {
    setEnded(end);
    clearFade();
    fadeTimer.current = setTimeout(() => {
      setAuction(null);
      setEnded(null);
    }, fadeMs);
  }, []);

  /* --- initial active-auction fetch --- */
  useEffect(() => {
    let cancelled = false;
    apiGet<ActiveResponse>(`/api/channels/${channelId}/haggle/active`)
      .then((res) => {
        if (cancelled || !res?.auction || !res.live) return;
        const a = res.auction;
        const l = res.live;
        seedAuction({
          auctionId: a.id,
          title: a.title,
          image: a.image,
          startingBid: a.startingBid,
          increment: a.increment,
          currentBid: l.currentBid ?? null,
          currentWinnerName: l.currentWinner ?? null,
          currentWinnerId: l.currentWinnerId ?? null,
          endsAt: l.endsAt ?? null,
          bidCount: l.bidCount ?? 0,
          extended: false,
        });
      })
      .catch(() => {
        /* no active auction — stay hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, seedAuction]);

  /* --- socket wiring --- */
  useEffect(() => {
    if (!socket) return;
    socket.emit("join-channel", channelId);

    const onStarted = (p: StartedPayload) =>
      seedAuction({
        auctionId: p.auctionId,
        title: p.title,
        image: p.image,
        startingBid: p.startingBid,
        increment: p.increment,
        currentBid: null,
        currentWinnerName: null,
        currentWinnerId: null,
        endsAt: p.endsAt,
        bidCount: 0,
        extended: false,
      });

    const onBid = (p: BidPayload) =>
      setAuction((a) =>
        a && a.auctionId === p.auctionId
          ? {
              ...a,
              currentBid: p.amount,
              currentWinnerName: p.displayName,
              currentWinnerId: p.bidderId,
              endsAt: p.endsAt,
              bidCount: p.bidCount,
              extended: a.extended || p.wasExtended,
            }
          : a
      );

    const onExtended = (p: ExtendedPayload) =>
      setAuction((a) =>
        a ? { ...a, endsAt: p.newEndsAt, extended: true } : a
      );

    const onWon = (p: WonPayload) =>
      finish(
        { phase: "sold", winnerName: p.winnerName, finalPrice: p.finalPrice },
        4000
      );

    const onUnsold = (p: UnsoldPayload) =>
      finish({ phase: "unsold", reason: p.reason }, 3000);

    const onCancelled = () => finish({ phase: "cancelled" }, 2000);

    const onOutbid = (p: OutbidPayload) => {
      setFlashRed(true);
      setTimeout(() => setFlashRed(false), 1200);
      flashNote(`You've been outbid — now ${money(p.newAmount)} by @${p.newWinner}`);
    };

    const onProxyPlaced = (p: ProxyPlacedPayload) =>
      flashNote(p.note ?? `Proxy bid placed at ${money(p.amount)}`);

    const onWonConfirmed = (p: WonConfirmedPayload) =>
      finish(
        {
          phase: "won",
          finalPrice: p.amount,
          orderId: p.orderId,
          downloadUrl: p.downloadUrl,
        },
        60_000
      );

    socket.on("haggle-started", onStarted);
    socket.on("haggle-bid", onBid);
    socket.on("haggle-extended", onExtended);
    socket.on("haggle-won", onWon);
    socket.on("haggle-unsold", onUnsold);
    socket.on("haggle-cancelled", onCancelled);
    socket.on("outbid-notification", onOutbid);
    socket.on("proxy-bid-placed", onProxyPlaced);
    socket.on("haggle-won-confirmed", onWonConfirmed);

    return () => {
      socket.off("haggle-started", onStarted);
      socket.off("haggle-bid", onBid);
      socket.off("haggle-extended", onExtended);
      socket.off("haggle-won", onWon);
      socket.off("haggle-unsold", onUnsold);
      socket.off("haggle-cancelled", onCancelled);
      socket.off("outbid-notification", onOutbid);
      socket.off("proxy-bid-placed", onProxyPlaced);
      socket.off("haggle-won-confirmed", onWonConfirmed);
      socket.emit("leave-channel", channelId);
    };
  }, [socket, channelId, seedAuction, finish, flashNote]);

  /* --- slide-in when an auction becomes visible --- */
  useEffect(() => {
    if (!auction || dismissed) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [auction, dismissed]);

  /* --- countdown ticker --- */
  useEffect(() => {
    if (!auction?.endsAt || ended) {
      setSecsLeft(0);
      return;
    }
    const tick = () =>
      setSecsLeft(Math.max(0, Math.round((auction.endsAt! - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [auction?.endsAt, ended]);

  /* --- cleanup timers on unmount --- */
  useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    []
  );

  if (!auction) return null;

  /* --- derived values --- */
  const base = auction.currentBid ?? auction.startingBid;
  const nextBid = base + auction.increment;
  const isLeader = !!user && !!auction.currentWinnerId && user.id === auction.currentWinnerId;

  const mm = Math.floor(secsLeft / 60);
  const ss = String(secsLeft % 60).padStart(2, "0");
  const countdownColor =
    secsLeft < 10
      ? "text-itv-live animate-pulse"
      : secsLeft < 30
        ? "text-itv-magenta"
        : "text-itv-text";

  /* --- actions --- */
  const placeBid = async () => {
    if (bidding) return;
    setBidding(true);
    try {
      await apiPost(`/api/haggle/auctions/${auction.auctionId}/bid`, {
        amountCents: nextBid,
      });
    } catch (err) {
      if (isPaymentRequired(err)) router.push("/account/payment");
      else flashNote("Bid failed — try again");
    } finally {
      setBidding(false);
    }
  };

  const setMaxBid = async () => {
    const dollars = parseFloat(maxDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    const maxAmountCents = Math.round(dollars * 100);
    try {
      await apiPost(`/api/haggle/auctions/${auction.auctionId}/proxy-bid`, {
        maxAmountCents,
      });
      setShowMax(false);
      flashNote(`Max bid set at ${money(maxAmountCents)}`);
    } catch (err) {
      if (isPaymentRequired(err)) router.push("/account/payment");
      else flashNote("Could not set max bid");
    }
  };

  const toggleMax = () => {
    setShowMax((v) => {
      const opening = !v;
      if (opening && !maxDollars) {
        setMaxDollars(((base + auction.increment * 3) / 100).toFixed(2));
      }
      return opening;
    });
  };

  return (
    <div
      className={[
        "absolute inset-x-0 bottom-0 z-30 border-t-2 bg-itv-surface p-4",
        "transition-transform duration-200 ease-out",
        flashRed ? "border-itv-live" : "border-itv-magenta",
        shown ? "translate-y-0" : "translate-y-full",
      ].join(" ")}
    >
      {/* dismiss */}
      <button
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 text-itv-faint hover:text-itv-text"
      >
        <X size={16} />
      </button>

      {/* ---------------- end states ---------------- */}
      {ended ? (
        <EndBanner ended={ended} router={router} />
      ) : (
        <>
          {/* top row: image + title + badge + countdown */}
          <div className="flex items-center gap-3">
            {auction.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={auction.image}
                alt={auction.title}
                className="h-14 w-14 shrink-0 object-cover"
                width={56}
                height={56}
              />
            ) : (
              <div className="h-14 w-14 shrink-0 bg-itv-surface3" />
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Badge tone="magenta">HAGGLE LIVE</Badge>
                {auction.extended && (
                  <span className="font-mono text-[10px] font-bold text-itv-magenta">
                    (+ext)
                  </span>
                )}
              </div>
              <p className="line-clamp-1 text-[12px] font-semibold text-itv-text">
                {auction.title}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span
                className={`font-mono text-[28px] font-black tabular-nums ${countdownColor}`}
              >
                {mm}:{ss}
              </span>
              {auction.extended && (
                <span className="ml-1 font-mono text-[11px] font-bold text-itv-magenta">
                  (+Next)
                </span>
              )}
            </div>
          </div>

          {/* middle: current bid */}
          <div className="mt-3">
            <p className="text-[9px] uppercase tracking-widest text-itv-faint">
              Current Bid
            </p>
            <p className="font-mono text-[32px] font-black tabular-nums text-itv-magenta">
              {money(base)}
            </p>
            <p className="mt-0.5 text-[12px] text-itv-muted">
              {auction.currentWinnerName ? (
                <>Leading: @{auction.currentWinnerName}</>
              ) : (
                "No bids yet"
              )}
              <span className="ml-2 text-itv-faint">{auction.bidCount} bids</span>
            </p>
          </div>

          {/* outbid / proxy note */}
          {note && (
            <p className="mt-2 text-[11px] font-semibold text-itv-live">{note}</p>
          )}

          {/* bid row */}
          <div className="mt-3 flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isLeader || bidding}
              onClick={placeBid}
            >
              {isLeader ? "You're leading" : `Bid ${money(nextBid)}`}
            </Button>

            <Button variant="ghost" size="sm" className="w-full" onClick={toggleMax}>
              {showMax ? "Hide Max Bid" : "Max Bid"}
            </Button>

            {showMax && (
              <div className="mt-1 flex flex-col gap-2 border-t border-itv-border pt-3">
                <Input
                  label="Your maximum bid"
                  inputMode="decimal"
                  value={maxDollars}
                  onChange={(e) => setMaxDollars(e.target.value)}
                  placeholder="0.00"
                />
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={setMaxBid}
                >
                  Set Max Bid
                </Button>
                <p className="text-[10px] text-itv-faint">
                  We&apos;ll bid for you up to this amount.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* End-state banner                                                    */
/* ------------------------------------------------------------------ */

function EndBanner({
  ended,
  router,
}: {
  ended: EndState;
  router: ReturnType<typeof useRouter>;
}) {
  if (ended.phase === "won") {
    return (
      <div className="flex flex-col items-center gap-2 bg-itv-magenta px-4 py-6 text-center text-white">
        <p className="font-display text-[22px] font-black">YOU WON 🎉</p>
        {ended.finalPrice != null && (
          <p className="font-mono text-[20px] font-black tabular-nums">
            {money(ended.finalPrice)}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 border-white/40 text-white hover:bg-white/10"
          onClick={() =>
            router.push(ended.orderId ? `/orders/${ended.orderId}` : "/account")
          }
        >
          View Order
        </Button>
      </div>
    );
  }

  if (ended.phase === "sold") {
    return (
      <div className="py-4 text-center">
        <p className="font-display text-[16px] font-bold text-itv-text">
          Sold to @{ended.winnerName ?? "winner"}
          {ended.finalPrice != null ? ` for ${money(ended.finalPrice)}` : ""}
        </p>
      </div>
    );
  }

  if (ended.phase === "unsold") {
    return (
      <div className="py-4 text-center">
        <p className="font-display text-[15px] font-bold text-itv-muted">
          Reserve not met — no winner
        </p>
        {ended.reason && (
          <p className="mt-1 text-[11px] text-itv-faint">{ended.reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className="py-4 text-center">
      <p className="font-display text-[15px] font-bold text-itv-muted">
        Auction cancelled
      </p>
    </div>
  );
}
