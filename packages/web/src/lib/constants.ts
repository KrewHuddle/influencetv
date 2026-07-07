// Empty default = same-origin: browser calls /api/... on the current host.
// In prod the web app and API share an origin (influencetvnetwork.com), so no
// hardcoded host is needed. For local dev, set NEXT_PUBLIC_API_URL in .env.local
// (e.g. http://localhost:3000). See .env.example.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "";
export const CDN_URL =
  process.env.NEXT_PUBLIC_CLOUDFRONT_URL ?? "https://cdn.influencetvnetwork.com";

// Primary pillars for the unified network. Home = wordmark.
export const NAV_LINKS = [
  { href: "/browse", label: "Watch" },
  { href: "/live", label: "Live" },
  { href: "/training", label: "Learn" },
  { href: "/shop", label: "Shop" },
  { href: "/community", label: "Community" },
] as const;

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    features: [
      { label: "6 live channels", included: true },
      { label: "720p streaming", included: true },
      { label: "Ad-supported", included: true },
      { label: "1 device", included: true },
      { label: "Shop access", included: false },
      { label: "4K & creator tools", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 14.99,
    period: "/mo",
    featured: true,
    features: [
      { label: "All channels", included: true },
      { label: "1080p, no ads", included: true },
      { label: "3 devices", included: true },
      { label: "Shop access", included: true },
      { label: "Community posting", included: true },
      { label: "4K & creator access", included: false },
    ],
  },
  {
    id: "ultra",
    name: "Ultra",
    price: 24.99,
    period: "/mo",
    features: [
      { label: "Everything in Premium", included: true },
      { label: "4K HDR", included: true },
      { label: "6 devices", included: true },
      { label: "Creator access", included: true },
      { label: "Watch parties", included: true },
      { label: "Patron support", included: true },
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
