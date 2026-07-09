"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, Play, Users, Check } from "lucide-react";
import useSWR from "swr";
import { swrFetcher, apiPost } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { PriceTag } from "@/components/ui/PriceTag";
import { Skeleton } from "@/components/ui/Spinner";

/* ------------------------------------------------------------------ types */
interface Hub {
  creator: {
    id: string;
    displayName: string;
    username: string;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  };
  channels: Array<{ id: string; name: string; slug: string; status?: string; genre?: string | null; artwork_url?: string | null; viewer_count?: number | null }>;
  videos: Array<{ id: string; title: string; thumbnail_url?: string | null; duration_seconds?: number | null; view_count?: number | null }>;
  courses: Array<{ id: string; title: string; slug: string; thumbnail_url?: string | null; access_level?: string; lesson_count?: number; enrollment_count?: number }>;
  products: Array<{ id: string; title: string; base_price_cents: number; compare_at_price_cents?: number | null; thumbnail_url?: string | null }>;
  tiers: Array<{ id: string; name: string; description?: string | null; price_cents: number; perks?: string[]; subscriber_count?: number }>;
  community: { id: string; name: string; description?: string | null; member_count?: number; post_count?: number } | null;
  stats: { videos: number; courses: number; products: number; patrons: number };
}

/* ------------------------------------------------------------------ mock (shown when the creator/hub isn't in the DB yet) */
const mockHub = (username: string): Hub => ({
  creator: {
    id: "mock",
    displayName: username.replace(/^\w/, (c) => c.toUpperCase()),
    username,
    bio: "Creator on Influence TV — live shows, on-demand, courses, and drops.",
    avatarUrl: null,
    bannerUrl: null,
  },
  channels: [
    { id: "c1", name: "Studio Live", slug: "drama", status: "active", genre: "Music", viewer_count: 3120 },
  ],
  videos: Array.from({ length: 6 }, (_, i) => ({
    id: `v${i}`,
    title: ["Studio Sessions Ep 4", "Behind the Set", "Live Recap", "The Come Up", "Late Night Set", "Q&A Special"][i],
    view_count: 4200 + i * 3100,
    duration_seconds: 600 + i * 120,
  })),
  courses: [
    { id: "k1", title: "On-Camera Presence", slug: "on-camera-presence", access_level: "free", lesson_count: 8, enrollment_count: 1240 },
    { id: "k2", title: "Monetize Your Channel", slug: "monetize", access_level: "premium", lesson_count: 12, enrollment_count: 860 },
  ],
  products: [
    { id: "p1", title: "Tour Tee", base_price_cents: 3200, compare_at_price_cents: 4000 },
    { id: "p2", title: "Signed Poster", base_price_cents: 2500 },
    { id: "p3", title: "Sticker Pack", base_price_cents: 900 },
  ],
  tiers: [
    { id: "t1", name: "Supporter", price_cents: 500, perks: ["Members-only posts", "Badge"], subscriber_count: 420 },
    { id: "t2", name: "Insider", price_cents: 1500, perks: ["Everything in Supporter", "Early videos", "Monthly hangout"], subscriber_count: 130 },
  ],
  community: { id: "cm1", name: "The Studio", description: "Fans, chats, and behind-the-scenes.", member_count: 5400, post_count: 890 },
  stats: { videos: 6, courses: 2, products: 3, patrons: 550 },
});

/* ------------------------------------------------------------------ helpers */
const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

type TabKey = "watch" | "learn" | "shop" | "membership" | "community";

/* ================================================================== page */
export default function CreatorHubPage({
  params,
}: {
  params: { username: string };
}) {
  const { username } = params;
  const { data, error } = useSWR<Hub>(
    `/api/creators/${username}/hub`,
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const [tab, setTab] = useState<TabKey>("watch");
  const [joiningTierId, setJoiningTierId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);

  // Loading → skeleton. 404 / error → mock so the surface still demos (labeled below).
  const isMock = !data && !!error;
  const hub: Hub | undefined = data ?? (isMock ? mockHub(username) : undefined);

  async function joinTier(tierId: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    setJoiningTierId(tierId);
    try {
      const res = await apiPost<{ checkoutUrl?: string | null }>(
        "/api/patrons/subscribe",
        { tierId }
      );
      toast({ title: "Redirecting to checkout" });
      if (res?.checkoutUrl) window.location.href = res.checkoutUrl;
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast({
        title: e?.response?.data?.error?.message ?? "Couldn't start membership",
        variant: "error",
      });
    } finally {
      setJoiningTierId(null);
    }
  }

  if (!hub) return <HubSkeleton />;

  const { creator, channels, videos, courses, products, tiers, community, stats } = hub;
  const liveChannel = channels.find((c) => c.status === "active");

  const tabItems = [
    { value: "watch", label: `Watch${stats.videos ? ` · ${stats.videos}` : ""}` },
    { value: "learn", label: `Learn${stats.courses ? ` · ${stats.courses}` : ""}` },
    { value: "shop", label: `Shop${stats.products ? ` · ${stats.products}` : ""}` },
    { value: "membership", label: "Membership" },
    { value: "community", label: "Community" },
  ];

  return (
    <div className="pb-12">
      {/* ---------------------------------------------------------- demo notice */}
      {isMock && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <Card tone="surface2" className="flex flex-wrap items-center gap-3 p-4">
            <Badge tone="warn">Demo profile</Badge>
            <p className="text-sm text-itv-muted">
              This creator isn&apos;t live yet — sample data shown.
            </p>
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------------- banner */}
      <div className="relative h-40 overflow-hidden bg-itv-surface2 md:h-56">
        {creator.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(800px 300px at 30% 0%, color-mix(in oklch, var(--itv-magenta) 35%, transparent), transparent 60%), radial-gradient(600px 300px at 90% 20%, color-mix(in oklch, var(--itv-gold) 20%, transparent), transparent 60%)",
            }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-itv-bg to-transparent" />
      </div>

      {/* ---------------------------------------------------------- identity */}
      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar
              name={creator.displayName}
              src={creator.avatarUrl}
              size="xl"
              ring={liveChannel ? "live" : "magenta"}
              className="border-4 border-itv-bg"
            />
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-itv-text md:text-3xl">
                  {creator.displayName}
                </h1>
                {liveChannel && (
                  <Badge tone="live">
                    <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
                    Live
                  </Badge>
                )}
              </div>
              <p className="text-sm text-itv-muted">@{creator.username}</p>
            </div>
          </div>
          {liveChannel && (
            <div className="flex items-center gap-2">
              <Link href={`/live/${liveChannel.slug}`}>
                <Button variant="live" size="sm">
                  <Radio size={14} /> Watch Live
                </Button>
              </Link>
            </div>
          )}
        </div>

        {creator.bio && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-itv-muted">
            {creator.bio}
          </p>
        )}

        {/* stat strip */}
        <div className="mt-4 flex flex-wrap gap-6 font-mono text-xs tabular-nums text-itv-faint">
          <Stat n={stats.videos} label="videos" />
          <Stat n={stats.courses} label="courses" />
          <Stat n={stats.products} label="products" />
          <Stat n={stats.patrons} label="patrons" />
        </div>

        {/* ---------------------------------------------------------- tabs */}
        <div className="mt-6">
          <Tabs items={tabItems} value={tab} onChange={(v) => setTab(v as TabKey)} />
        </div>

        <div className="mt-6">
          {tab === "watch" && (
            <div className="space-y-8">
              {channels.length > 0 && (
                <Section icon={<Radio size={16} />} title="Channels">
                  <Grid>
                    {channels.map((c) => (
                      <Link key={c.id} href={`/live/${c.slug}`}>
                        <Card interactive className="overflow-hidden">
                          <div className="relative aspect-video bg-itv-surface3">
                            {c.artwork_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.artwork_url} alt={c.name} className="h-full w-full object-cover" />
                            )}
                            {c.status === "active" && (
                              <span className="absolute left-2 top-2">
                                <Badge tone="live">Live</Badge>
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="truncate text-sm font-semibold text-itv-text">{c.name}</p>
                            <p className="text-xs text-itv-muted">
                              {c.genre ?? "Channel"} · {kfmt(c.viewer_count)} watching
                            </p>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </Grid>
                </Section>
              )}
              <Section icon={<Play size={16} />} title="On Demand">
                {videos.length ? (
                  <Grid>
                    {videos.map((v) => (
                      <Link key={v.id} href={`/watch/${v.id}`}>
                        <Card interactive className="overflow-hidden">
                          <div className="relative aspect-video bg-itv-surface3">
                            {v.thumbnail_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={v.thumbnail_url} alt={v.title} className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="p-3">
                            <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-itv-text">{v.title}</p>
                            <p className="mt-1 text-xs text-itv-muted">{kfmt(v.view_count)} views</p>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </Grid>
                ) : (
                  <Empty>No videos yet.</Empty>
                )}
              </Section>
            </div>
          )}

          {tab === "learn" &&
            (courses.length ? (
              <Grid>
                {courses.map((k) => (
                  <Link key={k.id} href={`/courses/${k.slug}`}>
                    <Card interactive className="overflow-hidden">
                      <div className="relative aspect-video bg-itv-surface3">
                        {k.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={k.thumbnail_url} alt={k.title} className="h-full w-full object-cover" />
                        )}
                        <span className="absolute left-2 top-2">
                          <Badge tone={k.access_level === "free" ? "success" : "gold"}>
                            {k.access_level ?? "free"}
                          </Badge>
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-itv-text">{k.title}</p>
                        <p className="mt-1 text-xs text-itv-muted">
                          {k.lesson_count ?? 0} lessons · {kfmt(k.enrollment_count)} enrolled
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </Grid>
            ) : (
              <Empty>No courses yet.</Empty>
            ))}

          {tab === "shop" &&
            (products.length ? (
              <Grid>
                {products.map((pr) => (
                  <Link key={pr.id} href={`/shop/product/${pr.id}`}>
                    <Card interactive className="overflow-hidden">
                      <div className="relative aspect-square bg-itv-surface3">
                        {pr.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pr.thumbnail_url} alt={pr.title} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-1 text-[13px] font-semibold text-itv-text">{pr.title}</p>
                        <PriceTag
                          cents={pr.base_price_cents}
                          compareAtCents={pr.compare_at_price_cents}
                          size="sm"
                          className="mt-1"
                        />
                      </div>
                    </Card>
                  </Link>
                ))}
              </Grid>
            ) : (
              <Empty>No products yet.</Empty>
            ))}

          {tab === "membership" &&
            (tiers.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tiers.map((t) => (
                  <Card key={t.id} className="flex flex-col p-5">
                    <p className="text-sm font-semibold uppercase tracking-wide text-itv-gold">{t.name}</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <PriceTag cents={t.price_cents} size="lg" />
                      <span className="text-xs text-itv-muted">/mo</span>
                    </div>
                    {t.description && <p className="mt-2 text-xs text-itv-muted">{t.description}</p>}
                    <ul className="mt-4 flex-1 space-y-2">
                      {(t.perks ?? []).map((perk, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-itv-text">
                          <Check size={14} className="mt-0.5 shrink-0 text-itv-gold" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 font-mono text-[11px] tabular-nums text-itv-faint">
                      {kfmt(t.subscriber_count)} patrons
                    </p>
                    <Button
                      variant="gold"
                      className="mt-3 w-full"
                      disabled={joiningTierId === t.id}
                      onClick={() => joinTier(t.id)}
                    >
                      {joiningTierId === t.id ? "Starting checkout…" : `Join ${t.name}`}
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty>This creator hasn&apos;t set up membership tiers.</Empty>
            ))}

          {tab === "community" &&
            (community ? (
              <Card className="flex flex-col items-start gap-3 p-6">
                <Users size={24} className="text-itv-magenta" />
                <h3 className="font-display text-lg font-semibold text-itv-text">{community.name}</h3>
                {community.description && <p className="text-sm text-itv-muted">{community.description}</p>}
                <p className="font-mono text-xs tabular-nums text-itv-faint">
                  {kfmt(community.member_count)} members · {kfmt(community.post_count)} posts
                </p>
                <Link href={`/community/${community.id}`}>
                  <Button size="sm">Open Community</Button>
                </Link>
              </Card>
            ) : (
              <Empty>No community yet.</Empty>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ small parts */
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span>
      <span className="font-bold text-itv-text">{kfmt(n)}</span> {label}
    </span>
  );
}
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-itv-text">
        <span className="text-itv-magenta">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-itv-border py-12 text-center text-sm text-itv-muted">
      {children}
    </div>
  );
}
function HubSkeleton() {
  return (
    <div className="pb-12">
      <Skeleton className="h-40 w-full rounded-none md:h-56" />
      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-12 flex items-end gap-4">
          <Skeleton className="h-20 w-20 rounded-full border-4 border-itv-bg" />
          <div className="space-y-2 pb-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      </div>
    </div>
  );
}
