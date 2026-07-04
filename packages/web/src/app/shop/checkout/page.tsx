"use client";
import { useState } from "react";
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

export default function CheckoutPage() {
  const { items, subtotalCents, setQuantity, remove } = useCartStore();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [address, setAddress] = useState({ name: "", line1: "", city: "", zip: "" });

  const startCheckout = async () => {
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
    } catch {
      toast({ title: "Checkout failed", description: "Items must be from one seller", variant: "error" });
    }
  };

  if (!items.length)
    return <div className="p-8 text-sm text-[color:var(--text-muted)]">Your cart is empty.</div>;

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl">Checkout</h1>

      <div className="mb-6 space-y-2">
        {items.map((i) => (
          <div key={i.productId} className="flex items-center justify-between rounded-lg border border-apex bg-apex-gray-900 p-3 text-sm">
            <span>{i.title}</span>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={i.quantity}
                onChange={(e) => setQuantity(i.productId, Number(e.target.value))}
                className="w-14 rounded border border-apex bg-apex-black px-2 py-1"
              />
              <span>${((i.priceCents * i.quantity) / 100).toFixed(2)}</span>
              <button onClick={() => remove(i.productId)} className="text-apex-red">✕</button>
            </div>
          </div>
        ))}
        <p className="text-right text-sm">Subtotal: <span className="font-medium">${(subtotalCents() / 100).toFixed(2)}</span></p>
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
          <Button className="w-full" onClick={startCheckout}>Continue to Payment</Button>
        </div>
      ) : stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm orderId={orderId!} />
        </Elements>
      ) : (
        <p className="text-sm text-apex-red">Stripe is not configured.</p>
      )}
    </div>
  );
}
