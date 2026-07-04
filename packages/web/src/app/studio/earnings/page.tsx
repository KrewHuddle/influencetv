"use client";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

interface Earnings {
  items: Array<{ id: string; source: string; net_cents: number; created_at: string; is_paid_out: boolean }>;
  pendingCents: number;
  lifetimeCents: number;
}

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function StudioEarningsPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<Earnings>("/api/creators/earnings", swrFetcher, {
    shouldRetryOnError: false,
  });

  const requestPayout = async () => {
    try {
      await api.post("/api/creators/payouts/request");
      toast({ title: "Payout requested" });
      void mutate();
    } catch {
      toast({ title: "Payout unavailable", description: "Verify Stripe + $10 minimum", variant: "error" });
    }
  };

  const setupPayments = async () => {
    try {
      await api.post("/api/creators/connect/start");
      toast({ title: "Opening Stripe onboarding…" });
    } catch {
      toast({ title: "Setup failed", variant: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Earnings</h1>

      <div className="mb-6 rounded-lg border border-apex bg-apex-gray-900 p-6">
        <p className="text-xs uppercase text-[color:var(--text-muted)]">Pending Balance</p>
        <p className="my-2 font-display text-4xl">{dollars(data?.pendingCents ?? 0)}</p>
        <p className="text-xs text-[color:var(--text-muted)]">Lifetime: {dollars(data?.lifetimeCents ?? 0)}</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={requestPayout} disabled={(data?.pendingCents ?? 0) < 1000}>
            Request Payout
          </Button>
          <Button variant="ghost" onClick={setupPayments}>Set Up Payments</Button>
        </div>
      </div>

      <h2 className="mb-3 font-display text-sm">History</h2>
      <div className="space-y-2">
        {(data?.items ?? []).map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-apex bg-apex-gray-900 p-3 text-sm">
            <span className="capitalize">{e.source}</span>
            <span>{dollars(e.net_cents)}</span>
          </div>
        ))}
        {!data?.items?.length && <p className="text-sm text-[color:var(--text-muted)]">No earnings yet.</p>}
      </div>
    </div>
  );
}
