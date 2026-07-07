import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

// Broadcast Bloom type system: characterful display + clean body + mono for
// timecodes / prices / countdowns.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-itv-bg text-itv-text antialiased">
        <Providers>
          <Header />
          <main className="min-h-[calc(100vh-56px)] pb-20 md:pb-0">
            {children}
          </main>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
