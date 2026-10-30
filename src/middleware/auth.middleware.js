import { env } from "../config/env.js";
import { User } from "../models/User.model.js";
import { verifyToken } from "../services/auth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Authenticates the request from the HTTP-only cookie. The role and active flag are always
 * re-read from the database, so a disabled or demoted user loses access immediately
 * instead of when the token expires.
 */
export const authMiddleware = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) throw ApiError.unauthorized();

  const claims = verifyToken(token); // throws ApiError(401) for bad signature / expiry / claims

  const user = await User.findById(claims.sub).select("name email role isActive").lean().maxTimeMS(5000);
  if (!user || !user.isActive) throw ApiError.unauthorized("Your session is no longer valid");

  req.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
  next();
});
