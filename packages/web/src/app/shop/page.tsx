"use client";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { ProductCard, type ProductSummary } from "@/components/shop/ProductCard";
import { Skeleton } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { PillFilter } from "@/components/ui/PillFilter";

const CATEGORIES = ["All", "Apparel", "Accessories", "Digital", "Collectibles"];

export default function ShopPage() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");

  const key = `/api/shop/products?${cat !== "All" ? `category=${cat}&` : ""}${
    q ? `q=${encodeURIComponent(q)}` : ""
  }`;
  const { data, isLoading } = useSWR<{ items: ProductSummary[] }>(key, swrFetcher, {
    shouldRetryOnError: false,
  });
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-itv-text">Shop</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PillFilter
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          value={cat}
          onChange={setCat}
        />
      </div>
      <Input
        placeholder="Search products…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-6 max-w-md"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-itv-border py-12 text-center text-sm text-itv-muted">
          No products found.
        </p>
      )}
    </div>
  );
}
