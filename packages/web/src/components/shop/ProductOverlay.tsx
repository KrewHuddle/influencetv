"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/Button";

interface PinnedProduct {
  productId: string;
  title: string;
  price: number;
  thumbnail?: string | null;
  compareAtPrice?: number | null;
  liveShopId?: string;
}

/** Listens for `product-pinned` in a channel room and slides a buy card up. */
export function ProductOverlay({ channelId }: { channelId: string }) {
  const socket = useSocket();
  const [product, setProduct] = useState<PinnedProduct | null>(null);

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

  if (!product) return null;

  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex w-[90%] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-apex bg-apex-gray-900/95 p-3 shadow-2xl">
      {product.thumbnail && (
        <Image
          src={product.thumbnail}
          alt={product.title}
          width={56}
          height={56}
          className="rounded-md object-cover"
        />
      )}
      <div className="flex-1">
        <p className="line-clamp-1 text-sm font-medium">{product.title}</p>
        <p className="text-sm text-apex-red">${(product.price / 100).toFixed(2)}</p>
      </div>
      <Button className="px-3 py-2 text-xs">Buy Now</Button>
      <button
        aria-label="Dismiss"
        onClick={() => setProduct(null)}
        className="text-[color:var(--text-muted)] hover:text-apex-white"
      >
        <X size={16} />
      </button>
    </div>
  );
}
