import morgan from "morgan";
import { env } from "../config/env";

/** HTTP request logger. Concise in prod, colored dev output otherwise. */
export const requestLogger = morgan(
  env.NODE_ENV === "production" ? "combined" : "dev",
  {
    skip: (req) => req.url === "/health",
  }
);
