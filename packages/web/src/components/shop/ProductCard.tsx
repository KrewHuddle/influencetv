import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PriceTag } from "@/components/ui/PriceTag";
import { CreatorLink } from "@/components/video/VideoCard";

export interface ProductSummary {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  base_price_cents: number;
  compare_at_price_cents?: number | null;
  seller_name?: string | null;
  seller_username?: string | null;
}

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <div>
      <Link href={`/shop/product/${product.id}`} className="group block">
        <Card interactive className="overflow-hidden">
          <div className="relative aspect-square bg-itv-surface3">
            {product.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumbnail_url}
                alt={product.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="p-3">
            <h3 className="line-clamp-1 text-[13px] font-semibold text-itv-text">
              {product.title}
            </h3>
            <PriceTag
              cents={product.base_price_cents}
              compareAtCents={product.compare_at_price_cents}
              size="sm"
              className="mt-1"
            />
          </div>
        </Card>
      </Link>
      {product.seller_username && (
        <p className="mt-1 px-1 text-xs text-itv-muted">
          <CreatorLink name={product.seller_name} username={product.seller_username} />
        </p>
      )}
    </div>
  );
}
