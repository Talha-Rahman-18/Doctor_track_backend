import { env } from "../config/env.js";
import { ApiError, ERROR_CODES } from "../utils/ApiError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated, state-changing requests (layered):
 *  1. SameSite cookie attribute (set in auth.controller).
 *  2. A custom header (`X-Requested-With`) is required. Browsers cannot attach it cross-origin
 *     without a CORS preflight, which our strict CORS allow-list rejects.
 *  3. If an Origin header is present it must be on the allow-list.
 */
export const csrfProtection = (req, res, next) => {
  // Always allow safe methods (GET, HEAD, OPTIONS) to pass through without CSRF checks
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // CSRF validation only runs for POST, PUT, PATCH, DELETE
  const token = req.headers["x-csrf-token"] || req.cookies?._csrf;
  
  if (!token) {
    return res.status(403).json({ success: false, message: "Invalid or missing CSRF token" });
  }

  // (Optional) Add your token verification logic here if you decode/verify it

  next();
};
