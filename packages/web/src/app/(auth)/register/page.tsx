"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function strength(pw: string): { label: string; cls: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", cls: "text-apex-red" };
  if (score === 2) return { label: "Medium", cls: "text-yellow-400" };
  return { label: "Strong", cls: "text-green-400" };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [displayName, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const pw = useMemo(() => strength(password), [password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return;
    setBusy(true);
    try {
      await register(email, password, displayName);
      router.push("/");
    } catch {
      toast({ title: "Registration failed", description: "Email may be taken or password too weak", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-apex bg-apex-gray-900 p-8">
        <h1 className="mb-6 text-center font-display text-2xl">Create Account</h1>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Name" value={displayName} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <div>
            <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {password && <p className={`mt-1 text-xs ${pw.cls}`}>{pw.label}</p>}
          </div>
          <label className="flex items-start gap-2 text-xs text-[color:var(--text-secondary)]">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            I agree to the Terms of Service and Privacy Policy.
          </label>
          <Button type="submit" disabled={busy || !agree} className="w-full">
            {busy ? "Creating…" : "Create Account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-[color:var(--text-secondary)]">
          Have an account? <Link href="/login" className="text-apex-white">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
