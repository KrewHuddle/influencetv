"use client";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Studio {
  today: { shopRevenueCents: number; newPatrons: number; pendingPayoutCents: number };
  recentVideos: Array<{ id: string; title: string; status: string; view_count: number }>;
  patronBreakdown: { totalPatrons: number; byTier: Array<{ name: string; subscriber_count: number }> };
  community: { memberCount: number; postCount: number };
}

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function StudioDashboard() {
  const { data } = useSWR<Studio>("/api/creators/studio", swrFetcher, {
    shouldRetryOnError: false,
  });

  const tiles = [
    { label: "Views (recent)", value: data?.recentVideos?.reduce((n, v) => n + (v.view_count ?? 0), 0) ?? 0 },
    { label: "New Patrons", value: data?.today.newPatrons ?? 0 },
    { label: "Shop Revenue", value: dollars(data?.today.shopRevenueCents ?? 0) },
    { label: "Pending Payout", value: dollars(data?.today.pendingPayoutCents ?? 0) },
  ];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-apex bg-apex-gray-900 p-4">
            <p className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">{t.label}</p>
            <p className="mt-2 font-display text-2xl">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <Link href="/studio/upload"><Button className="text-xs">+ Upload Video</Button></Link>
        <Link href="/studio/community"><Button variant="ghost" className="text-xs">Post Update</Button></Link>
        <Link href="/studio/patrons"><Button variant="ghost" className="text-xs">Add Tier</Button></Link>
      </div>

      <h2 className="mb-3 font-display text-sm">Recent Uploads</h2>
      <div className="space-y-2">
        {(data?.recentVideos ?? []).map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg border border-apex bg-apex-gray-900 p-3">
            <span className="text-sm">{v.title}</span>
            <Badge>{v.status}</Badge>
          </div>
        ))}
        {!data?.recentVideos?.length && (
          <p className="text-sm text-[color:var(--text-muted)]">No uploads yet.</p>
        )}
      </div>
    </div>
  );
}
