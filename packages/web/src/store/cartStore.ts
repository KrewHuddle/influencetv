import { create } from "zustand";

export interface CartItem {
  productId: string;
  variantId?: string;
  title: string;
  priceCents: number;
  quantity: number;
  thumbnail?: string | null;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  add: (item: CartItem) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  toggle: (open?: boolean) => void;
  subtotalCents: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  add: (item) =>
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
    }),
  remove: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
  setQuantity: (productId, quantity) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i
      ),
    })),
  clear: () => set({ items: [] }),
  toggle: (open) => set((s) => ({ isOpen: open ?? !s.isOpen })),
  subtotalCents: () =>
    get().items.reduce((n, i) => n + i.priceCents * i.quantity, 0),
}));
