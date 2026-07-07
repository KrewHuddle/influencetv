"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Tier {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  subscriber_count: number;
}

export default function StudioPatronsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, mutate } = useSWR<{ tiers: Tier[] }>(
    user ? `/api/creators/${user.id}/tiers` : null,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const [name, setName] = useState("");
  const [price, setPrice] = useState("4.99");

  const addTier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/patrons/tiers", {
        name,
        priceCents: Math.round(parseFloat(price) * 100),
      });
      toast({ title: "Tier created" });
      setName("");
      void mutate();
    } catch {
      toast({ title: "Failed (max 3 tiers, min $1.99)", variant: "error" });
    }
  };

  const tiers = data?.tiers ?? [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Patron Tiers</h1>

      <div className="mb-6 space-y-3">
        {tiers.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-itv-border bg-itv-surface p-4">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-itv-muted">{t.subscriber_count} patrons</p>
            </div>
            <span className="text-sm">${(t.price_cents / 100).toFixed(2)}/mo</span>
          </div>
        ))}
        {!tiers.length && <p className="text-sm text-itv-muted">No tiers yet.</p>}
      </div>

      {tiers.length < 3 && (
        <form onSubmit={addTier} className="space-y-3 rounded-lg border border-itv-border bg-itv-surface p-4">
          <h2 className="font-display text-sm">Add Tier</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Price (USD)" type="number" step="0.01" min="1.99" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Button type="submit">Create Tier</Button>
        </form>
      )}
    </div>
  );
}
