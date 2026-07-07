"use client";
import { PLANS } from "@/lib/constants";
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
    <div className="bg-itv-bg px-5 py-12">
      <h1 className="mb-2 text-center text-[26px] font-black tracking-[-0.5px]">Pick your plan</h1>
      <p className="mb-10 text-center text-[12px] text-white/[0.42]">
        Start free. Upgrade when the network makes you want more.
      </p>

      <div className="mx-auto grid max-w-4xl gap-px bg-itv-border md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = "featured" in plan && plan.featured;
          const current = user?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className="border border-itv-border px-6 py-7"
              style={
                featured
                  ? { borderTop: "2px solid var(--itv-magenta)", background: "var(--itv-surface)" }
                  : { background: "var(--itv-bg)" }
              }
            >
              <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-white/[0.45]">
                {plan.name}
              </p>
              <p className="mt-3">
                <span className="text-[36px] font-black tracking-[-1px]">${plan.price}</span>
                <span className="ml-1 text-[10px] text-white/[0.38]">
                  {"period" in plan ? plan.period : "/mo"}
                </span>
              </p>

              <div className="my-4 h-px bg-white/[0.06]" />

              <ul className="flex flex-col gap-2 text-[11px] text-white/60">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2">
                    <span className={f.included ? "text-itv-magenta" : "text-white/20"}>
                      {f.included ? "✓" : "×"}
                    </span>
                    <span className={f.included ? "" : "text-white/[0.35]"}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => upgrade(plan.id)}
                disabled={current}
                className="mt-6 w-full px-4 py-[11px] text-[10px] font-extrabold uppercase tracking-[1px] transition disabled:opacity-40"
                style={
                  featured
                    ? { background: "var(--itv-magenta)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }
                }
              >
                {current ? "Current Plan" : plan.id === "free" ? "Get Started" : `Get ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
