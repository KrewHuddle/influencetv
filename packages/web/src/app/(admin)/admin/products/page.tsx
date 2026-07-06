"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Product {
  id: string; title: string; status: string; base_price_cents: number; seller_name?: string | null;
}

const TABS = ["pending", "approved", "rejected"];

export default function AdminProductsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const { data, mutate } = useSWR<{ items: Product[] }>(`/api/admin/products?status=${tab}`, swrFetcher, { shouldRetryOnError: false });

  const act = async (id: string, action: "approve" | "reject") => {
    await api.patch(`/api/admin/products/${id}/${action}`);
    toast({ title: `Product ${action}d` });
    void mutate();
  };

  const items = data?.items ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-4 text-[22px] font-black">Products</h1>
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-3 py-1 text-[11px] font-bold uppercase tracking-[1px]"
            style={tab === t ? { background: "#D946EF", color: "#fff" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border border-itv-border bg-itv-surface p-3">
            <div>
              <p className="text-sm font-bold">{p.title}</p>
              <p className="text-[11px] text-white/[0.45]">{p.seller_name ?? "seller"} · ${(p.base_price_cents / 100).toFixed(2)}</p>
            </div>
            {tab === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => act(p.id, "approve")} className="px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white" style={{ background: "#D946EF" }}>Approve</button>
                <button onClick={() => act(p.id, "reject")} className="border border-itv-border px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] hover:bg-white/[0.06]">Reject</button>
              </div>
            )}
          </div>
        ))}
        {!items.length && <p className="text-sm text-white/[0.42]">No {tab} products.</p>}
      </div>
    </div>
  );
}
