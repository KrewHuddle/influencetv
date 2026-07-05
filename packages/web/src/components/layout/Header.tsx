"use client";
import Link from "next/link";
import { Bell, Search, ShoppingCart } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { NAV_LINKS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";

export function Header() {
  const { user, logout } = useAuth();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const isFree = !user || user.plan === "free";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-apex bg-apex-black/90 px-6 backdrop-blur">
      <div className="flex items-center gap-8">
        <Link href="/" className="font-display text-xl tracking-wider text-apex-white">
          INFLUENCE TV
        </Link>
        <nav className="hidden gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-[color:var(--text-secondary)] hover:text-apex-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/browse" aria-label="Search" className="text-[color:var(--text-secondary)] hover:text-apex-white">
          <Search size={18} />
        </Link>
        <button aria-label="Notifications" className="relative text-[color:var(--text-secondary)] hover:text-apex-white">
          <Bell size={18} />
        </button>
        <Link href="/shop/checkout" aria-label="Cart" className="relative text-[color:var(--text-secondary)] hover:text-apex-white">
          <ShoppingCart size={18} />
          {cartCount > 0 && (
            <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-apex-red text-[10px] text-white">
              {cartCount}
            </span>
          )}
        </Link>

        {isFree && (
          <Link href="/plans">
            <Button className="px-3 py-1.5 text-xs">Upgrade</Button>
          </Link>
        )}

        {user ? (
          <Dropdown.Root>
            <Dropdown.Trigger
              aria-label="Account menu"
              className="grid h-8 w-8 place-items-center rounded-full bg-apex-gray-800 text-sm"
            >
              {(user.displayName ?? user.email)[0]?.toUpperCase()}
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                align="end"
                sideOffset={8}
                className="z-50 w-44 rounded-md border border-apex bg-apex-gray-900 p-1 text-sm"
              >
                {[
                  { href: "/account", label: "Profile" },
                  { href: "/browse", label: "My List" },
                  { href: "/account/settings", label: "Settings" },
                  { href: "/studio", label: "Creator Studio" },
                ].map((i) => (
                  <Dropdown.Item key={i.href} asChild>
                    <Link
                      href={i.href}
                      className="block rounded px-3 py-2 outline-none hover:bg-white/[0.08]"
                    >
                      {i.label}
                    </Link>
                  </Dropdown.Item>
                ))}
                <Dropdown.Item
                  onSelect={() => void logout()}
                  className="cursor-pointer rounded px-3 py-2 text-apex-red outline-none hover:bg-white/[0.08]"
                >
                  Logout
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        ) : (
          <Link href="/login">
            <Button variant="ghost" className="px-3 py-1.5 text-xs">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
