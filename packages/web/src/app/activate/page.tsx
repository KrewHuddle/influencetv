"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

function ActivateInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/activate");
  }, [isLoading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      await api.post("/api/auth/tv-code/verify", { code: code.toUpperCase() });
      setState("ok");
    } catch {
      setState("error");
    }
  };

  if (isLoading || !user)
    return <div className="grid min-h-[60vh] place-items-center"><Spinner /></div>;

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-apex bg-apex-gray-900 p-8 text-center">
        <h1 className="mb-2 font-display text-2xl">Activate your TV</h1>
        {state === "ok" ? (
          <>
            <p className="mb-6 mt-4 text-apex-white">Your TV is now signed in!</p>
            <Link href="/"><Button>Done</Button></Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-sm text-[color:var(--text-secondary)]">
              Enter the code shown on your TV.
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="text-center text-lg tracking-[0.4em]"
              maxLength={6}
            />
            {state === "error" && (
              <p className="text-xs text-apex-red">Invalid or expired code.</p>
            )}
            <Button type="submit" disabled={state === "busy" || code.length < 6} className="w-full">
              {state === "busy" ? "Activating…" : "Activate"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><Spinner /></div>}>
      <ActivateInner />
    </Suspense>
  );
}
