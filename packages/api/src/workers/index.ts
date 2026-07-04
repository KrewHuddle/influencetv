import { assertDbConnection } from "../config/database";
import { startTranscodeWorker } from "./transcodeWorker";
import { startFlashSaleWorker } from "./flashSaleWorker";

async function main(): Promise<void> {
  await assertDbConnection();
  startTranscodeWorker();
  startFlashSaleWorker();
  // eslint-disable-next-line no-console
  console.log("👷 Apex workers running.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Worker boot failed:", err);
  process.exit(1);
});
