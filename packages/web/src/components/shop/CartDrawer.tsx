"use client";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";

/** Right-hand slide-over cart. Driven by cartStore.isOpen / toggle. */
export function CartDrawer() {
  const { items, isOpen, toggle, remove, setQuantity, subtotalCents } =
    useCartStore();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => toggle(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-[60] flex h-full w-[92vw] max-w-md flex-col border-l border-itv-border bg-itv-surface shadow-card focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-itv-border px-5 py-4">
            <Dialog.Title className="flex items-center gap-2 font-display text-lg text-itv-text">
              <ShoppingBag size={18} className="text-itv-magenta" />
              Your Cart
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close cart"
              className="text-itv-muted transition-colors hover:text-itv-text"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <ShoppingBag size={40} className="text-itv-faint" />
              <p className="text-sm text-itv-muted">Your cart is empty.</p>
              <Button variant="subtle" size="sm" onClick={() => toggle(false)}>
                Keep shopping
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {items.map((i) => (
                  <div key={i.productId} className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-itv-surface3">
                      {i.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={i.thumbnail}
                          alt={i.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-itv-text">
                        {i.title}
                      </p>
                      <PriceTag cents={i.priceCents} size="sm" className="mt-0.5" />
                      <div className="mt-2 flex items-center gap-2">
                        <QtyBtn
                          label="Decrease quantity"
                          onClick={() => setQuantity(i.productId, i.quantity - 1)}
                        >
                          <Minus size={13} />
                        </QtyBtn>
                        <span className="w-6 text-center font-mono text-sm tabular-nums text-itv-text">
                          {i.quantity}
                        </span>
                        <QtyBtn
                          label="Increase quantity"
                          onClick={() => setQuantity(i.productId, i.quantity + 1)}
                        >
                          <Plus size={13} />
                        </QtyBtn>
                        <button
                          aria-label="Remove item"
                          onClick={() => remove(i.productId)}
                          className="ml-auto text-itv-faint transition-colors hover:text-itv-live"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-itv-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-itv-muted">Subtotal</span>
                  <PriceTag cents={subtotalCents()} size="lg" />
                </div>
                <Dialog.Close asChild>
                  <Link
                    href="/shop/checkout"
                    className="block w-full rounded-md bg-itv-magenta py-3 text-center text-sm font-medium text-white transition-[background-color,box-shadow] hover:bg-itv-magenta-strong hover:shadow-glow-magenta"
                  >
                    Checkout
                  </Link>
                </Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QtyBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded border border-itv-border text-itv-muted transition-colors hover:border-itv-border2 hover:text-itv-text"
    >
      {children}
    </button>
  );
}
