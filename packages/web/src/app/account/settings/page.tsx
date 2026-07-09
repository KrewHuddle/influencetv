"use client";
import { useEffect, useState } from "react";
import { api, apiGet } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface MeResponse {
  user: { display_name: string | null; bio: string | null };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setName] = useState("");
  const [bio, setBio] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Hydrate the form from the server before allowing a save, so a PATCH
  // never overwrites existing fields (e.g. bio) with empty strings.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiGet<MeResponse>("/api/users/me")
      .then((res) => {
        if (cancelled) return;
        setName(res.user.display_name ?? "");
        setBio(res.user.bio ?? "");
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        toast({
          title: "Couldn't load your profile",
          description: "Refresh the page to try again.",
          variant: "error",
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loaded) return;
    setBusy(true);
    try {
      await api.patch("/api/users/me", { displayName, bio });
      toast({ title: "Profile saved" });
    } catch {
      toast({ title: "Save failed", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <div className="p-8 text-sm text-itv-muted">Sign in required.</div>;

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-6 font-display text-2xl">Settings</h1>
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setName(e.target.value)}
          disabled={!loaded}
        />
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-itv-muted">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            disabled={!loaded}
            className="w-full rounded-md border border-itv-border bg-itv-surface px-3.5 py-2.5 text-sm focus:border-itv-magenta focus:outline-none disabled:opacity-40"
          />
        </label>
        <Button type="submit" disabled={busy || !loaded}>
          {!loaded ? "Loading…" : busy ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
