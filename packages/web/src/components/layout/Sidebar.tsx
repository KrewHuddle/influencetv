import Link from "next/link";
import { NAV_LINKS } from "@/lib/constants";

/** Desktop left rail. Channel list is wired once a public channels endpoint lands. */
export function Sidebar() {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-apex p-4 lg:block">
      <nav className="space-y-1">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded px-3 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-white/[0.06] hover:text-apex-white"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-6 px-3 text-[11px] uppercase tracking-wide text-[color:var(--text-muted)]">
        Channels
      </p>
      <p className="px-3 py-2 text-xs text-[color:var(--text-muted)]">
        Live channels appear here.
      </p>
    </aside>
  );
}
