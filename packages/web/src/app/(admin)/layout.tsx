"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";

const SECTIONS = [
  {
    label: "Network",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/audit", label: "Audit Log" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/content", label: "Content Library" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/dmca", label: "DMCA" },
    ],
  },
  {
    label: "Broadcast",
    items: [
      { href: "/admin/playout", label: "Playout" },
      { href: "/admin/channels", label: "Channels" },
      { href: "/admin/schedule", label: "Programming" },
    ],
  },
  { label: "Audience", items: [{ href: "/admin/users", label: "Users" }] },
  {
    label: "Money",
    items: [
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/ads", label: "Ad Ops" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const path = usePathname();

  if (isLoading)
    return <div className="grid min-h-[60vh] place-items-center"><Spinner /></div>;
  const STAFF = ["moderator", "channel_manager", "super_admin"];
  if (!user || !STAFF.includes(user.role))
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-itv-accent">
        Admin access required.
      </div>
    );

  const isActive = (href: string) =>
    href === "/admin" ? path === "/admin" : path.startsWith(href);

  return (
    <div>
      {/* mobile nav */}
      <nav className="md:hidden flex gap-2 overflow-x-auto border-b border-itv-border px-4 py-2">
        {SECTIONS.flatMap((s) => s.items).map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${
              isActive(i.href)
                ? "bg-itv-surface2 text-itv-text"
                : "text-itv-muted hover:text-itv-text"
            }`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-itv-border bg-itv-surface p-4 md:block">
          <p className="mb-4 flex items-center gap-2 px-2 font-display text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-itv-accent" /> INFLUENCE TV ADMIN
          </p>
          {SECTIONS.map((s) => (
            <div key={s.label} className="mb-4">
              <p className="mb-1 px-2 text-[10px] uppercase tracking-wider text-itv-muted">
                {s.label}
              </p>
              {s.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`block rounded px-2 py-1.5 text-sm ${
                    isActive(i.href) ? "bg-itv-surface2 text-itv-text" : "text-itv-muted hover:text-itv-text"
                  }`}
                >
                  {i.label}
                </Link>
              ))}
            </div>
          ))}
        </aside>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
