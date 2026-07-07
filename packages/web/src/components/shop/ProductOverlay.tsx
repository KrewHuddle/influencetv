"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useCartStore } from "@/store/cartStore";

interface PinnedProduct {
  productId: string;
  title: string;
  price: number;
  thumbnail?: string | null;
  compareAtPrice?: number | null;
  liveShopId?: string;
  flashUnitsLeft?: number | null;
  flashEndsAt?: string | null;
}

/** Listens for `product-pinned` in a channel room and slides a buy card up. */
export function ProductOverlay({ channelId }: { channelId: string }) {
  const socket = useSocket();
  const addToCart = useCartStore((s) => s.add);
  const [product, setProduct] = useState<PinnedProduct | null>(null);
  const [shown, setShown] = useState(false);
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  // socket wiring
  useEffect(() => {
    if (!socket) return;
    socket.emit("join-channel", channelId);
    const onPin = (p: PinnedProduct) => setProduct(p);
    const onUnpin = () => setProduct(null);
    socket.on("product-pinned", onPin);
    socket.on("product-unpinned", onUnpin);
    return () => {
      socket.off("product-pinned", onPin);
      socket.off("product-unpinned", onUnpin);
      socket.emit("leave-channel", channelId);
    };
  }, [socket, channelId]);

  // slide-in + 30s auto-dismiss on each new product
  useEffect(() => {
    if (!product) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    const dismiss = setTimeout(() => setProduct(null), 30_000);
    // flash countdown
    if (product.flashEndsAt) {
      const end = new Date(product.flashEndsAt).getTime();
      setSecsLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    } else {
      setSecsLeft(null);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(dismiss);
    };
  }, [product]);

  useEffect(() => {
    if (secsLeft == null || secsLeft <= 0) return;
    const t = setInterval(() => setSecsLeft((v) => (v == null || v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(t);
  }, [secsLeft]);

  if (!product) return null;
  const isFlash = product.flashUnitsLeft != null || product.flashEndsAt != null;

  return (
    <div
      className="absolute bottom-0 left-1/2 z-20 flex w-4/5 -translate-x-1/2 items-center gap-3 p-3"
      style={{
        background: "var(--itv-surface)",
        borderTop: "2px solid var(--itv-magenta)",
        transform: `translate(-50%, ${shown ? "0" : "100%"})`,
        transition: "transform 200ms ease-out",
      }}
    >
      {product.thumbnail && (
        <Image
          src={product.thumbnail}
          alt={product.title}
          width={60}
          height={60}
          className="object-cover"
        />
      )}
      <div className="flex-1">
        <p className="line-clamp-1 text-sm font-bold text-itv-text">{product.title}</p>
        <p className="text-sm font-bold text-itv-magenta">${(product.price / 100).toFixed(2)}</p>
        {isFlash && (
          <p className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-itv-magenta">
            {secsLeft != null && (
              <span className="font-mono">
                {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, "0")}
              </span>
            )}
            {product.flashUnitsLeft != null && <span>{product.flashUnitsLeft} units left</span>}
          </p>
        )}
      </div>
      <button
        onClick={() =>
          addToCart({
            productId: product.productId,
            title: product.title,
            priceCents: product.price,
            quantity: 1,
            thumbnail: product.thumbnail ?? null,
          })
        }
        className="bg-itv-magenta px-3 py-2 text-xs font-extrabold text-white hover:brightness-110"
      >
        Add to Cart
      </button>
      <button
        aria-label="Dismiss"
        onClick={() => setProduct(null)}
        className="text-white/40 hover:text-itv-text"
      >
        <X size={16} />
      </button>
    </div>
  );
}
