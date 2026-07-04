"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tv, Grid3x3, ShoppingBag, User } from "lucide-react";

const items = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/live", label: "Live", Icon: Tv },
  { href: "/browse", label: "Browse", Icon: Grid3x3 },
  { href: "/shop", label: "Shop", Icon: ShoppingBag },
  { href: "/account", label: "Account", Icon: User },
];

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-apex bg-apex-black/95 backdrop-blur md:hidden">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 text-[10px] ${
              active ? "text-apex-red" : "text-[color:var(--text-muted)]"
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
