"use client";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-apex bg-apex-gray-900 p-6 shadow-2xl focus:outline-none",
            className
          )}
        >
          {title && (
            <Dialog.Title className="mb-4 font-display text-lg">
              {title}
            </Dialog.Title>
          )}
          <Dialog.Close
            aria-label="Close"
            className="absolute right-4 top-4 text-[color:var(--text-muted)] hover:text-apex-white"
          >
            <X size={18} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
