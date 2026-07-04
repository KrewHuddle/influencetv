"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Order {
  id: string;
  order_number: string;
  status: string;
  subtotal_cents: number;
  tracking_number: string | null;
  created_at: string;
}

export default function SellerOrdersPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<{ items: Order[] }>(
    "/api/shop/orders?limit=25",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const [tracking, setTracking] = useState<Record<string, string>>({});

  const ship = async (id: string) => {
    try {
      await api.post(`/api/shop/orders/${id}/fulfill`, {
        trackingNumber: tracking[id] ?? "",
        carrier: "USPS",
      });
      toast({ title: "Marked shipped" });
      void mutate();
    } catch {
      toast({ title: "Failed", variant: "error" });
    }
  };

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Orders</h1>
      <div className="space-y-2">
        {(data?.items ?? []).map((o) => (
          <div key={o.id} className="rounded-lg border border-apex bg-apex-gray-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{o.order_number}</p>
                <p className="text-xs text-[color:var(--text-muted)]">
                  ${(o.subtotal_cents / 100).toFixed(2)} · {new Date(o.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge>{o.status}</Badge>
            </div>
            {o.status === "paid" && (
              <div className="mt-3 flex gap-2">
                <input
                  placeholder="Tracking #"
                  value={tracking[o.id] ?? ""}
                  onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })}
                  className="flex-1 rounded border border-apex bg-apex-black px-3 py-1.5 text-sm"
                />
                <Button className="text-xs" onClick={() => ship(o.id)}>Mark Shipped</Button>
              </div>
            )}
          </div>
        ))}
        {!data?.items?.length && <p className="text-sm text-[color:var(--text-muted)]">No orders.</p>}
      </div>
    </div>
  );
}
