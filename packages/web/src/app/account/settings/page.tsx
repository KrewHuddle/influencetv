"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (!user) return <div className="p-8 text-sm text-[color:var(--text-muted)]">Sign in required.</div>;

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-6 font-display text-2xl">Settings</h1>
      <form onSubmit={save} className="space-y-4">
        <Input label="Display Name" value={displayName} onChange={(e) => setName(e.target.value)} />
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-apex bg-apex-gray-900 px-3.5 py-2.5 text-sm focus:border-apex-red focus:outline-none"
          />
        </label>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </form>
    </div>
  );
}
