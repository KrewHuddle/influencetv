"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";

const SECTIONS = [
  { label: "Network", items: [{ href: "/admin", label: "Overview" }] },
  {
    label: "Content",
    items: [
      { href: "/admin/content", label: "Content Library" },
      { href: "/admin/dmca", label: "DMCA" },
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
  if (!user || user.role !== "super_admin")
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-apex-red">
        Admin access required.
      </div>
    );

  return (
    <div className="flex">
      <aside className="hidden w-56 shrink-0 border-r border-apex bg-apex-gray-900 p-4 md:block">
        <p className="mb-4 flex items-center gap-2 px-2 font-display text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-apex-red" /> INFLUENCE TV ADMIN
        </p>
        {SECTIONS.map((s) => (
          <div key={s.label} className="mb-4">
            <p className="mb-1 px-2 text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">
              {s.label}
            </p>
            {s.items.map((i) => {
              const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`block rounded px-2 py-1.5 text-sm ${
                    active ? "bg-white/[0.08] text-apex-white" : "text-[color:var(--text-secondary)] hover:text-apex-white"
                  }`}
                >
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
