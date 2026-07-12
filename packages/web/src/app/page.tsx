"use client";
/* Hallmark · redesign (section scope): Home lower half · theme: Lemon Signal (locked)
 * rhythm: typographic guide strip → conditional live-commerce banner →
 *         image-led shelf w/ lead card → avatar pills
 * pre-emit critique: P4 H5 E4 S4 R5 V5 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
  live?: boolean;
  patron?: boolean;
}
interface HaggleSummary {
  id: string;
  title: string;
  product_title?: string | null;
  current_bid_cents?: number | null;
  ends_at?: string | null;
  bid_count?: number | null;
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
  { username: "novafields", name: "Nova Fields", live: true, patron: true },
  { username: "rexmarlow", name: "Rex Marlow", patron: true },
  { username: "marsonair", name: "Mars", live: true },
  { username: "theblend", name: "The Blend", patron: true },
  { username: "dcole", name: "D. Cole" },
  { username: "jheneb", name: "Jhene B" },
];

/* ------------------------------------------------------------------ format */
const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

/* ------------------------------------------------------------------ demo label for mock-backed sections */
function DemoTag() {
  return <Badge tone="warn">Demo</Badge>;
}

/* ------------------------------------------------------------------ live guide tile — typographic, no thumbnail */
function GuideTile({ c }: { c: ChannelSummary }) {
  return (
    <Link
      href={`/live/${c.slug}`}
      className="group flex w-[248px] shrink-0 snap-start items-center gap-4 rounded-lg border border-itv-border2 bg-itv-surface px-4 py-3.5 transition-colors hover:border-itv-accent-border hover:bg-itv-surface2"
    >
      <span className="font-display text-3xl font-black tabular-nums leading-none text-itv-faint transition-colors group-hover:text-itv-accent">
        {String(c.number ?? 0).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 animate-live-pulse rounded-full bg-itv-live" />
          <span className="truncate text-[13px] font-semibold text-itv-text">
            {c.current_show ?? c.name}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-itv-muted">
          {c.name} ·{" "}
          <span className="font-mono tabular-nums">{kfmt(c.viewer_count)}</span>{" "}
          watching
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ on-demand shelf card (lead = first item, larger) */
function VodCard({ v, href, lead }: { v: VideoSummary; href?: string; lead?: boolean }) {
  return (
    <Link
      href={href ?? `/watch/${v.id}`}
      className={`${lead ? "w-[320px] md:w-[400px]" : "w-[220px]"} shrink-0 snap-start`}
    >
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
          <p
            className={`line-clamp-2 font-semibold leading-snug text-itv-text ${
              lead ? "text-[15px]" : "text-[13px]"
            }`}
          >
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

/* ------------------------------------------------------------------ creator pill — avatar + name, lightest voice on the page */
function CreatorPill({ c }: { c: CreatorSummary }) {
  return (
    <Link
      href={`/creator/${c.username}`}
      className="group flex shrink-0 snap-start items-center gap-2.5 rounded-full border border-itv-border2 bg-itv-surface py-1.5 pl-1.5 pr-4 transition-colors hover:border-itv-accent-border hover:bg-itv-surface2"
    >
      <Avatar
        name={c.name}
        size="sm"
        ring={c.live ? "live" : c.patron ? "gold" : "accent"}
      />
      <span className="text-[13px] font-semibold text-itv-text">{c.name}</span>
      {c.live && (
        <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
      )}
      <ArrowUpRight
        size={13}
        className="text-itv-faint transition-colors group-hover:text-itv-accent"
      />
    </Link>
  );
}

/* ------------------------------------------------------------------ live haggle banner — renders only on real data */
function HaggleBanner({ a }: { a: HaggleSummary }) {
  const [left, setLeft] = useState(() =>
    a.ends_at
      ? Math.max(0, Math.round((new Date(a.ends_at).getTime() - Date.now()) / 1000))
      : 0
  );
  useEffect(() => {
    const t = setInterval(
      () =>
        setLeft(
          a.ends_at
            ? Math.max(0, Math.round((new Date(a.ends_at!).getTime() - Date.now()) / 1000))
            : 0
        ),
      1000
    );
    return () => clearInterval(t);
  }, [a.ends_at]);
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <Link href="/haggle" className="block">
      <Card
        interactive
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-itv-accent-border px-5 py-4"
      >
        <Badge tone="accent">Live Haggle</Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-itv-text">
          {a.product_title ?? a.title}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-itv-accent">
          {kfmt(a.bid_count)} bids · ${(Number(a.current_bid_cents) || 0) / 100}
        </span>
        <span
          className={`rounded bg-black/60 px-2 py-0.5 font-mono text-sm tabular-nums ${
            left <= 10 ? "text-itv-live" : "text-itv-text"
          }`}
        >
          {mmss}
        </span>
      </Card>
    </Link>
  );
}

/* ================================================================== page
 * Top: the network channel playing full-width (LiveHero, natural 16:9).
 * Lower half — three voices, not three identical rails:
 *   guide strip (type-led) → haggle banner (real data only) →
 *   On Demand shelf w/ lead card (image-led) → creator pills (lightest). */
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
  const { data: haggleData } = useSWR<{ items: HaggleSummary[] }>(
    "/api/haggle/browse?status=live",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const liveReal = (chData?.channels ?? []).filter((c) => c.status === "active");
  const liveIsMock = liveReal.length === 0;
  const live = liveIsMock ? MOCK_LIVE : liveReal;

  const onDemandIsMock = !fyData?.items?.length;
  const onDemand = (onDemandIsMock ? MOCK_ONDEMAND : fyData!.items).slice(0, 12);
  const haggle = haggleData?.items?.[0] ?? null;

  return (
    <div className="pb-14">
      <LiveHero />

      <div className="mx-auto max-w-[1400px] space-y-12 px-4 pt-10">
        {/* ------------------------------------------ MORE LIVE TV — guide strip */}
        <section aria-label="More live TV">
          <div className="mb-3 flex items-baseline gap-3 px-1">
            <h2 className="font-display text-lg font-semibold tracking-tight text-itv-text">
              More Live TV
            </h2>
            {liveIsMock && <DemoTag />}
            <Link
              href="/live"
              className="ml-auto text-xs font-medium text-itv-muted transition-colors hover:text-itv-accent"
            >
              Full guide →
            </Link>
          </div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {live.map((c) => (
              <GuideTile key={c.id} c={c} />
            ))}
          </div>
        </section>

        {/* ------------------------------------------ LIVE HAGGLE — real data only */}
        {haggle && <HaggleBanner a={haggle} />}

        {/* ------------------------------------------ ON DEMAND — image-led shelf */}
        <section aria-label="On demand">
          <div className="mb-4 flex items-baseline gap-3 px-1">
            <h2 className="font-display text-2xl font-black tracking-tight text-itv-text lg:text-3xl">
              On Demand
            </h2>
            {onDemandIsMock && <DemoTag />}
            <Link
              href="/browse"
              className="ml-auto text-xs font-medium text-itv-muted transition-colors hover:text-itv-accent"
            >
              Browse all →
            </Link>
          </div>
          <Rail>
            {onDemand.map((v, i) => (
              <VodCard
                key={v.id}
                v={v}
                lead={i === 0}
                href={onDemandIsMock ? "/browse" : undefined}
              />
            ))}
          </Rail>
        </section>

        {/* ------------------------------------------ CREATORS — pill row */}
        <section aria-label="Creators">
          <div className="mb-3 flex items-baseline gap-3 px-1">
            <h2 className="font-display text-lg font-semibold tracking-tight text-itv-text">
              Creators
            </h2>
            <DemoTag />
          </div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {MOCK_CREATORS.map((c) => (
              <CreatorPill key={c.username} c={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
