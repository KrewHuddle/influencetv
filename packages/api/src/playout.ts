import { assertDbConnection } from "./config/database";
import { playoutManager } from "./services/PlayoutManager";

// Runs on the streaming EC2. Connects to the shared DB/Redis and drives
// FFmpeg playout for every active channel. now-playing is published to Redis
// (the API reads it); Socket.io emits are best-effort from this process.
async function main(): Promise<void> {
  await assertDbConnection();
  await playoutManager.startAll();
  // eslint-disable-next-line no-console
  console.log("📺 Playout manager started:", playoutManager.getStatus());

  const shutdown = async () => {
    const status = playoutManager.getStatus();
    await Promise.all(status.map((s) => playoutManager.stopChannel(s.channelId)));
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Playout boot failed:", err);
  process.exit(1);
});
