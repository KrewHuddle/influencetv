"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

interface Revenue {
  mrrCents: number;
  byStream: Array<{ source: string; platform_fees: number; gross: number }>;
  totalPayoutsCents: number;
}

const dollars = (c: number) => `$${(Number(c) / 100).toFixed(2)}`;

export default function AdminRevenuePage() {
  const { data } = useSWR<Revenue>("/api/admin/revenue", swrFetcher, {
    shouldRetryOnError: false,
  });

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Revenue</h1>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-apex bg-apex-gray-900 p-4">
          <p className="text-xs uppercase text-[color:var(--text-muted)]">MRR</p>
          <p className="mt-2 font-display text-2xl">{dollars(data?.mrrCents ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-apex bg-apex-gray-900 p-4">
          <p className="text-xs uppercase text-[color:var(--text-muted)]">Total Payouts</p>
          <p className="mt-2 font-display text-2xl">{dollars(data?.totalPayoutsCents ?? 0)}</p>
        </div>
      </div>

      <h2 className="mb-3 font-display text-sm">Platform Fees by Stream</h2>
      <div className="space-y-2">
        {(data?.byStream ?? []).map((s) => (
          <div key={s.source} className="flex items-center justify-between rounded-lg border border-apex bg-apex-gray-900 p-3 text-sm">
            <span className="capitalize">{s.source}</span>
            <span>fees {dollars(s.platform_fees)} · gross {dollars(s.gross)}</span>
          </div>
        ))}
        {!data?.byStream?.length && <p className="text-sm text-[color:var(--text-muted)]">No revenue yet.</p>}
      </div>
    </div>
  );
}
