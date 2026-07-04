"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Spinner";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("accessToken");
    if (!token) {
      router.replace("/login");
      return;
    }
    useAuthStore.getState().setToken(token);
    api
      .get("/api/users/me")
      .then((r) => {
        useAuthStore.getState().setAuth(r.data.data.user, token);
        router.replace("/");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
