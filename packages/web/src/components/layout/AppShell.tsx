"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { CartDrawer } from "@/components/shop/CartDrawer";

// Global chrome. Admin + Studio render bare — both route groups mount their
// own left asides, and the global sidebar would double-rail them.
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const bare = path.startsWith("/admin") || path.startsWith("/studio");

  if (bare) {
    return (
      <>
        <main id="content" className="min-h-screen">
          {children}
        </main>
        <CartDrawer />
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <TopBar />
      <main
        id="content"
        className="min-h-[calc(100vh-var(--topbar-h))] pb-20 lg:min-h-screen lg:pb-0 lg:pl-[var(--sidebar-w)]"
      >
        {children}
      </main>
      <MobileNav />
      <CartDrawer />
    </>
  );
}
