import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// NOTE: express-rate-limit's default MemoryStore is per process. Behind several instances,
// pass `store: new RedisStore(...)` (rate-limit-redis) so counters are shared.
function createLimiter({ max, windowMs = env.RATE_LIMIT_WINDOW_MS, ...options }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.tooManyRequests()),
    ...options,
  });
}

export const generalLimiter = createLimiter({ max: env.RATE_LIMIT_GENERAL_MAX });

/**
 * Failed-login throttle. Keyed by client IP only (not by email), so an attacker cannot lock a
 * real administrator out by hammering their address from elsewhere. Successful logins are not counted.
 */
export const loginLimiter = createLimiter({
  max: env.RATE_LIMIT_LOGIN_MAX,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
});

export const analyticsLimiter = createLimiter({ max: env.RATE_LIMIT_ANALYTICS_MAX, windowMs: 60 * 1000 });
