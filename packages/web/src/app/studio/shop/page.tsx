"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Product {
  id: string;
  title: string;
  base_price_cents: number;
  status: string;
  thumbnail_url?: string | null;
}

export default function StudioShopPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, mutate } = useSWR<{ products: Product[] }>(
    user ? `/api/shop/sellers/${user.id}/storefront` : null,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("19.99");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [inventory, setInventory] = useState("10");
  const [isDigital, setIsDigital] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      toast({ title: "At least one image URL is required", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/shop/products", {
        title,
        description: description || undefined,
        category: category || undefined,
        basePriceCents: Math.round(parseFloat(price) * 100),
        inventoryCount: parseInt(inventory, 10) || 0,
        isDigital,
        imageUrls: imageUrl.split(",").map((u) => u.trim()).filter(Boolean),
      });
      toast({ title: "Product submitted — pending review" });
      setTitle("");
      setImageUrl("");
      setDescription("");
      void mutate();
    } catch {
      toast({ title: "Failed to create product", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const products = data?.products ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] font-black">Shop</h1>
        <Link href="/studio/shop/orders" className="text-[12px] font-semibold text-itv-magenta">
          View Orders →
        </Link>
      </div>

      {/* existing products */}
      <div className="mb-8 space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-itv-border bg-itv-surface p-3">
            <span className="text-sm font-medium">{p.title}</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-[1px] text-itv-faint">{p.status}</span>
              <span className="text-sm">${(p.base_price_cents / 100).toFixed(2)}</span>
            </div>
          </div>
        ))}
        {!products.length && (
          <p className="text-sm text-itv-faint">No products yet. Create one below.</p>
        )}
      </div>

      {/* create form */}
      <form onSubmit={create} className="space-y-4 border border-itv-border bg-itv-surface p-5">
        <h2 className="text-[13px] font-extrabold">New Product</h2>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Price (USD)" type="number" step="0.01" min="0.5" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Input label="Inventory" type="number" min="0" value={inventory} onChange={(e) => setInventory(e.target.value)} />
        </div>
        <Input label="Image URL(s) — comma separated" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://cdn.influencetvnetwork.com/..." required />
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="apparel, digital, …" />
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-itv-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-[4px] border border-itv-border bg-itv-surface2 px-3.5 py-2.5 text-sm text-itv-text outline-none focus:ring-1 focus:ring-itv-magenta"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDigital} onChange={(e) => setIsDigital(e.target.checked)} />
          Digital product (no shipping)
        </label>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Submitting…" : "Create Product"}
        </Button>
        <p className="text-[11px] text-itv-faint">
          New products enter review before appearing in the shop.
        </p>
      </form>
    </div>
  );
}
