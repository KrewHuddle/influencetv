import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface TVUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  plan: string;
}

interface AuthState {
  user: TVUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setAuth: (user: TVUser, accessToken: string, refreshToken: string) => void;
  hydrate: () => Promise<void>;
  signOut: () => Promise<void>;
}

const KEY = "apex_tv_auth";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  setAuth: (user, accessToken, refreshToken) => {
    void AsyncStorage.setItem(KEY, JSON.stringify({ user, accessToken, refreshToken }));
    set({ user, accessToken, refreshToken });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          user: TVUser;
          accessToken: string;
          refreshToken: string;
        };
        set({ ...parsed, hydrated: true });
        return;
      }
    } catch {
      /* ignore */
    }
    set({ hydrated: true });
  },

  signOut: async () => {
    await AsyncStorage.removeItem(KEY);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
