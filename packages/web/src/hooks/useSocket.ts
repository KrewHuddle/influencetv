"use client";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "@/lib/constants";
import { useAuthStore } from "@/store/authStore";

let sharedSocket: Socket | null = null;

/** Lazily create a single shared authenticated socket. */
export function useSocket(): Socket | null {
  const token = useAuthStore((s) => s.accessToken);
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    if (!sharedSocket) {
      sharedSocket = io(WS_URL, {
        auth: { token },
        transports: ["websocket"],
        autoConnect: true,
      });
    }
    ref.current = sharedSocket;
    return () => {
      // Keep the shared socket alive across components; disconnect on logout.
    };
  }, [token]);

  return ref.current;
}

/** Subscribe to a room + event; cleans up on unmount. */
export function useSocketEvent<T = unknown>(
  room: string | null,
  event: string,
  handler: (payload: T) => void
): void {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    if (room) socket.emit("join-channel", room);
    socket.on(event, handler as (p: unknown) => void);
    return () => {
      socket.off(event, handler as (p: unknown) => void);
      if (room) socket.emit("leave-channel", room);
    };
  }, [socket, room, event, handler]);
}

export function disconnectSocket(): void {
  sharedSocket?.disconnect();
  sharedSocket = null;
}
