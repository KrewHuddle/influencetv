"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Play,
  Radio,
  GraduationCap,
  ShoppingBag,
  BadgePercent,
  Users,
  Search,
} from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/store/cartStore";
import { AccountMenu } from "./AccountMenu";

// Desktop-only fixed left rail: the single navigation surface (search, nav,
// cart, upgrade, account all live here — no desktop top bar).
const NAV_ICONS: Record<string, typeof Home> = {
  "/browse": Play,
  "/live": Radio,
  "/training": GraduationCap,
  "/shop": ShoppingBag,
  "/haggle": BadgePercent,
  "/community": Users,
};

export function Sidebar() {
  const { user } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const cartCount = useCartStore((s) =>
    s.items.reduce((n, i) => n + i.quantity, 0)
  );
  const openCart = useCartStore((s) => s.toggle);
  const isFree = !user || user.plan === "free";

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setQuery("");
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-header hidden w-[var(--sidebar-w)] flex-col border-r border-itv-border bg-itv-surface lg:flex">
      {/* wordmark */}
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center px-5 font-display text-[15px] font-extrabold uppercase tracking-[2px]"
      >
        INFLUENCE<span className="text-itv-accent">TV</span>
      </Link>

      {/* search */}
      <form onSubmit={submitSearch} className="px-3 pb-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-itv-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            className="w-full rounded-md bg-itv-surface2 py-2 pl-9 pr-3 text-[13px] text-itv-text outline-none placeholder:text-itv-faint focus:ring-1 focus:ring-itv-accent"
          />
        </div>
      </form>

      {/* pillar nav */}
      <nav className="flex flex-col gap-0.5 px-3" aria-label="Primary">
        {[{ href: "/", label: "Home" }, ...NAV_LINKS].map((l) => {
          const active = isActive(l.href);
          const Icon = NAV_ICONS[l.href] ?? Home;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-itv-hover text-itv-text"
                  : "text-itv-muted hover:bg-itv-hover hover:text-itv-text"
              }`}
            >
              {active && (
                <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-itv-accent" />
              )}
              <Icon size={17} className={active ? "text-itv-accent" : undefined} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* bottom cluster */}
      <div className="mt-auto flex flex-col gap-1 border-t border-itv-border2 p-3">
        {isFree && (
          <Link
            href="/plans"
            className="mb-1 block rounded-md bg-itv-accent px-3 py-2 text-center text-[13px] font-semibold text-itv-bg transition-[background-color,box-shadow] hover:bg-itv-accent-strong hover:shadow-glow-accent"
          >
            Go Ultra
          </Link>
        )}
        <button
          onClick={() => openCart(true)}
          aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-semibold text-itv-muted transition-colors hover:bg-itv-hover hover:text-itv-text"
        >
          <ShoppingBag size={17} />
          Cart
          {cartCount > 0 && (
            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-itv-accent px-1.5 font-mono text-[10px] font-bold leading-none text-itv-bg">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </button>
        <AccountMenu variant="row" />
      </div>
    </aside>
  );
}
