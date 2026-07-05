"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, X } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { NAV_LINKS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isFree = !user || user.plan === "free";
  const initial = (user?.displayName ?? user?.email ?? "?")[0]?.toUpperCase();

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <header className="sticky top-0 z-40 h-[52px] border-b border-itv-border bg-itv-bg">
      <div className="mx-auto flex h-full max-w-[1400px] items-center px-4">
        {/* wordmark */}
        <Link
          href="/"
          className="shrink-0 text-[13px] font-black uppercase tracking-[3px]"
        >
          INFLUENCE<span className="text-itv-magenta">TV</span>
        </Link>

        {/* center nav tabs (desktop) */}
        <nav className="ml-8 hidden h-full flex-1 items-stretch gap-6 md:flex">
          {NAV_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.label}
                href={l.href}
                className={`flex items-center border-b-2 text-[12px] font-semibold transition-colors ${
                  active
                    ? "border-itv-magenta text-itv-white"
                    : "border-transparent text-white/45 hover:text-white/80"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* right cluster */}
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Link
            href="/browse"
            aria-label="Search"
            className="text-white/60 hover:text-itv-white"
          >
            <Search size={17} />
          </Link>

          {isFree && (
            <Link
              href="/plans"
              className="rounded-[2px] bg-itv-magenta px-3 py-[5px] text-[11px] font-bold text-white hover:brightness-110"
            >
              Go Ultra
            </Link>
          )}

          {user ? (
            <Dropdown.Root>
              <Dropdown.Trigger
                aria-label="Account menu"
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-itv-magenta bg-itv-surface2 text-[11px] font-bold"
              >
                {initial}
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 w-44 rounded-[4px] border border-itv-border bg-itv-surface p-1 text-sm"
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
                        className="block rounded-[3px] px-3 py-2 outline-none hover:bg-white/[0.08]"
                      >
                        {i.label}
                      </Link>
                    </Dropdown.Item>
                  ))}
                  <Dropdown.Item
                    onSelect={() => void logout()}
                    className="cursor-pointer rounded-[3px] px-3 py-2 text-itv-magenta outline-none hover:bg-white/[0.08]"
                  >
                    Logout
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          ) : (
            <Link
              href="/login"
              className="text-[12px] font-semibold text-white/70 hover:text-itv-white"
            >
              Sign In
            </Link>
          )}

          {/* hamburger (mobile) */}
          <button
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-white/70 md:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* mobile dropdown menu */}
      {menuOpen && (
        <nav className="border-t border-itv-border bg-itv-bg px-4 py-2 md:hidden">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`block py-2 text-[13px] font-semibold ${
                isActive(l.href) ? "text-itv-magenta" : "text-white/60"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
