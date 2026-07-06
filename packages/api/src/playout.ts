import { assertDbConnection } from "./config/database";
import { playoutManager } from "./services/PlayoutManager";

// Runs on the streaming server. Connects to the shared DB/Redis and drives
// FFmpeg playout for every active channel. now-playing is published to Redis
// (the API reads it); Socket.io emits are best-effort from this process.
// A Redis control plane lets the API start/stop/restart/kill channels, and
// heartbeats + a supervisor keep playout self-healing.
async function main(): Promise<void> {
  await assertDbConnection();
  await playoutManager.startAll();
  await playoutManager.listenForControl();
  playoutManager.startHeartbeat();
  playoutManager.startSupervisor();
  // eslint-disable-next-line no-console
  console.log("📺 Playout manager started:", playoutManager.getStatus());

  const shutdown = async () => {
    await playoutManager.shutdown();
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
