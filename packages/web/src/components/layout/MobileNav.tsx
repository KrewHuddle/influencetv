"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Search, ShoppingBag, User } from "lucide-react";

const items = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/live", label: "Live", Icon: Radio },
  { href: "/browse", label: "Browse", Icon: Search },
  { href: "/shop", label: "Shop", Icon: ShoppingBag },
  { href: "/account", label: "You", Icon: User },
];

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-itv-border bg-itv-bg md:hidden">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.5px] ${
              active ? "text-itv-magenta" : "text-white/[0.55]"
            }`}
          >
            <Icon size={19} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
