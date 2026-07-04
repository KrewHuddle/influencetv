"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";

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
            duration={4000}
            onOpenChange={(open) =>
              !open && setItems((p) => p.filter((x) => x.id !== t.id))
            }
            className="rounded-md border border-apex bg-apex-gray-900 p-4 shadow-xl data-[state=open]:animate-in"
          >
            <ToastPrimitive.Title
              className={
                t.variant === "error"
                  ? "text-sm font-medium text-apex-red"
                  : "text-sm font-medium text-apex-white"
              }
            >
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="mt-1 text-xs text-[color:var(--text-secondary)]">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex w-96 max-w-[100vw] flex-col gap-2 p-4" />
      </ToastPrimitive.Provider>
    </Ctx.Provider>
  );
}
