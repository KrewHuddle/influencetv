"use client";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface MeResponse {
  user: {
    display_name: string | null;
    email: string;
    avatar_url: string | null;
    subscription_plan: string;
  };
  subscription: { current_period_end?: string } | null;
}

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { data } = useSWR<MeResponse>(user ? "/api/users/me" : null, swrFetcher);

  if (!user)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Link href="/login"><Button>Sign in</Button></Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <section className="mb-8 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-itv-surface2 text-xl">
          {(user.displayName ?? user.email)[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-2xl">{user.displayName ?? "Viewer"}</h1>
          <p className="text-sm text-itv-muted">{user.email}</p>
          <Badge className="mt-1">{user.plan}</Badge>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-itv-border bg-itv-surface p-5">
        <h2 className="mb-2 font-display text-sm">Subscription</h2>
        <p className="text-sm text-itv-muted">
          Plan: <span className="text-itv-text">{user.plan}</span>
          {data?.subscription?.current_period_end &&
            ` · renews ${new Date(data.subscription.current_period_end).toLocaleDateString()}`}
        </p>
        <div className="mt-3 flex gap-2">
          <Link href="/account/subscription"><Button variant="ghost" className="text-xs">Manage</Button></Link>
          <Link href="/plans"><Button className="text-xs">Upgrade</Button></Link>
        </div>
      </section>

      <div className="flex gap-2">
        <Link href="/account/settings"><Button variant="ghost">Settings</Button></Link>
        <Button variant="ghost" onClick={() => void logout()}>Sign Out</Button>
      </div>
    </div>
  );
}
