"use client";
import { Check, X } from "lucide-react";
import { PLANS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function PlansPage() {
  const { user } = useAuth();
  const router = useRouter();

  const upgrade = async (planId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (planId === "free") return;
    try {
      const { checkoutUrl } = await apiPost<{ checkoutUrl: string }>(
        "/api/subscriptions/create-checkout",
        { plan: planId }
      );
      window.location.href = checkoutUrl;
    } catch {
      router.push("/account/subscription");
    }
  };

  return (
    <div className="px-6 py-10">
      <h1 className="mb-10 text-center font-display text-3xl">Choose your plan</h1>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border ${plan.accent} bg-apex-gray-900 p-6 ${
              "featured" in plan && plan.featured ? "ring-1 ring-apex-red" : ""
            }`}
          >
            <h2 className="font-display text-xl">{plan.name}</h2>
            <p className="my-4">
              <span className="text-4xl font-semibold">${plan.price}</span>
              <span className="text-sm text-[color:var(--text-muted)]">/mo</span>
            </p>
            <ul className="mb-6 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f.label} className="flex items-center gap-2">
                  {f.included ? (
                    <Check size={15} className="text-green-400" />
                  ) : (
                    <X size={15} className="text-[color:var(--text-muted)]" />
                  )}
                  <span className={f.included ? "" : "text-[color:var(--text-muted)]"}>
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              variant={"featured" in plan && plan.featured ? "primary" : "ghost"}
              className="w-full"
              disabled={user?.plan === plan.id}
              onClick={() => upgrade(plan.id)}
            >
              {user?.plan === plan.id ? "Current Plan" : plan.id === "free" ? "Get Started" : `Get ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
