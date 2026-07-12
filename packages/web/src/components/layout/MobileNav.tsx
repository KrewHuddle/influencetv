"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Play, GraduationCap, User } from "lucide-react";

// Bottom bar surfaces the pillars most useful on mobile. Shop/Community live
// in the header + hamburger; the cart is in the header.
const items = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/live", label: "Live", Icon: Radio },
  { href: "/browse", label: "Watch", Icon: Play },
  { href: "/training", label: "Learn", Icon: GraduationCap },
  { href: "/account", label: "You", Icon: User },
];

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-header flex h-14 items-center justify-around border-t border-itv-border bg-itv-bg/95 backdrop-blur md:hidden">
      {items.map(({ href, label, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.5px] transition-colors ${
              active ? "text-itv-accent" : "text-itv-faint hover:text-itv-muted"
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
