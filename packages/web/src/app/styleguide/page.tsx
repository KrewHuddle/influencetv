"use client";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  PillFilter,
  PriceTag,
  ProgressBar,
  Rail,
  Skeleton,
  Spinner,
  Tabs,
} from "@/components/ui";

/**
 * Dev-only visual reference for the Lemon Signal component kit.
 * Not linked in nav. Visit /styleguide.
 */
export default function StyleGuide() {
  const [tab, setTab] = useState("watch");
  const [filter, setFilter] = useState("all");

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-itv-text">
          Lemon Signal
        </h1>
        <p className="text-sm text-itv-muted">Component kit — design system reference</p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="gold">Membership</Button>
          <Button variant="live">Go Live</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="subtle">Subtle</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="accent">New</Badge>
          <Badge tone="gold">Patron</Badge>
          <Badge tone="live">● Live</Badge>
          <Badge tone="success">Paid</Badge>
          <Badge tone="warn">Pending</Badge>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name="Nova Fields" size="xs" />
          <Avatar name="Nova Fields" size="sm" />
          <Avatar name="Nova Fields" size="md" ring="accent" />
          <Avatar name="Nova Fields" size="lg" ring="gold" />
          <Avatar name="Nova Fields" size="xl" ring="live" />
        </div>
      </Section>

      <Section title="Inputs">
        <div className="max-w-sm space-y-4">
          <Input label="Email" placeholder="you@example.com" />
          <Input label="Search" placeholder="Search creators…" />
        </div>
      </Section>

      <Section title="Tabs & filters">
        <Tabs
          items={[
            { value: "watch", label: "Watch" },
            { value: "learn", label: "Learn" },
            { value: "shop", label: "Shop" },
            { value: "community", label: "Community" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="mt-4">
          <PillFilter
            options={[
              { value: "all", label: "All" },
              { value: "new", label: "New" },
              { value: "popular", label: "Popular" },
              { value: "trending", label: "Trending" },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </Section>

      <Section title="Prices & progress">
        <div className="flex flex-wrap items-center gap-6">
          <PriceTag cents={2499} />
          <PriceTag cents={1499} compareAtCents={2499} />
          <PriceTag cents={9900} size="lg" />
        </div>
        <div className="mt-4 max-w-sm space-y-3">
          <ProgressBar value={35} />
          <ProgressBar value={70} tone="gold" label="Course progress" />
          <ProgressBar value={100} tone="success" />
        </div>
      </Section>

      <Section title="Cards & rail">
        <Rail title="Continue watching" href="#">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} interactive className="w-56 shrink-0 snap-start p-3">
              <div className="mb-3 aspect-video rounded-md bg-itv-surface3" />
              <p className="text-sm font-medium text-itv-text">Episode {i}</p>
              <p className="text-xs text-itv-muted">Nova Fields</p>
            </Card>
          ))}
        </Rail>
      </Section>

      <Section title="Loading">
        <div className="flex items-center gap-6">
          <Spinner />
          <div className="w-64 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="aspect-video w-full" />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-itv-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}
