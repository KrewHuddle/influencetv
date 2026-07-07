"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface Analytics {
  topVideos: Array<{ id: string; title: string; view_count: number; like_count: number }>;
  revenueBySource: Array<{ source: string; net: number }>;
  activePatrons: number;
}

export default function StudioAnalyticsPage() {
  const { user } = useAuth();
  const { data } = useSWR<Analytics>(
    user ? `/api/creators/${user.id}/analytics` : null,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Analytics</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-itv-border bg-itv-surface p-4">
          <p className="text-xs uppercase text-itv-muted">Active Patrons</p>
          <p className="mt-2 font-display text-2xl">{data?.activePatrons ?? 0}</p>
        </div>
        {(data?.revenueBySource ?? []).map((r) => (
          <div key={r.source} className="rounded-lg border border-itv-border bg-itv-surface p-4">
            <p className="text-xs uppercase text-itv-muted">{r.source}</p>
            <p className="mt-2 font-display text-2xl">${(Number(r.net) / 100).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-display text-sm">Top Videos</h2>
      <div className="space-y-2">
        {(data?.topVideos ?? []).map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg border border-itv-border bg-itv-surface p-3 text-sm">
            <span>{v.title}</span>
            <span className="text-itv-muted">{v.view_count} views · {v.like_count} likes</span>
          </div>
        ))}
        {!data?.topVideos?.length && <p className="text-sm text-itv-muted">No data yet.</p>}
      </div>
    </div>
  );
}
