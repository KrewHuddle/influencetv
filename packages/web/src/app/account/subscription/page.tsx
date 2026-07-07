"use client";
import useSWR from "swr";
import { apiPost, swrFetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface SubStatus {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export default function SubscriptionPage() {
  const { data } = useSWR<SubStatus>("/api/subscriptions/status", swrFetcher, {
    shouldRetryOnError: false,
  });

  const openPortal = async () => {
    try {
      const { portalUrl } = await apiPost<{ portalUrl: string }>(
        "/api/subscriptions/portal"
      );
      window.location.href = portalUrl;
    } catch {
      /* portal unavailable */
    }
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl">Subscription</h1>
      <div className="rounded-lg border border-itv-border bg-itv-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-itv-muted">Plan</span>
          <Badge>{data?.plan ?? "free"}</Badge>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-itv-muted">Status</span>
          <span className="text-sm">{data?.status ?? "—"}</span>
        </div>
        {data?.currentPeriodEnd && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-itv-muted">
              {data.cancelAtPeriodEnd ? "Ends" : "Renews"}
            </span>
            <span className="text-sm">
              {new Date(data.currentPeriodEnd).toLocaleDateString()}
            </span>
          </div>
        )}
        <Button className="mt-6 w-full" onClick={openPortal}>
          Manage Billing
        </Button>
      </div>
    </div>
  );
}
