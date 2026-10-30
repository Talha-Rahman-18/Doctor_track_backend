import pino from "pino";
import { env } from "../config/env.js";

// Request bodies, cookies and auth headers are never logged. `redact` is a second line of defence
// in case a developer logs a request/response object by mistake.
export const logger = pino({
  level: env.isTest ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[redacted]",
  },
  transport:
    !env.isProduction && !env.isTest
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
});
