import { API_URL } from "./constants";
import { useAuthStore } from "../store/authStore";

interface Envelope<T> {
  data: T | null;
  error: { message: string; code: string } | null;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }
  return body.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
};
