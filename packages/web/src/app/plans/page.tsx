"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/components/ui/PriceTag";

export default function PlansPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const upgrade = async (planId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (planId === "free" || busyPlan) return;
    setBusyPlan(planId);
    try {
      const { checkoutUrl } = await apiPost<{ checkoutUrl: string }>(
        "/api/subscriptions/create-checkout",
        { plan: planId }
      );
      window.location.href = checkoutUrl;
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Could not start checkout — try again.";
      toast({ title: "Upgrade failed", description: message, variant: "error" });
      setBusyPlan(null);
    }
  };

  return (
    <div className="bg-itv-bg px-5 py-12">
      <h1 className="mb-2 text-center font-display text-[26px] font-black tracking-[-0.5px] text-itv-text">
        Pick your plan
      </h1>
      <p className="mb-10 text-center text-[12px] text-itv-muted">
        Start free. Upgrade when the network makes you want more.
      </p>

      <div className="mx-auto grid max-w-4xl gap-px bg-itv-border md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = "featured" in plan && plan.featured;
          const current = user?.plan === plan.id;
          const busy = busyPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={
                featured
                  ? "border border-itv-border border-t-2 border-t-itv-magenta bg-itv-surface px-6 py-7"
                  : "border border-itv-border bg-itv-bg px-6 py-7"
              }
            >
              <p className="font-display text-[9px] font-extrabold uppercase tracking-[2px] text-itv-faint">
                {plan.name}
              </p>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-[36px] font-black tabular-nums tracking-[-1px] text-itv-text">
                  {formatPrice(Math.round(plan.price * 100))}
                </span>
                <span className="text-[10px] text-itv-faint">
                  {"period" in plan ? plan.period : "/mo"}
                </span>
              </p>

              <div className="my-4 h-px bg-itv-border" />

              <ul className="flex flex-col gap-2 text-[11px] text-itv-muted">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2">
                    {f.included ? (
                      <Check size={14} className="shrink-0 text-itv-success" />
                    ) : (
                      <X size={14} className="shrink-0 text-itv-faint" />
                    )}
                    <span className={f.included ? "" : "text-itv-faint"}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={featured ? "primary" : "subtle"}
                onClick={() => upgrade(plan.id)}
                disabled={current || busy}
                className="mt-6 w-full text-[10px] font-extrabold uppercase tracking-[1px]"
              >
                {current
                  ? "Current Plan"
                  : busy
                    ? "Starting…"
                    : plan.id === "free"
                      ? "Get Started"
                      : `Get ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
