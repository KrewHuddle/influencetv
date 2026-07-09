"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

interface Overview {
  live: { totalViewers: number; activeChannels: number; streamsIngesting: number };
  today: { newSignups: number; newSubscriptions: number; revenueCents: number; gmvCents: number };
  mtd: { mrrCents: number };
  queues: { pendingVideoReview: number; pendingProductReview: number; openDmcaNotices: number };
  haggle?: {
    activeAuctions: number;
    currentBidsCents: number;
    todayGmvCents: number;
    recentWon: Array<{ id: string; title: string; final_price_cents: number | null; winner: string | null }>;
  };
}

const dollars = (c: number) => `$${(c / 100).toFixed(0)}`;

export default function AdminOverview() {
  const { data } = useSWR<Overview>("/api/admin/overview", swrFetcher, {
    refreshInterval: 10_000,
    shouldRetryOnError: false,
  });

  const row1 = [
    { label: "Live Viewers", value: data?.live.totalViewers ?? 0 },
    { label: "Active Channels", value: data?.live.activeChannels ?? 0 },
    { label: "Streams Ingesting", value: data?.live.streamsIngesting ?? 0 },
    {
      label: "Queue Items",
      value:
        (data?.queues.pendingVideoReview ?? 0) +
        (data?.queues.pendingProductReview ?? 0) +
        (data?.queues.openDmcaNotices ?? 0),
    },
  ];
  const row2 = [
    { label: "Revenue Today", value: dollars(data?.today.revenueCents ?? 0) },
    { label: "New Subs", value: data?.today.newSubscriptions ?? 0 },
    { label: "New Signups", value: data?.today.newSignups ?? 0 },
    { label: "GMV Today", value: dollars(data?.today.gmvCents ?? 0) },
  ];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Overview</h1>
      {[row1, row2].map((row, i) => (
        <div key={i} className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {row.map((t) => (
            <div key={t.label} className="rounded-lg border border-itv-border bg-itv-surface p-4">
              <p className="text-xs uppercase tracking-wide text-itv-muted">{t.label}</p>
              <p className="mt-2 font-mono text-2xl tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      ))}
      <div className="mt-4 rounded-lg border border-itv-border bg-itv-surface p-4">
        <p className="text-sm text-itv-muted">
          MRR: <span className="font-mono tabular-nums text-itv-text">{dollars(data?.mtd.mrrCents ?? 0)}</span> ·
          Pending video review: <span className="font-mono tabular-nums">{data?.queues.pendingVideoReview ?? 0}</span> ·
          Pending products: <span className="font-mono tabular-nums">{data?.queues.pendingProductReview ?? 0}</span> ·
          Open DMCA: <span className="font-mono tabular-nums">{data?.queues.openDmcaNotices ?? 0}</span>
        </p>
      </div>

      {/* Haggle */}
      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg text-itv-text">Haggle</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { label: "Active Auctions", value: data?.haggle?.activeAuctions ?? 0 },
            { label: "Current Bids", value: dollars(data?.haggle?.currentBidsCents ?? 0) },
            { label: "Today’s Haggle GMV", value: dollars(data?.haggle?.todayGmvCents ?? 0) },
          ].map((t) => (
            <div key={t.label} className="rounded-lg border border-itv-border bg-itv-surface p-4">
              <p className="text-xs uppercase tracking-wide text-itv-muted">{t.label}</p>
              <p className="mt-2 font-mono text-2xl tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
        {(data?.haggle?.recentWon?.length ?? 0) > 0 && (
          <div className="mt-4 rounded-lg border border-itv-border bg-itv-surface p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-itv-muted">Recent Won</p>
            <ul className="space-y-1 text-sm text-itv-text">
              {data!.haggle!.recentWon.map((w) => (
                <li key={w.id} className="flex justify-between">
                  <span className="truncate">{w.title}</span>
                  <span className="font-mono tabular-nums text-itv-muted">
                    {w.winner ? `@${w.winner}` : "—"} · {dollars(w.final_price_cents ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
