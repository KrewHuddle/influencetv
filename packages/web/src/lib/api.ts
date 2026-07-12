import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_URL } from "./constants";
import { useAuthStore } from "@/store/authStore";

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  withCredentials: true, // send httpOnly refresh cookie
});

// Attach access token.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${API_URL}/api/auth/refresh`,
      {},
      { withCredentials: true }
    );
    const token = res.data?.data?.accessToken as string | undefined;
    if (token) {
      useAuthStore.getState().setToken(token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const data = error.response?.data as
      | { error?: { upgradeRequired?: boolean } }
      | undefined;

    // 401 → try refresh once, then retry the original request.
    if (status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing ??= refreshToken().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      useAuthStore.getState().clearAuth();
      // Only bounce to /login from areas that require auth — public pages
      // (home, browse, live, watch) must stay browsable for guests and
      // expired sessions.
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (/^\/(account|studio|admin|shop\/checkout)/.test(path)) {
          window.location.href = "/login";
        }
      }
    }

    // 403 upgrade-required → send to plans.
    if (status === 403 && data?.error?.upgradeRequired) {
      if (typeof window !== "undefined") window.location.href = "/plans";
    }

    return Promise.reject(error);
  }
);

/** Unwrap the { data, error } envelope, throwing on error. */
export async function apiGet<T>(url: string): Promise<T> {
  const res = await api.get(url);
  return res.data.data as T;
}
export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post(url, body);
  return res.data.data as T;
}

export const swrFetcher = <T>(url: string): Promise<T> => apiGet<T>(url);
