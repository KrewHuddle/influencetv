"use client";
import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { bootstrapAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/store/cartStore";
import { initSentry } from "@/lib/sentry";

/** App-wide client providers: toast + one-shot session restore + cart hydrate. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    initSentry();
    void bootstrapAuth().then(() => useCartStore.getState().hydrate());
  }, []);
  return <ToastProvider>{children}</ToastProvider>;
}
