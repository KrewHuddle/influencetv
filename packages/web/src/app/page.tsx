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

/* ------------------------------------------------------------------ on-demand grid card */
function GridVodCard({ v, href }: { v: VideoSummary; href?: string }) {
  return (
    <Link href={href ?? `/watch/${v.id}`} className="block">
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
 * Top half: the network channel playing live (LiveHero).
 * Bottom half: on-demand library grid + creator channels rail. Kept to two
 * sections on purpose — bold, clean, not busy. */
export default function HomePage() {
  const { data: fyData } = useSWR<{ items: VideoSummary[] }>(
    "/api/browse?sort=new",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const onDemandIsMock = !fyData?.items?.length;
  const onDemand = (onDemandIsMock ? MOCK_ONDEMAND : fyData!.items).slice(0, 8);

  return (
    <div className="pb-12">
      {/* ---------------------------------------------------- LIVE, TOP HALF */}
      <LiveHero />

      <div className="mx-auto max-w-[1400px] space-y-10 px-4 pt-10">
        {/* ---------------------------------------------------- ON DEMAND */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-itv-text">
              <SectionTitle demo={onDemandIsMock}>On Demand</SectionTitle>
            </h2>
            <Link
              href="/browse"
              className="text-xs font-medium text-itv-accent hover:underline"
            >
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {onDemand.map((v) => (
              <GridVodCard
                key={v.id}
                v={v}
                href={onDemandIsMock ? "/browse" : undefined}
              />
            ))}
          </div>
        </section>

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
