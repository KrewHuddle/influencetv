"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Campaign {
  id: string;
  advertiser_name: string;
  creative_title?: string | null;
  cpm_cents: number;
  budget_cents: number | null;
  impressions_served: number;
  impressions_target: number | null;
  spend_cents: number;
  is_active: boolean;
}
interface Report {
  campaigns: Array<{ id: string; advertiser_name: string; revenue_cents: number; impressions_served: number }>;
  totals: { impressions: number; revenueCents: number };
}

const dollars = (c?: number | null) => `$${((c ?? 0) / 100).toFixed(2)}`;

export default function AdminAdsPage() {
  const { toast } = useToast();
  const { data: camps, mutate } = useSWR<{ campaigns: Campaign[] }>("/api/ads/campaigns", swrFetcher, { shouldRetryOnError: false });
  const { data: report } = useSWR<Report>("/api/ads/report", swrFetcher, { shouldRetryOnError: false });

  const [advertiser, setAdvertiser] = useState("");
  const [videoId, setVideoId] = useState("");
  const [cpm, setCpm] = useState("20.00");
  const [budget, setBudget] = useState("1000");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/ads/campaigns", {
        advertiserName: advertiser,
        videoId,
        cpmCents: Math.round(parseFloat(cpm) * 100),
        budgetCents: Math.round(parseFloat(budget) * 100),
      });
      toast({ title: "Campaign created" });
      setAdvertiser("");
      setVideoId("");
      void mutate();
    } catch {
      toast({ title: "Failed — check the creative video ID", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: Campaign) => {
    await api.patch(`/api/ads/campaigns/${c.id}`, { isActive: !c.is_active });
    void mutate();
  };

  const campaigns = camps?.campaigns ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 text-[22px] font-black">Ad Ops</h1>

      {/* totals */}
      <div className="mb-6 grid grid-cols-2 gap-px bg-itv-border md:grid-cols-3">
        <div className="border border-itv-border bg-itv-surface p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-itv-faint">Ad Revenue</p>
          <p className="mt-2 text-[26px] font-black">{dollars(report?.totals.revenueCents)}</p>
        </div>
        <div className="border border-itv-border bg-itv-surface p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-itv-faint">Impressions</p>
          <p className="mt-2 text-[26px] font-black">{(report?.totals.impressions ?? 0).toLocaleString()}</p>
        </div>
        <div className="border border-itv-border bg-itv-surface p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-itv-faint">Campaigns</p>
          <p className="mt-2 text-[26px] font-black">{campaigns.length}</p>
        </div>
      </div>

      {/* campaigns */}
      <div className="mb-8 space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-itv-border bg-itv-surface p-3">
            <div>
              <p className="text-sm font-bold">{c.advertiser_name}</p>
              <p className="text-[11px] text-itv-faint">
                {c.creative_title ?? "creative"} · CPM {dollars(c.cpm_cents)} · {c.impressions_served.toLocaleString()} imp · spend {dollars(c.spend_cents)}{c.budget_cents ? ` / ${dollars(c.budget_cents)}` : ""}
              </p>
            </div>
            <button
              onClick={() => toggle(c)}
              className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] ${c.is_active ? "bg-itv-accent text-itv-bg" : "bg-itv-surface2 text-itv-muted"}`}
            >
              {c.is_active ? "Active" : "Paused"}
            </button>
          </div>
        ))}
        {!campaigns.length && <p className="text-sm text-itv-faint">No campaigns yet.</p>}
      </div>

      {/* create */}
      <form onSubmit={create} className="max-w-lg space-y-4 border border-itv-border bg-itv-surface p-5">
        <h2 className="text-[13px] font-extrabold">New Campaign</h2>
        <Input label="Advertiser" value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} required />
        <Input label="Creative video ID (a ready video)" value={videoId} onChange={(e) => setVideoId(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="CPM (USD)" type="number" step="0.01" value={cpm} onChange={(e) => setCpm(e.target.value)} />
          <Input label="Budget (USD)" type="number" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create Campaign"}
        </Button>
      </form>
    </div>
  );
}
