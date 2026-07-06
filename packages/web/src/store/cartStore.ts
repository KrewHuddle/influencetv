import { create } from "zustand";
import { api, apiGet } from "@/lib/api";

export interface CartItem {
  productId: string;
  variantId?: string;
  title: string;
  priceCents: number;
  quantity: number;
  thumbnail?: string | null;
}

// Fire-and-forget server mirror. Requests without a valid token 401 and are
// ignored, so guest carts stay purely local until sign-in.
const mirror = {
  add: (productId: string, quantity: number) => void api.post("/api/cart/items", { productId, quantity }).catch(() => {}),
  remove: (productId: string) => void api.delete(`/api/cart/items/${productId}`).catch(() => {}),
  setQty: (productId: string, quantity: number) => void api.patch(`/api/cart/items/${productId}`, { quantity }).catch(() => {}),
  clear: () => void api.delete("/api/cart").catch(() => {}),
};

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  add: (item: CartItem) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  toggle: (open?: boolean) => void;
  subtotalCents: () => number;
  hydrate: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  add: (item) => {
    mirror.add(item.productId, item.quantity);
    set((s) => {
      const existing = s.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          ),
          isOpen: true,
        };
      }
      return { items: [...s.items, item], isOpen: true };
    });
  },
  remove: (productId) => {
    mirror.remove(productId);
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) }));
  },
  setQuantity: (productId, quantity) => {
    mirror.setQty(productId, Math.max(1, quantity));
    set((s) => ({
      items: s.items.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i
      ),
    }));
  },
  clear: () => {
    mirror.clear();
    set({ items: [] });
  },
  toggle: (open) => set((s) => ({ isOpen: open ?? !s.isOpen })),
  subtotalCents: () =>
    get().items.reduce((n, i) => n + i.priceCents * i.quantity, 0),
  hydrate: () => {
    void apiGet<{ items: CartItem[] }>("/api/cart")
      .then((r) => set({ items: r.items ?? [] }))
      .catch(() => {});
  },
}));
