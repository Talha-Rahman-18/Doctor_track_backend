import { env } from "../config/env.js";
import { ApiError, ERROR_CODES } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

const DUPLICATE_MESSAGES = {
  email: "An account with this email already exists",
};

function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err?.name === "ValidationError" && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest("Validation failed", errors);
  }
  if (err?.name === "CastError") {
    return ApiError.badRequest(`Invalid value for ${err.path}`, [{ field: err.path, message: "Invalid value" }]);
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0] ?? "field";
    const message = DUPLICATE_MESSAGES[field] ?? `A record with this ${field} already exists`;
    return ApiError.conflict(message, [{ field, message }]);
  }
  if (["MongooseServerSelectionError", "MongoServerSelectionError", "MongoNetworkError"].includes(err?.name)) {
    return new ApiError(503, "The database is currently unavailable. Please try again shortly.", {
      code: ERROR_CODES.UNAVAILABLE,
    });
  }
  if (err?.name === "MongoServerError" && err.code === 50) {
    return new ApiError(503, "The query took too long. Try narrowing your filters.", { code: ERROR_CODES.UNAVAILABLE });
  }
  if (err?.type === "entity.too.large") {
    return new ApiError(413, "Request body is too large", { code: ERROR_CODES.VALIDATION });
  }
  if (err?.type === "entity.parse.failed") {
    return ApiError.badRequest("Malformed JSON in request body");
  }
  return null;
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by their 4-arg signature
export function errorHandler(err, req, res, _next) {
  const apiError = normalize(err);

  if (!apiError) {
    // Unexpected failure: log the full error server-side, return a generic message to the client.
    logger.error({ err, method: req.method, path: req.path }, "Unhandled error");
    const body = { success: false, message: "Something went wrong on our side", code: ERROR_CODES.INTERNAL };
    if (env.NODE_ENV === "development") body.debug = { message: err?.message, stack: err?.stack };
    return res.status(500).json(body);
  }

  if (apiError.statusCode >= 500) logger.error({ err, method: req.method, path: req.path }, "Request failed");

  const body = { success: false, message: apiError.message, code: apiError.code };
  if (apiError.errors?.length) body.errors = apiError.errors;
  return res.status(apiError.statusCode).json(body);
}
