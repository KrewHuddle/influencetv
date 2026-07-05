import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export const metadata: Metadata = {
  title: "Influence TV Network",
  description: "Live TV, VOD, creators, and live shopping.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-itv-bg text-itv-text antialiased">
        <Providers>
          <Header />
          <main className="min-h-[calc(100vh-52px)] pb-20 md:pb-0">
            {children}
          </main>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
