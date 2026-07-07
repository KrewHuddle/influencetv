"use client";
import { useState } from "react";
import useSWR from "swr";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { api, apiPost, swrFetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface PaymentMethodsResponse {
  stripeEnabled: boolean;
  defaultId: string | null;
  paymentMethods: PaymentMethod[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad2 = (n: number) => String(n).padStart(2, "0");

function AddCardForm({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: err } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message ?? "Could not save card.");
      setBusy(false);
    } else {
      onSaved();
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-itv-magenta">{error}</p>}
      <Button type="submit" disabled={!stripe || busy} className="w-full">
        {busy ? "Saving…" : "Save Card"}
      </Button>
    </form>
  );
}

export default function PaymentMethodsPage() {
  const { data, error, isLoading, mutate } = useSWR<PaymentMethodsResponse>(
    "/api/account/payment-methods",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const startAdd = async () => {
    setAdding(true);
    try {
      const res = await apiPost<{ clientSecret: string }>(
        "/api/account/payment-methods",
        {}
      );
      setClientSecret(res.clientSecret);
    } catch {
      setAdding(false);
    }
  };

  const makeDefault = async (id: string) => {
    await apiPost(`/api/account/payment-methods/${id}/default`, {});
    mutate();
  };

  const remove = async (id: string) => {
    await api.delete(`/api/account/payment-methods/${id}`);
    mutate();
  };

  const cardSaved = () => {
    setClientSecret(null);
    setAdding(false);
    mutate();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 font-display text-2xl font-bold text-itv-text">
        Payment Methods
      </h1>
      <p className="mb-6 text-sm text-itv-muted">
        Cards used for Haggle wins and shop checkout.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : error ? (
        <Card className="p-6 text-sm text-itv-muted">
          Couldn’t load your payment methods.
        </Card>
      ) : data && data.stripeEnabled === false ? (
        <Card className="p-6 text-sm text-itv-muted">
          Payments aren’t configured yet.
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <div className="space-y-3">
            {data.paymentMethods.length === 0 ? (
              <Card className="p-6 text-sm text-itv-muted">
                No saved cards yet.
              </Card>
            ) : (
              data.paymentMethods.map((pm) => {
                const isDefault = pm.id === data.defaultId;
                return (
                  <Card
                    key={pm.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-itv-text">
                          {cap(pm.brand)}
                        </span>
                        <span className="font-mono text-sm text-itv-muted">
                          •••• {pm.last4}
                        </span>
                        {isDefault && <Badge tone="magenta">Default</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-itv-faint">
                        exp {pad2(pm.expMonth)}/{String(pm.expYear).slice(-2)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!isDefault && (
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => makeDefault(pm.id)}
                        >
                          Make Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(pm.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {clientSecret && stripePromise ? (
            <Card className="p-6">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <AddCardForm onSaved={cardSaved} />
              </Elements>
            </Card>
          ) : adding && !stripePromise ? (
            <Card className="p-6 text-sm text-itv-magenta">
              Stripe is not configured.
            </Card>
          ) : (
            <Button onClick={startAdd} disabled={adding}>
              {adding ? "Loading…" : "Add Card"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
