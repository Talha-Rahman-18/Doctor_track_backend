import { ROLES } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";

/** Generic role gate so new roles can be added without touching routes. */
export const requireRole =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };

export const isAdmin = requireRole(ROLES.ADMIN);
