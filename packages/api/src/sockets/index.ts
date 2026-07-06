import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { redisClient } from "../config/redis";
import { query } from "../config/database";
import { allowedOrigins, env } from "../config/env";
import type { JwtAccessPayload } from "../types";
import type { SubscriptionPlan, UserRole } from "@apex/shared";

export interface SocketUser {
  id: string;
  role: UserRole;
  plan: SubscriptionPlan;
}

// Room name helpers — keep naming consistent across the app.
export const rooms = {
  channel: (id: string) => `channel:${id}`,
  watchParty: (id: string) => `watch-party:${id}`,
  user: (id: string) => `user:${id}`,
  admin: () => "admin",
};

let io: Server | null = null;

/**
 * Adjust a channel's concurrent-viewer count in Redis, persist it to
 * channels.viewer_count, and broadcast the new count to the channel room.
 * (Previously viewer_count was never updated — analytics read 0 everywhere.)
 */
async function adjustViewers(channelId: string, delta: number): Promise<void> {
  const key = `viewers:channel:${channelId}`;
  let count = await redisClient.incrby(key, delta);
  if (count < 0) {
    count = 0;
    await redisClient.set(key, "0");
  }
  await query("UPDATE channels SET viewer_count = $1 WHERE id = $2", [
    count,
    channelId,
  ]).catch(() => undefined);
  io?.to(rooms.channel(channelId)).emit("viewer-count", { channelId, count });
}

export function initSockets(server: HttpServer): Server {
  const pubClient = redisClient;
  const subClient = redisClient.duplicate();

  io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    adapter: createAdapter(pubClient, subClient),
  });

  // Auth handshake: token supplied via socket.handshake.auth.token.
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = jwt.verify(
        token,
        env.JWT_ACCESS_SECRET
      ) as JwtAccessPayload;
      const user: SocketUser = {
        id: payload.sub,
        role: payload.role,
        plan: payload.plan,
      };
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    // Every user auto-joins their personal room for targeted events.
    socket.join(rooms.user(user.id));
    if (["super_admin", "moderator", "channel_manager"].includes(user.role)) {
      socket.join(rooms.admin());
    }

    // Track which channels this socket is watching so we can decrement the
    // live viewer count on leave/disconnect.
    const joinedChannels = new Set<string>();

    socket.on("join-channel", (channelId: string) => {
      socket.join(rooms.channel(channelId));
      if (!joinedChannels.has(channelId)) {
        joinedChannels.add(channelId);
        void adjustViewers(channelId, 1);
      }
    });
    socket.on("leave-channel", (channelId: string) => {
      socket.leave(rooms.channel(channelId));
      if (joinedChannels.delete(channelId)) {
        void adjustViewers(channelId, -1);
      }
    });
    socket.on("disconnect", () => {
      for (const channelId of joinedChannels) {
        void adjustViewers(channelId, -1);
      }
      joinedChannels.clear();
    });
    socket.on("join-watch-party", (partyId: string) =>
      socket.join(rooms.watchParty(partyId))
    );
    socket.on("leave-watch-party", (partyId: string) =>
      socket.leave(rooms.watchParty(partyId))
    );
  });

  return io;
}

/** Access the initialised Socket.io server elsewhere (throws if not booted). */
export function getIo(): Server {
  if (!io) throw new Error("Socket.io not initialised");
  return io;
}
