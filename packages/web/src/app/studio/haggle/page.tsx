"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { apiPost, swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Badge,
  Button,
  Card,
  Input,
  PillFilter,
  Spinner,
  useToast,
} from "@/components/ui";

interface Auction {
  id: string;
  title: string | null;
  product_title: string | null;
  thumbnail_url: string | null;
  status: string;
  started_at: string | null;
  duration_seconds: number;
  bid_count: number;
  final_price_cents: number | null;
  current_bid_cents: number | null;
}

interface AuctionsResponse {
  auctions: Auction[];
  gmvCents: number;
}

interface ProductSummary {
  id: string;
  title: string;
  thumbnail_url: string | null;
  base_price_cents: number;
}

const dollars = (c: number | null | undefined) => `$${((c ?? 0) / 100).toFixed(2)}`;

const STATUS_TONE: Record<
  string,
  "success" | "neutral" | "magenta" | "warn" | "live"
> = {
  sold: "success",
  unsold: "neutral",
  live: "magenta",
  cancelled: "warn",
  payment_failed: "live",
};

const DURATIONS: { value: string; label: string }[] = [
  { value: "60", label: "1 min" },
  { value: "300", label: "5 min" },
  { value: "900", label: "15 min" },
  { value: "1800", label: "30 min" },
];

const SORTS: { value: string; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "gmv", label: "GMV" },
  { value: "bids", label: "Bids" },
];

export default function StudioHagglePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, mutate } = useSWR<AuctionsResponse>(
    "/api/haggle/seller/auctions",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const [showForm, setShowForm] = useState(false);
  const [sort, setSort] = useState("date");

  const [productId, setProductId] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [duration, setDuration] = useState("300");
  const [creating, setCreating] = useState(false);

  const { data: productsData } = useSWR<{ items: ProductSummary[] }>(
    user ? `/api/shop/products?sellerId=${user.id}` : null,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const products = productsData?.items ?? [];

  const auctions = useMemo(() => data?.auctions ?? [], [data]);

  const stats = useMemo(() => {
    const total = auctions.length;
    const sold = auctions.filter((a) => a.status === "sold");
    const soldCount = sold.length;
    const avgSale = soldCount
      ? sold.reduce((s, a) => s + (a.final_price_cents ?? 0), 0) / soldCount
      : 0;
    const avgBids = total
      ? auctions.reduce((s, a) => s + a.bid_count, 0) / total
      : 0;
    const winRate = total ? (soldCount / total) * 100 : 0;
    return { total, avgSale, avgBids, winRate };
  }, [auctions]);

  const sortedAuctions = useMemo(() => {
    const list = [...auctions];
    if (sort === "gmv") {
      list.sort((a, b) => (b.final_price_cents ?? 0) - (a.final_price_cents ?? 0));
    } else if (sort === "bids") {
      list.sort((a, b) => b.bid_count - a.bid_count);
    } else {
      list.sort(
        (a, b) =>
          new Date(b.started_at ?? 0).getTime() -
          new Date(a.started_at ?? 0).getTime()
      );
    }
    return list;
  }, [auctions, sort]);

  const createAuction = async () => {
    if (!productId || !startingBid) {
      toast({ title: "Pick a product and starting bid", variant: "error" });
      return;
    }
    setCreating(true);
    try {
      await apiPost("/api/haggle/auctions", {
        productId,
        startingBidCents: Math.round(parseFloat(startingBid) * 100),
        durationSeconds: parseInt(duration, 10),
        bidIncrementCents: 100,
        autoExtend: true,
      });
      toast({ title: "Auction scheduled" });
      setShowForm(false);
      setProductId("");
      setStartingBid("");
      setDuration("300");
      void mutate();
    } catch {
      toast({ title: "Could not schedule auction", variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl text-itv-text">Haggle Auctions</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Schedule Auction"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 p-5">
          <p className="mb-4 font-display text-sm text-itv-text">
            Schedule a new auction
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-itv-muted">
                Product
              </span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-md border border-itv-border bg-itv-surface px-3.5 py-2.5 text-sm text-itv-text focus:border-itv-magenta focus:outline-none"
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Starting bid ($)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={startingBid}
              onChange={(e) => setStartingBid(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-itv-muted">
              Duration
            </span>
            <PillFilter options={DURATIONS} value={duration} onChange={setDuration} />
          </div>
          <div className="mt-5">
            <Button onClick={createAuction} disabled={creating}>
              {creating ? "Creating…" : "Create Scheduled Auction"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-itv-muted">
                Total Auctions
              </p>
              <p className="mt-2 font-mono text-2xl text-itv-text">{stats.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-itv-muted">
                Total GMV
              </p>
              <p className="mt-2 font-mono text-2xl text-itv-text">
                {dollars(data?.gmvCents)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-itv-muted">
                Avg Sale Price
              </p>
              <p className="mt-2 font-mono text-2xl text-itv-text">
                {dollars(stats.avgSale)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-itv-muted">
                Avg Bids / Auction
              </p>
              <p className="mt-2 font-mono text-2xl text-itv-text">
                {stats.avgBids.toFixed(1)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-itv-muted">
                Win Rate
              </p>
              <p className="mt-2 font-mono text-2xl text-itv-text">
                {stats.winRate.toFixed(0)}%
              </p>
            </Card>
          </div>

          {auctions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-itv-border p-12 text-center text-sm text-itv-muted">
              No auctions yet — run one from the live control panel.
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-itv-border px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-itv-faint">
                  Sort by
                </span>
                <PillFilter options={SORTS} value={sort} onChange={setSort} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-itv-border text-left text-xs uppercase tracking-wide text-itv-faint">
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Started</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Bids</th>
                      <th className="px-4 py-3 font-medium">Final Price</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">GMV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAuctions.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-itv-border last:border-0 hover:bg-itv-surface2"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.thumbnail_url ?? "/placeholder.png"}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded object-cover"
                            />
                            <span className="text-itv-text">
                              {a.product_title ?? a.title ?? "Untitled"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-itv-muted">
                          {a.started_at
                            ? new Date(a.started_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-itv-muted">
                          {a.duration_seconds}s
                        </td>
                        <td className="px-4 py-3 font-mono text-itv-muted">
                          {a.bid_count}
                        </td>
                        <td className="px-4 py-3 font-mono text-itv-text">
                          {a.final_price_cents != null
                            ? dollars(a.final_price_cents)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
                            {a.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-itv-text">
                          {dollars(a.final_price_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
