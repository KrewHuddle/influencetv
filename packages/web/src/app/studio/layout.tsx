"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/studio", label: "Dashboard" },
  { href: "/studio/upload", label: "Upload" },
  { href: "/studio/shop/live", label: "Live Shop" },
  { href: "/studio/haggle", label: "Haggle" },
  { href: "/studio/community", label: "Community" },
  { href: "/studio/patrons", label: "Patrons" },
  { href: "/studio/analytics", label: "Analytics" },
  { href: "/studio/earnings", label: "Earnings" },
];

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="flex">
      <aside className="hidden w-52 shrink-0 border-r border-itv-border p-4 md:block">
        <p className="mb-4 px-2 font-display text-sm">Creator Studio</p>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = n.href === "/studio" ? path === "/studio" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block rounded px-3 py-2 text-sm ${
                  active ? "bg-white/[0.08] text-itv-text" : "text-itv-muted hover:text-itv-text"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
