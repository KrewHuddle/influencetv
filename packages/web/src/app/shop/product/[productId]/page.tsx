"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";

interface Product {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  base_price_cents: number;
  compare_at_price_cents: number | null;
  seller_name: string | null;
  seller_id: string;
}

export default function ProductDetailPage({
  params,
}: {
  params: { productId: string };
}) {
  const { productId } = params;
  const router = useRouter();
  const add = useCartStore((s) => s.add);
  const { data } = useSWR<{ product: Product }>(
    `/api/shop/products/${productId}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const product = data?.product;

  if (!product)
    return <div className="p-8 text-sm text-itv-muted">Loading…</div>;

  const addToCart = () => {
    add({
      productId: product.id,
      title: product.title,
      priceCents: product.base_price_cents,
      quantity: 1,
      thumbnail: product.thumbnail_url,
    });
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-6 py-8 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-itv-surface2">
        {product.thumbnail_url && (
          <Image src={product.thumbnail_url} alt={product.title} fill sizes="400px" className="object-cover" />
        )}
      </div>
      <div>
        <h1 className="font-display text-2xl">{product.title}</h1>
        <p className="mt-1 text-sm text-itv-muted">by {product.seller_name}</p>
        <p className="my-4 text-2xl">
          ${(product.base_price_cents / 100).toFixed(2)}
          {product.compare_at_price_cents && (
            <span className="ml-2 text-sm text-itv-muted line-through">
              ${(product.compare_at_price_cents / 100).toFixed(2)}
            </span>
          )}
        </p>
        {product.description && (
          <p className="mb-6 text-sm text-itv-muted">{product.description}</p>
        )}
        <div className="flex gap-2">
          <Button onClick={addToCart}>Add to Cart</Button>
          <Button
            variant="ghost"
            onClick={() => {
              addToCart();
              router.push("/shop/checkout");
            }}
          >
            Buy Now
          </Button>
        </div>
      </div>
    </div>
  );
}
