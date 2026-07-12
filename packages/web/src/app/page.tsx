"use client";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { LiveHero } from "@/components/home/LiveHero";
import { Rail } from "@/components/ui/Rail";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatDuration } from "@/lib/constants";

/* ------------------------------------------------------------------ types */
interface ChannelSummary {
  id: string;
  name: string;
  slug: string;
  status?: string;
  number?: number | null;
  current_show?: string | null;
  viewer_count?: number | null;
  thumbnail_url?: string | null;
  live_shop_active?: boolean;
}
interface VideoSummary {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  creator_name?: string | null;
  creator_username?: string | null;
  duration_seconds?: number | null;
  view_count?: number | null;
  is_patron?: boolean;
}
interface CreatorSummary {
  username: string;
  name: string;
  tagline: string;
  live?: boolean;
  patron?: boolean;
}

/* ------------------------------------------------------------------ mock fallbacks (endpoints not yet wired) */
const MOCK_LIVE: ChannelSummary[] = [
  { id: "m1", name: "Influence Drama", slug: "drama", number: 4, current_show: "The Last Broadcast", viewer_count: 12480, live_shop_active: true },
  { id: "m2", name: "Influence News", slug: "news", number: 7, current_show: "Evening Desk", viewer_count: 6120 },
  { id: "m3", name: "Influence Ent.", slug: "ent", number: 11, current_show: "Late Set", viewer_count: 3940 },
  { id: "m4", name: "Culture 24", slug: "culture", number: 2, current_show: "Open Mic", viewer_count: 2210 },
  { id: "m5", name: "The Blend", slug: "blend", number: 19, current_show: "Morning Blend", viewer_count: 1180 },
];

const MOCK_ONDEMAND: VideoSummary[] = [
  "Backstage: Making the Finale",
  "Live Shopping Recap",
  "Neighborhood Heroes",
  "Sound & Vision",
  "The Blend: Morning Set",
  "Creators Roundtable",
  "Midnight Cypher",
  "Studio Sessions: Nova",
].map((t, i) => ({
  id: `${t}-${i}`.replace(/[^a-z0-9]+/gi, "").slice(0, 28).toLowerCase(),
  title: t,
  creator_name: ["Ava Reyes", "Influence TV", "Jhene B", "Nova King", "The Blend", "Influence TV", "Mars", "Nova King"][i],
  duration_seconds: 240 + i * 173 + t.length * 7,
  view_count: 8200 + i * 7400 + t.length * 311,
  is_patron: i % 4 === 0,
}));

const MOCK_CREATORS: CreatorSummary[] = [
  // First two are real seeded creators — their hubs show live data.
  { username: "novafields", name: "Nova Fields", tagline: "Drama · Live TV · Shop", live: true, patron: true },
  { username: "rexmarlow", name: "Rex Marlow", tagline: "News · Talk", patron: true },
  { username: "marsonair", name: "Mars", tagline: "Late-night · Cypher", live: true },
  { username: "theblend", name: "The Blend", tagline: "Morning show", patron: true },
  { username: "dcole", name: "D. Cole", tagline: "Docuseries" },
  { username: "jheneb", name: "Jhene B", tagline: "Lifestyle · Shop" },
];

/* ------------------------------------------------------------------ format */
const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

/* ------------------------------------------------------------------ demo label for mock-backed sections */
function SectionTitle({ children, demo }: { children: React.ReactNode; demo?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      {demo && <Badge tone="warn">Demo</Badge>}
    </span>
  );
}

/* ------------------------------------------------------------------ live channel card */
function LiveCard({ c }: { c: ChannelSummary }) {
  return (
    <Link href={`/live/${c.slug}`} className="w-[260px] shrink-0 snap-start">
      <Card interactive className="overflow-hidden">
        <div className="relative aspect-video bg-itv-surface3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.thumbnail_url || "/placeholder.svg"}
            alt={c.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Badge tone="live">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
              Live
            </Badge>
            {c.live_shop_active && <Badge tone="accent">Shop</Badge>}
          </div>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-semibold text-itv-text">
            {c.current_show ?? c.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-itv-muted">
            CH {c.number ?? "—"} · {c.name}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-itv-faint">
            {kfmt(c.viewer_count)} watching
          </p>
        </div>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ on-demand rail card */
function VodCard({ v, href }: { v: VideoSummary; href?: string }) {
  return (
    <Link href={href ?? `/watch/${v.id}`} className="w-[220px] shrink-0 snap-start">
      <Card interactive className="overflow-hidden">
        <div className="relative aspect-video bg-itv-surface3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={v.thumbnail_url || "/placeholder.svg"}
            alt={v.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {v.is_patron && (
            <span className="absolute right-2 top-2">
              <Badge tone="gold">Patron</Badge>
            </span>
          )}
          {v.duration_seconds ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-itv-text">
              {formatDuration(v.duration_seconds)}
            </span>
          ) : null}
        </div>
        <div className="p-3">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-itv-text">
            {v.title}
          </p>
          <p className="mt-1 truncate text-xs text-itv-muted">
            {v.creator_name ?? "Influence TV"} · {kfmt(v.view_count)} views
          </p>
        </div>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ creator channel card */
function CreatorCard({ c }: { c: CreatorSummary }) {
  return (
    <Link href={`/creator/${c.username}`} className="w-[180px] shrink-0 snap-start">
      <Card interactive className="flex flex-col items-center p-4 text-center">
        <Avatar
          name={c.name}
          size="lg"
          ring={c.live ? "live" : c.patron ? "gold" : "accent"}
        />
        <p className="mt-3 truncate text-sm font-semibold text-itv-text">{c.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-itv-muted">{c.tagline}</p>
        <div className="mt-2 flex gap-1">
          {c.live && <Badge tone="live">Live</Badge>}
          {c.patron && <Badge tone="gold">Patron</Badge>}
        </div>
        <span className="mt-3 text-xs font-medium text-itv-accent">View Hub →</span>
      </Card>
    </Link>
  );
}

/* ================================================================== page
 * Dropout-style: the network channel plays full-bleed at the top (LiveHero),
 * then horizontal shelves — Live Channels / On Demand / Creator Channels. */
export default function HomePage() {
  // Same SWR key as LiveHero — deduped, one request.
  const { data: chData } = useSWR<{ channels: ChannelSummary[] }>(
    "/api/channels",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const { data: fyData } = useSWR<{ items: VideoSummary[] }>(
    "/api/browse?sort=new",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const liveReal = (chData?.channels ?? []).filter((c) => c.status === "active");
  const liveIsMock = liveReal.length === 0;
  const live = liveIsMock ? MOCK_LIVE : liveReal;

  const onDemandIsMock = !fyData?.items?.length;
  const onDemand = (onDemandIsMock ? MOCK_ONDEMAND : fyData!.items).slice(0, 12);

  return (
    <div className="pb-12">
      {/* ---------------------------------------------------- FULL-SCREEN LIVE */}
      <LiveHero />

      <div className="mx-auto max-w-[1400px] space-y-8 px-4 pt-8">
        {/* ---------------------------------------------------- LIVE CHANNELS */}
        <Rail
          title={<SectionTitle demo={liveIsMock}>Live Channels</SectionTitle>}
          href="/live"
        >
          {live.map((c) => (
            <LiveCard key={c.id} c={c} />
          ))}
        </Rail>

        {/* ---------------------------------------------------- ON DEMAND */}
        <Rail
          title={<SectionTitle demo={onDemandIsMock}>On Demand</SectionTitle>}
          href="/browse"
        >
          {onDemand.map((v) => (
            <VodCard
              key={v.id}
              v={v}
              href={onDemandIsMock ? "/browse" : undefined}
            />
          ))}
        </Rail>

        {/* ---------------------------------------------------- CREATOR CHANNELS */}
        <Rail
          title={<SectionTitle demo>Creator Channels</SectionTitle>}
          href="/browse"
        >
          {MOCK_CREATORS.map((c) => (
            <CreatorCard key={c.username} c={c} />
          ))}
        </Rail>
      </div>
    </div>
  );
}
