import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const bool = z.enum(["true", "false"]).transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  MONGODB_URI: z
    .string({ error: "MONGODB_URI is required" })
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://"),

  JWT_SECRET: z
    .string({ error: "JWT_SECRET is required" })
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z
    .string({ error: "JWT_EXPIRES_IN is required" })
    .regex(/^\d+[smhd]$/, "JWT_EXPIRES_IN must look like 30m, 12h or 7d"),
  COOKIE_NAME: z.string().min(1).default("dt_token"),
  COOKIE_SECURE: bool.optional(),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  CLIENT_URL: z.string().default("http://localhost:3000"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).default(10),
  RATE_LIMIT_ANALYTICS_MAX: z.coerce.number().int().min(1).default(60),

  ADMIN_NAME: z.string().trim().min(2).max(80).optional(),
  ADMIN_EMAIL: z.string().trim().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Copy server/.env.example to server/.env and fix:\n${details}`,
    );
  }

  const raw = parsed.data;
  const isProduction = raw.NODE_ENV === "production";
  const cookieSecure = raw.COOKIE_SECURE ?? isProduction;

  if (isProduction && !cookieSecure) {
    throw new Error("COOKIE_SECURE must be true when NODE_ENV=production");
  }
  if (raw.COOKIE_SAME_SITE === "none" && !cookieSecure) {
    throw new Error("COOKIE_SAME_SITE=none requires COOKIE_SECURE=true");
  }
  if (isProduction && raw.JWT_SECRET.startsWith("replace_with")) {
    throw new Error("JWT_SECRET is still the example placeholder. Set a real secret before running in production.");
  }

  const clientOrigins = raw.CLIENT_URL.split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return Object.freeze({
    ...raw,
    isProduction,
    isTest: raw.NODE_ENV === "test",
    cookieSecure,
    clientOrigins,
  });
}

export const env = loadEnv();
