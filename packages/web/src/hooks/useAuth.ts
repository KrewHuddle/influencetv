"use client";
import { useCallback } from "react";
import { api, apiPost } from "@/lib/api";
import { API_URL } from "@/lib/constants";
import { useAuthStore, type AuthUser } from "@/store/authStore";
import axios from "axios";

interface AuthPayload {
  user: AuthUser;
  accessToken: string;
}

export function useAuth() {
  const { user, accessToken, isLoading, setAuth, clearAuth } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiPost<AuthPayload>("/api/auth/login", {
        email,
        password,
      });
      setAuth(data.user, data.accessToken);
      return data.user;
    },
    [setAuth]
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const data = await apiPost<AuthPayload>("/api/auth/register", {
        email,
        password,
        displayName,
      });
      setAuth(data.user, data.accessToken);
      return data.user;
    },
    [setAuth]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  return { user, accessToken, isLoading, login, register, logout };
}

/** One-shot session restore: refresh cookie → access token → /me. */
export async function bootstrapAuth(): Promise<void> {
  const { setAuth, clearAuth, setLoading } = useAuthStore.getState();
  setLoading(true);
  try {
    const refresh = await axios.post(
      `${API_URL}/api/auth/refresh`,
      {},
      { withCredentials: true }
    );
    const token = refresh.data?.data?.accessToken as string | undefined;
    if (!token) {
      clearAuth();
      return;
    }
    useAuthStore.getState().setToken(token);
    const me = await api.get("/api/users/me");
    setAuth(me.data.data.user, token);
  } catch {
    clearAuth();
  }
}
