"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, CheckCircle2, Clock, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCartStore } from "@/store/cartStore";
import { apiPost } from "@/lib/api";
import { Button, PriceTag } from "@/components/ui";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

type View = "cart" | "pay" | "processing" | "done";

/** Right-hand slide-over cart with inline (in-drawer) Stripe checkout. */
export function CartDrawer() {
  const { items, isOpen, toggle, remove, setQuantity, clear, subtotalCents } =
    useCartStore();

  const [view, setView] = useState<View>("cart");
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Reset to the cart view every time the drawer re-opens.
  useEffect(() => {
    if (isOpen) {
      setView("cart");
      setClientSecret(null);
      setOrderId(null);
      setFallback(false);
      setBusy(false);
      setCheckoutError(null);
    }
  }, [isOpen]);

  const startCheckout = async () => {
    // No publishable key → fall back to the standalone checkout page.
    if (!stripePromise) {
      setFallback(true);
      setView("pay");
      return;
    }
    setBusy(true);
    setCheckoutError(null);
    try {
      const res = await apiPost<{ clientSecret: string; orderId: string }>(
        "/api/shop/checkout",
        {
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }
      );
      setClientSecret(res.clientSecret);
      setOrderId(res.orderId);
      setFallback(false);
      setView("pay");
    } catch (err) {
      // Surface the server's message in the drawer instead of failing silently.
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Checkout failed — try again.";
      setCheckoutError(message);
    } finally {
      setBusy(false);
    }
  };

  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(o) => toggle(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-itv-bg/80 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-[60] flex h-full w-[92vw] max-w-md flex-col border-l border-itv-border bg-itv-surface shadow-card focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-itv-border px-5 py-4">
            <Dialog.Title className="flex items-center gap-2 font-display text-lg text-itv-text">
              <ShoppingBag size={18} className="text-itv-accent" />
              {view === "done"
                ? "Order confirmed"
                : view === "processing"
                  ? "Payment processing"
                  : "Cart"}
              {view === "cart" && count > 0 && (
                <span className="grid min-w-[1.25rem] place-items-center rounded-full bg-itv-accent px-1.5 font-mono text-xs font-semibold text-itv-bg">
                  {count}
                </span>
              )}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close cart"
              className="text-itv-muted transition-colors hover:text-itv-text"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {view === "done" ? (
            <SuccessView
              orderId={orderId}
              onContinue={() => {
                clear();
                toggle(false);
              }}
            />
          ) : view === "processing" ? (
            <ProcessingView
              onClose={() => {
                clear();
                toggle(false);
              }}
            />
          ) : items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <ShoppingBag size={40} className="text-itv-faint" />
              <p className="text-sm text-itv-muted">Your cart is empty.</p>
              <Button variant="subtle" size="sm" onClick={() => toggle(false)}>
                Keep shopping
              </Button>
            </div>
          ) : view === "pay" ? (
            <PayView
              fallback={fallback}
              clientSecret={clientSecret}
              orderId={orderId}
              subtotalCents={subtotalCents()}
              onBack={() => setView("cart")}
              onSuccess={() => setView("done")}
              onProcessing={() => setView("processing")}
            />
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {items.map((i) => (
                  <div key={i.productId} className="flex gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-itv-surface3">
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
                      {i.variantId && (
                        <p className="truncate font-mono text-xs text-itv-faint">
                          {i.variantId}
                        </p>
                      )}
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
                {checkoutError && (
                  <p className="text-sm text-itv-live">{checkoutError}</p>
                )}
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={startCheckout}
                >
                  {busy ? "Preparing…" : "Checkout"}
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** In-drawer payment step. */
function PayView({
  fallback,
  clientSecret,
  orderId,
  subtotalCents,
  onBack,
  onSuccess,
  onProcessing,
}: {
  fallback: boolean;
  clientSecret: string | null;
  orderId: string | null;
  subtotalCents: number;
  onBack: () => void;
  onSuccess: () => void;
  onProcessing: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Back to cart"
          className="flex items-center gap-1.5 text-sm text-itv-muted transition-colors hover:text-itv-text"
        >
          <ArrowLeft size={16} />
          Back to cart
        </button>
        <PriceTag cents={subtotalCents} size="md" />
      </div>

      {fallback || !stripePromise || !clientSecret ? (
        <div className="space-y-4">
          <p className="text-sm text-itv-muted">
            Secure inline checkout is unavailable right now. Continue on the
            checkout page instead.
          </p>
          <Dialog.Close asChild>
            <Link
              href="/shop/checkout"
              className="block w-full rounded-md bg-itv-accent py-3 text-center text-sm font-medium text-itv-bg transition-[background-color,box-shadow] hover:bg-itv-accent-strong hover:shadow-glow-accent"
            >
              Go to checkout
            </Link>
          </Dialog.Close>
        </div>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm
            orderId={orderId}
            onSuccess={onSuccess}
            onProcessing={onProcessing}
          />
        </Elements>
      )}
    </div>
  );
}

/** Stripe Payment Element + Pay button, kept entirely inside the drawer. */
function PaymentForm({
  orderId,
  onSuccess,
  onProcessing,
}: {
  orderId: string | null;
  onSuccess: () => void;
  onProcessing: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message ?? "Payment failed. Please try again.");
      setBusy(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onSuccess();
      return;
    }
    if (paymentIntent?.status === "processing") {
      onProcessing();
      return;
    }
    // Any other status — the payment didn't complete.
    setError("Payment could not be completed. Please try again.");
    setBusy(false);
  };

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement />
      {orderId && (
        <p className="font-mono text-xs text-itv-faint">Order #{orderId}</p>
      )}
      {error && <p className="text-sm text-itv-live">{error}</p>}
      <Button type="submit" disabled={!stripe || busy} className="w-full">
        {busy ? "Processing…" : "Pay"}
      </Button>
    </form>
  );
}

/** Shown when Stripe reports the payment as still processing. */
function ProcessingView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Clock size={48} className="text-itv-warn" />
      <div className="space-y-1">
        <p className="font-display text-lg text-itv-text">Payment processing</p>
        <p className="text-sm text-itv-muted">
          Payment processing — we&apos;ll confirm by email once it completes.
        </p>
      </div>
      <Button className="w-full" onClick={onClose}>
        Continue Watching
      </Button>
    </div>
  );
}

/** Confirmation state shown after a successful payment. */
function SuccessView({
  orderId,
  onContinue,
}: {
  orderId: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <CheckCircle2 size={48} className="text-itv-success" />
      <div className="space-y-1">
        <p className="font-display text-lg text-itv-text">Order confirmed</p>
        {orderId && (
          <p className="font-mono text-xs text-itv-faint">Order #{orderId}</p>
        )}
        <p className="text-sm text-itv-muted">
          Thanks! Your order is on its way.
        </p>
      </div>
      <Button className="w-full" onClick={onContinue}>
        Continue Watching
      </Button>
    </div>
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
      className="grid h-10 w-10 place-items-center rounded border border-itv-border text-itv-muted transition-colors hover:border-itv-border2 hover:text-itv-text"
    >
      {children}
    </button>
  );
}
