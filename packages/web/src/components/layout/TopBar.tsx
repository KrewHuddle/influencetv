"use client";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { AccountMenu } from "./AccountMenu";

// Mobile/tablet top bar (<lg). Nav lives in MobileNav (bottom); this carries
// brand + search + cart + account. No hamburger.
export function TopBar() {
  const cartCount = useCartStore((s) =>
    s.items.reduce((n, i) => n + i.quantity, 0)
  );
  const openCart = useCartStore((s) => s.toggle);

  return (
    <header className="sticky top-0 z-header flex h-[var(--topbar-h)] items-center border-b border-itv-border bg-itv-bg/90 px-4 backdrop-blur lg:hidden">
      <Link
        href="/"
        className="shrink-0 font-display text-[15px] font-extrabold uppercase tracking-[2px]"
      >
        INFLUENCE<span className="text-itv-accent">TV</span>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/search"
          aria-label="Search"
          className="grid h-11 w-11 place-items-center text-itv-muted transition-colors hover:text-itv-text"
        >
          <Search size={18} />
        </Link>
        <button
          onClick={() => openCart(true)}
          aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
          className="relative grid h-11 w-11 place-items-center text-itv-muted transition-colors hover:text-itv-text"
        >
          <ShoppingBag size={18} />
          {cartCount > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-itv-accent px-1 font-mono text-[10px] font-bold leading-none text-itv-bg">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}
