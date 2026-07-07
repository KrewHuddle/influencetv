"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { API_URL } from "@/lib/constants";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      const STAFF = ["moderator", "channel_manager", "super_admin"];
      router.push(u && STAFF.includes(u.role) ? "/admin" : "/");
    } catch {
      toast({ title: "Sign in failed", description: "Check your credentials", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-itv-border bg-itv-surface p-8">
        <h1 className="mb-6 text-center font-display text-2xl">INFLUENCE TV</h1>
        <a href={`${API_URL}/api/auth/google`}>
          <Button variant="ghost" className="w-full">
            Continue with Google
          </Button>
        </a>
        <div className="my-5 flex items-center gap-3 text-xs text-itv-muted">
          <span className="h-px flex-1 bg-white/10" /> OR <span className="h-px flex-1 bg-white/10" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign In"}
          </Button>
        </form>
        <div className="mt-4 flex justify-between text-xs text-itv-muted">
          <Link href="/forgot-password" className="hover:text-itv-text">Forgot password?</Link>
          <Link href="/register" className="hover:text-itv-text">Create account</Link>
        </div>
      </div>
    </div>
  );
}
