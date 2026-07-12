"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    api
      .get(`/api/auth/verify-email?token=${token}`)
      .then(() => setState("ok"))
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-6 text-center">
      <div className="max-w-sm">
        {state === "loading" && <Spinner className="h-8 w-8" />}
        {state === "ok" && (
          <>
            <h1 className="mb-2 font-display text-2xl">Email verified</h1>
            <p className="mb-6 text-itv-muted">You can now sign in.</p>
            <Link href="/login"><Button>Go to Sign In</Button></Link>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="mb-2 font-display text-2xl text-itv-accent">Link invalid</h1>
            <p className="mb-6 text-itv-muted">This verification link is invalid or expired.</p>
            <Link href="/login"><Button variant="ghost">Back to Sign In</Button></Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[50vh] place-items-center"><Spinner /></div>}>
      <VerifyInner />
    </Suspense>
  );
}
