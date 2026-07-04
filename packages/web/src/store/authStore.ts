import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  username?: string | null;
  role: string;
  plan: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setToken: (accessToken: string) => void;
  setLoading: (v: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  setAuth: (user, accessToken) => set({ user, accessToken, isLoading: false }),
  setToken: (accessToken) => set({ accessToken }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, accessToken: null, isLoading: false }),
}));
