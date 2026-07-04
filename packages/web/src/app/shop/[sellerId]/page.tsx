"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
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
  const { data } = useSWR<Storefront>(
    `/api/shop/sellers/${sellerId}/storefront`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl">{data?.seller?.display_name ?? "Seller"}</h1>
        {data?.seller?.bio && (
          <p className="text-sm text-[color:var(--text-secondary)]">{data.seller.bio}</p>
        )}
        {data?.liveShopActive && (
          <div className="mt-3 rounded-lg border border-apex-red/40 bg-apex-red/10 px-4 py-2 text-sm text-apex-red">
            LIVE NOW — Watch &amp; Shop
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {(data?.products ?? []).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
