"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

interface Revenue {
  mrrCents: number;
  byStream: Array<{ source: string; platform_fees: number; gross: number }>;
  totalPayoutsCents: number;
  adRevenueCents: number;
  adImpressions: number;
  activeSubsByPlan: Array<{ plan: string; count: number }>;
  gmvCents: number;
  churn30: number;
}

const dollars = (c: number) => `$${(Number(c) / 100).toFixed(2)}`;

export default function AdminRevenuePage() {
  const { data } = useSWR<Revenue>("/api/admin/revenue", swrFetcher, { shouldRetryOnError: false });

  const tiles = [
    { label: "MRR", value: dollars(data?.mrrCents ?? 0) },
    { label: "Ad Revenue", value: dollars(data?.adRevenueCents ?? 0) },
    { label: "Shop GMV", value: dollars(data?.gmvCents ?? 0) },
    { label: "Total Payouts", value: dollars(data?.totalPayoutsCents ?? 0) },
    { label: "Ad Impressions", value: (data?.adImpressions ?? 0).toLocaleString() },
    { label: "Churn (30d)", value: String(data?.churn30 ?? 0) },
  ];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 text-[22px] font-black">Revenue</h1>

      <div className="mb-8 grid grid-cols-2 gap-px bg-itv-border md:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="border border-itv-border bg-itv-surface p-4">
            <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-white/[0.38]">{t.label}</p>
            <p className="mt-2 text-[24px] font-black">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-[13px] font-extrabold">Active Subscriptions</h2>
          <div className="space-y-2">
            {(data?.activeSubsByPlan ?? []).map((s) => (
              <div key={s.plan} className="flex items-center justify-between border border-itv-border bg-itv-surface p-3 text-sm">
                <span className="capitalize">{s.plan}</span>
                <span className="font-bold">{s.count}</span>
              </div>
            ))}
            {!data?.activeSubsByPlan?.length && <p className="text-sm text-white/[0.42]">No active subscriptions.</p>}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-[13px] font-extrabold">Platform Fees by Stream</h2>
          <div className="space-y-2">
            {(data?.byStream ?? []).map((s) => (
              <div key={s.source} className="flex items-center justify-between border border-itv-border bg-itv-surface p-3 text-sm">
                <span className="capitalize">{s.source}</span>
                <span>fees {dollars(s.platform_fees)} · gross {dollars(s.gross)}</span>
              </div>
            ))}
            {!data?.byStream?.length && <p className="text-sm text-white/[0.42]">No creator revenue yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
