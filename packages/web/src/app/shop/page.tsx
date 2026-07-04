"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { ProductCard, type ProductSummary } from "@/components/shop/ProductCard";
import { Skeleton } from "@/components/ui/Spinner";

export default function ShopPage() {
  const { data, isLoading } = useSWR<{ items: ProductSummary[] }>(
    "/api/shop/products",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const items = data?.items ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Shop</h1>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--text-muted)]">No products yet.</p>
      )}
    </div>
  );
}
