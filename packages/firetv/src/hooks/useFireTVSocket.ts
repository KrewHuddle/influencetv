import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "../lib/constants";
import { useAuthStore } from "../store/authStore";

/** Single reconnecting socket for the TV session. */
export function useFireTVSocket(): Socket | null {
  const token = useAuthStore((s) => s.accessToken);
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    ref.current = socket;
    return () => {
      socket.disconnect();
      ref.current = null;
    };
  }, [token]);

  return ref.current;
}
