"use client";
import Link from "next/link";
import useSWR from "swr";
import { Upload, Radio, PenSquare, Package } from "lucide-react";
import { swrFetcher } from "@/lib/api";
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
    { label: "Today's Views", value: data?.recentVideos?.reduce((n, v) => n + (v.view_count ?? 0), 0) ?? 0 },
    { label: "New Patrons", value: data?.today.newPatrons ?? 0 },
    { label: "Pending Payout", value: dollars(data?.today.pendingPayoutCents ?? 0) },
    { label: "Shop Revenue", value: dollars(data?.today.shopRevenueCents ?? 0) },
  ];

  const actions = [
    { href: "/studio/upload", label: "Upload Video", Icon: Upload },
    { href: "/live", label: "Go Live", Icon: Radio },
    { href: "/studio/community", label: "Post Update", Icon: PenSquare },
    { href: "/studio/shop", label: "Add Product", Icon: Package },
  ];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 text-[22px] font-black">Dashboard</h1>

      {/* stat tiles */}
      <div className="mb-4 grid grid-cols-2 gap-px bg-itv-border md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="border border-itv-border bg-itv-surface p-4">
            <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-white/[0.38]">{t.label}</p>
            <p className="mt-2 text-[26px] font-black text-white">{t.value}</p>
          </div>
        ))}
      </div>

      {/* quick actions */}
      <div className="mb-8 grid grid-cols-2 gap-px bg-itv-border md:grid-cols-4">
        {actions.map(({ href, label, Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 border border-itv-border bg-itv-surface px-4 py-[14px] hover:bg-itv-surface2"
          >
            <Icon size={20} className="text-itv-magenta" />
            <span className="text-[11px] font-bold text-white">{label}</span>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-[13px] font-extrabold">Recent Uploads</h2>
      <div className="space-y-2">
        {(data?.recentVideos ?? []).map((v) => (
          <div key={v.id} className="flex items-center justify-between border border-itv-border bg-itv-surface p-3">
            <span className="text-sm">{v.title}</span>
            <Badge>{v.status}</Badge>
          </div>
        ))}
        {!data?.recentVideos?.length && (
          <p className="text-sm text-white/[0.42]">No uploads yet.</p>
        )}
      </div>
    </div>
  );
}
