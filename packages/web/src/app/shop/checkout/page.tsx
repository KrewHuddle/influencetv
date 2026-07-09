"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { apiPost } from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PriceTag } from "@/components/ui/PriceTag";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

function PaymentForm({ orderId }: { orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const clear = useCartStore((s) => s.clear);
  const [busy, setBusy] = useState(false);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/shop/checkout?order=${orderId}` },
    });
    if (error) {
      toast({ title: "Payment failed", description: error.message, variant: "error" });
      setBusy(false);
    } else {
      clear();
    }
  };

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || busy} className="w-full">
        {busy ? "Processing…" : "Pay"}
      </Button>
    </form>
  );
}

function CheckoutContent() {
  const { items, subtotalCents, setQuantity, remove } = useCartStore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState({ name: "", line1: "", city: "", zip: "" });

  // Stripe redirect return — confirm the order instead of showing an empty cart.
  const paymentIntent = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");
  const orderParam = searchParams.get("order");
  const redirectFailed =
    redirectStatus === "failed" || redirectStatus === "requires_payment_method";
  const confirmed =
    redirectStatus === "succeeded" ||
    (!!orderParam && !!paymentIntent && !redirectFailed);

  const startCheckout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiPost<{ clientSecret: string; orderId: string }>(
        "/api/shop/checkout",
        {
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
          shippingAddress: address,
        }
      );
      setClientSecret(res.clientSecret);
      setOrderId(res.orderId);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Checkout failed — try again.";
      toast({ title: "Checkout failed", description: message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (confirmed)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-16 text-center">
        <CheckCircle2 size={48} className="text-itv-success" />
        <div className="space-y-1">
          <h1 className="font-display text-2xl text-itv-text">Order confirmed</h1>
          {orderParam && (
            <p className="font-mono text-xs text-itv-faint">Order #{orderParam}</p>
          )}
          <p className="text-sm text-itv-muted">Thanks! Your order is on its way.</p>
        </div>
        <Link href="/" className="text-sm font-medium text-itv-magenta hover:underline">
          Back to home
        </Link>
      </div>
    );

  if (!items.length)
    return <div className="p-8 text-sm text-itv-muted">Your cart is empty.</div>;

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl">Checkout</h1>

      <div className="mb-6 space-y-2">
        {items.map((i) => (
          <div key={i.productId} className="flex items-center justify-between rounded-lg border border-itv-border bg-itv-surface p-3 text-sm">
            <span>{i.title}</span>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={i.quantity}
                onChange={(e) => setQuantity(i.productId, Number(e.target.value))}
                className="w-14 rounded border border-itv-border bg-itv-bg px-2 py-1"
              />
              <PriceTag cents={i.priceCents * i.quantity} size="sm" />
              <button
                aria-label="Remove item"
                onClick={() => remove(i.productId)}
                className="text-itv-faint transition-colors hover:text-itv-live"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        <p className="flex items-center justify-end gap-2 text-sm">
          Subtotal: <PriceTag cents={subtotalCents()} size="sm" />
        </p>
      </div>

      {!clientSecret ? (
        <div className="space-y-3">
          <h2 className="font-display text-sm">Shipping</h2>
          <Input label="Name" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} />
          <Input label="Address" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            <Input label="ZIP" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
          </div>
          <Button className="w-full" disabled={busy} onClick={startCheckout}>
            {busy ? "Preparing…" : "Continue to Payment"}
          </Button>
        </div>
      ) : stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm orderId={orderId!} />
        </Elements>
      ) : (
        <p className="text-sm text-itv-live">Stripe is not configured.</p>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-itv-muted">Loading…</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
