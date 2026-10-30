import { env } from "../config/env.js";
import * as authService from "../services/auth.service.js";
import { sendSuccess } from "../utils/ApiResponse.js";

// Same attributes must be used to set and to clear the cookie, otherwise browsers keep it.
const cookieBase = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.COOKIE_SAME_SITE,
  path: "/",
});

export async function login(req, res) {
  const user = await authService.authenticate(req.validated.body);
  const { token, expiresAt } = authService.signToken(user);

  res.cookie(env.COOKIE_NAME, token, { ...cookieBase(), expires: expiresAt });
  return sendSuccess(res, { message: "Logged in successfully", data: { user } });
}

export function logout(_req, res) {
  res.clearCookie(env.COOKIE_NAME, cookieBase());
  return sendSuccess(res, { message: "Logged out successfully" });
}

export function me(req, res) {
  return sendSuccess(res, { message: "Current user retrieved", data: { user: req.user } });
}
