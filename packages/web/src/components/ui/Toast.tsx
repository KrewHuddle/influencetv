"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";

interface ToastMsg {
  id: number;
  title: string;
  description?: string;
  variant?: "default" | "error";
}

interface ToastCtx {
  toast: (t: Omit<ToastMsg, "id">) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => undefined });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);

  const toast = (t: Omit<ToastMsg, "id">) =>
    setItems((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);

  return (
    <Ctx.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            type={t.variant === "error" ? "foreground" : "background"}
            duration={4000}
            onOpenChange={(open) =>
              !open && setItems((p) => p.filter((x) => x.id !== t.id))
            }
            className="relative rounded-lg border border-itv-border bg-itv-surface2 p-4 pr-8 shadow-card data-[state=open]:animate-rise"
          >
            <ToastPrimitive.Title
              className={
                t.variant === "error"
                  ? "text-sm font-medium text-itv-live"
                  : "text-sm font-medium text-itv-text"
              }
            >
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="mt-1 text-xs text-itv-muted">
                {t.description}
              </ToastPrimitive.Description>
            )}
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="absolute right-2 top-2 text-itv-faint transition-colors hover:text-itv-text"
            >
              <X size={14} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-16 right-0 z-[100] flex w-96 max-w-full flex-col gap-2 p-4 md:bottom-0" />
      </ToastPrimitive.Provider>
    </Ctx.Provider>
  );
}
