import Link from "next/link";
import Image from "next/image";

export interface ProductSummary {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  base_price_cents: number;
  compare_at_price_cents?: number | null;
}

const price = (c: number) => `$${(c / 100).toFixed(2)}`;

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/shop/product/${product.id}`}
      className="group block overflow-hidden rounded-lg border border-apex bg-apex-gray-900"
    >
      <div className="relative aspect-square bg-apex-gray-800">
        {product.thumbnail_url && (
          <Image
            src={product.thumbnail_url}
            alt={product.title}
            fill
            sizes="240px"
            className="object-cover transition-transform group-hover:scale-105"
          />
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-medium">{product.title}</h3>
        <p className="mt-1 text-sm">
          <span className="text-apex-white">
            {price(product.base_price_cents)}
          </span>
          {product.compare_at_price_cents ? (
            <span className="ml-2 text-xs text-[color:var(--text-muted)] line-through">
              {price(product.compare_at_price_cents)}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
