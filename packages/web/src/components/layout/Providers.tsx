"use client";
import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { bootstrapAuth } from "@/hooks/useAuth";

/** App-wide client providers: toast + one-shot session restore. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void bootstrapAuth();
  }, []);
  return <ToastProvider>{children}</ToastProvider>;
}
