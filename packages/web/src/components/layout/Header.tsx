"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Menu, X, ShoppingBag } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { NAV_LINKS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/store/cartStore";
import { Avatar } from "@/components/ui/Avatar";
import { CartDrawer } from "@/components/shop/CartDrawer";

export function Header() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const cartCount = useCartStore((s) =>
    s.items.reduce((n, i) => n + i.quantity, 0)
  );
  const openCart = useCartStore((s) => s.toggle);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isFree = !user || user.plan === "free";

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  // Lock body scroll while the full-screen mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    setMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-header h-[var(--header-h)] border-b border-itv-border bg-itv-bg/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1400px] items-center px-4">
        {/* wordmark */}
        <Link
          href="/"
          className="shrink-0 font-display text-[15px] font-extrabold uppercase tracking-[2px]"
        >
          INFLUENCE<span className="text-itv-magenta">TV</span>
        </Link>

        {/* pillar nav (desktop) */}
        <nav className="ml-8 hidden h-full flex-1 items-stretch gap-7 md:flex">
          {NAV_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.label}
                href={l.href}
                className={`flex items-center whitespace-nowrap border-b-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? "border-itv-magenta text-itv-text"
                    : "border-transparent text-itv-muted hover:text-itv-text"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* right cluster */}
        <div className="ml-auto flex items-center gap-3">
          {/* search */}
          {searchOpen ? (
            <form onSubmit={submitSearch} className="flex items-center">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => !query && setSearchOpen(false)}
                placeholder="Search shows, creators…"
                aria-label="Search"
                className="w-40 rounded-md bg-itv-surface2 px-3 py-1.5 text-[13px] text-itv-text outline-none placeholder:text-itv-faint focus:ring-1 focus:ring-itv-magenta sm:w-56"
              />
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              className="-m-1 grid h-11 w-11 place-items-center text-itv-muted transition-colors hover:text-itv-text"
            >
              <Search size={18} />
            </button>
          )}

          {/* cart */}
          <button
            onClick={() => openCart(true)}
            aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
            className="relative -m-1 grid h-11 w-11 place-items-center text-itv-muted transition-colors hover:text-itv-text"
          >
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-itv-magenta px-1 font-mono text-[10px] font-bold leading-none text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>

          {isFree && (
            <Link
              href="/plans"
              className="hidden whitespace-nowrap rounded-sm bg-itv-magenta px-3 py-1.5 text-xs font-medium text-white transition-[background-color,box-shadow] duration-[--dur-fast] hover:bg-itv-magenta-strong hover:shadow-glow-magenta sm:block"
            >
              Go Ultra
            </Link>
          )}

          {user ? (
            <Dropdown.Root>
              <Dropdown.Trigger aria-label="Account menu" className="outline-none">
                <Avatar
                  name={user.displayName ?? user.email}
                  size="sm"
                  ring="magenta"
                />
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  align="end"
                  sideOffset={8}
                  className="z-overlay w-44 rounded-lg border border-itv-border bg-itv-surface p-1 text-sm shadow-card"
                >
                  {[
                    ...(["super_admin", "channel_manager", "moderator"].includes(
                      user.role
                    )
                      ? [{ href: "/admin", label: "Admin Dashboard" }]
                      : []),
                    { href: "/account", label: "Profile" },
                    { href: "/browse", label: "My List" },
                    { href: "/account/settings", label: "Settings" },
                    { href: "/studio", label: "Creator Studio" },
                  ].map((i) => (
                    <Dropdown.Item key={i.href} asChild>
                      <Link
                        href={i.href}
                        className="block rounded px-3 py-2 text-itv-text outline-none hover:bg-itv-hover"
                      >
                        {i.label}
                      </Link>
                    </Dropdown.Item>
                  ))}
                  <Dropdown.Item
                    onSelect={() => void logout()}
                    className="cursor-pointer rounded px-3 py-2 text-itv-magenta outline-none hover:bg-itv-hover"
                  >
                    Logout
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          ) : (
            <Link
              href="/login"
              className="text-[13px] font-semibold text-itv-muted transition-colors hover:text-itv-text"
            >
              Sign In
            </Link>
          )}

          {/* hamburger (mobile) */}
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="-m-1 grid h-11 w-11 place-items-center text-itv-muted md:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* mobile menu — opaque full-screen overlay */}
      {menuOpen && (
        <nav className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-overlay flex flex-col gap-1 bg-itv-bg px-4 py-4 md:hidden">
          <form onSubmit={submitSearch} className="mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shows, creators…"
              aria-label="Search"
              className="w-full rounded-md bg-itv-surface2 px-3 py-2 text-sm text-itv-text outline-none placeholder:text-itv-faint focus:ring-1 focus:ring-itv-magenta"
            />
          </form>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`py-2 text-[15px] font-semibold ${
                isActive(l.href) ? "text-itv-magenta" : "text-itv-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {isFree && (
            <Link
              href="/plans"
              onClick={() => setMenuOpen(false)}
              className="mt-3 block whitespace-nowrap rounded-md bg-itv-magenta px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-itv-magenta-strong"
            >
              Go Ultra
            </Link>
          )}
        </nav>
      )}

      <CartDrawer />
    </header>
  );
}
