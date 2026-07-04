export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000";
export const CDN_URL =
  process.env.NEXT_PUBLIC_CLOUDFRONT_URL ?? "https://cdn.apex.tv";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live TV" },
  { href: "/browse", label: "Browse" },
  { href: "/community", label: "Community" },
  { href: "/shop", label: "Shop" },
] as const;

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    accent: "border-apex-gray-700",
    features: [
      { label: "SD + limited HD", included: true },
      { label: "Ad-supported", included: true },
      { label: "1 device", included: true },
      { label: "Community chat", included: false },
      { label: "4K / patron content", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 14.99,
    accent: "border-white/40",
    features: [
      { label: "1080p", included: true },
      { label: "Ad-free channels", included: true },
      { label: "3 devices", included: true },
      { label: "Community chat", included: true },
      { label: "4K", included: false },
    ],
  },
  {
    id: "ultra",
    name: "Ultra",
    price: 24.99,
    accent: "border-apex-red",
    featured: true,
    features: [
      { label: "4K HDR", included: true },
      { label: "Ad-free everything", included: true },
      { label: "6 devices", included: true },
      { label: "Community chat", included: true },
      { label: "Creator tools", included: true },
    ],
  },
] as const;

export function formatDuration(seconds?: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatCount(n?: number | null): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
