"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

interface Overview {
  live: { totalViewers: number; activeChannels: number; streamsIngesting: number };
  today: { newSignups: number; newSubscriptions: number; revenueCents: number; gmvCents: number };
  mtd: { mrrCents: number };
  queues: { pendingVideoReview: number; pendingProductReview: number; openDmcaNotices: number };
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
            <div key={t.label} className="rounded-lg border border-apex bg-apex-gray-900 p-4">
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">{t.label}</p>
              <p className="mt-2 font-display text-2xl">{t.value}</p>
            </div>
          ))}
        </div>
      ))}
      <div className="mt-4 rounded-lg border border-apex bg-apex-gray-900 p-4">
        <p className="text-sm text-[color:var(--text-secondary)]">
          MRR: <span className="text-apex-white">{dollars(data?.mtd.mrrCents ?? 0)}</span> ·
          Pending video review: {data?.queues.pendingVideoReview ?? 0} ·
          Pending products: {data?.queues.pendingProductReview ?? 0} ·
          Open DMCA: {data?.queues.openDmcaNotices ?? 0}
        </p>
      </div>
    </div>
  );
}
