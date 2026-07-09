"use client";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { Badge, Skeleton } from "@/components/ui";
import { ProductCard, type ProductSummary } from "@/components/shop/ProductCard";

interface Storefront {
  seller: { display_name: string | null; bio?: string | null; banner_url?: string | null };
  products: ProductSummary[];
  liveShopActive?: boolean;
}

export default function StorefrontPage({
  params,
}: {
  params: { sellerId: string };
}) {
  const { sellerId } = params;
  const { data, error, isLoading } = useSWR<Storefront>(
    `/api/shop/sellers/${sellerId}/storefront`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  if (isLoading)
    return (
      <div className="px-6 py-6">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-6 h-4 w-72" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      </div>
    );

  if (error)
    return (
      <div className="px-6 py-12 text-sm text-itv-muted">
        Couldn&apos;t load this storefront. Please try again shortly.
      </div>
    );

  const products = data?.products ?? [];

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl">{data?.seller?.display_name ?? "Seller"}</h1>
        {data?.seller?.bio && (
          <p className="text-sm text-itv-muted">{data.seller.bio}</p>
        )}
        {data?.liveShopActive && (
          <Link
            href="/live"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-itv-live bg-itv-live-dim px-4 py-2 text-sm font-medium text-itv-live transition-[filter] hover:brightness-110"
          >
            <Badge tone="live">LIVE NOW</Badge>
            Watch &amp; Shop
          </Link>
        )}
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-itv-muted">No products in this shop yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
