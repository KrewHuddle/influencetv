import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { allowedOrigins, env } from "./config/env";
import { assertDbConnection, isDbConnected } from "./config/database";
import { isRedisConnected } from "./config/redis";
import { requestLogger } from "./middleware/requestLogger";
import { globalLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import { initSockets } from "./sockets";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import streamRoutes from "./routes/streams";
import scheduleRoutes from "./routes/schedule";
import uploadRoutes from "./routes/uploads";
import subscriptionRoutes from "./routes/subscriptions";
import webhookRoutes from "./routes/webhooks";
import creatorRoutes from "./routes/creators";
import shopRoutes from "./routes/shop";
import patronRoutes from "./routes/patrons";
import communityRoutes from "./routes/community";
import videoRoutes from "./routes/videos";
import watchPartyRoutes from "./routes/watchParties";
import adminRoutes from "./routes/admin";
import liveShopRoutes from "./routes/liveShops";
import channelRoutes from "./routes/channels";
import browseRoutes from "./routes/browse";
import adRoutes from "./routes/ads";
import courseRoutes from "./routes/courses";

async function bootstrap(): Promise<void> {
  await assertDbConnection();

  const app = express();
  const server = http.createServer(app);

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  // Stripe webhooks need the raw body for signature verification — mount
  // BEFORE the JSON body parser.
  app.use("/api/webhooks", webhookRoutes);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(globalLimiter);

  app.get("/health", async (_req, res) => {
    const [dbConnected, redisConnected] = await Promise.all([
      isDbConnected(),
      isRedisConnected(),
    ]);
    res.status(dbConnected && redisConnected ? 200 : 503).json({
      status: dbConnected && redisConnected ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      dbConnected,
      redisConnected,
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/streams", streamRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/subscriptions", subscriptionRoutes);
  app.use("/api/creators", creatorRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/patrons", patronRoutes);
  app.use("/api/community", communityRoutes);
  app.use("/api/communities", communityRoutes); // web calls the plural form
  app.use("/api/videos", videoRoutes);
  app.use("/api/watch-parties", watchPartyRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/channels", channelRoutes);
  app.use("/api/browse", browseRoutes);
  app.use("/api/ads", adRoutes);
  app.use("/api/courses", courseRoutes);
  // liveShops + schedule use full /api/* paths (live-shops, channels/:id/schedule,
  // channels/:id/now-playing, flash-sales). Mounted AFTER /api/channels so the
  // list/guide/slug routes win; the :id/* sub-paths fall through to here.
  app.use("/api", liveShopRoutes);
  app.use("/api", scheduleRoutes);

  app.use(errorHandler);

  initSockets(server);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Apex API listening on :${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal boot error:", err);
  process.exit(1);
});
