import type { Metadata } from "next";
import { Syne, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Apex — Streaming Network",
  description: "Live TV, VOD, creators, and live shopping.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-apex-black text-apex-white antialiased">
        <Providers>
          <Header />
          <div className="flex">
            <Sidebar />
            <main className="min-h-[calc(100vh-4rem)] flex-1 pb-20 md:pb-0">
              {children}
            </main>
          </div>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
