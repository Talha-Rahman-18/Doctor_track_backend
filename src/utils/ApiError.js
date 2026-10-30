export const ERROR_CODES = Object.freeze({
  VALIDATION: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  CSRF: "CSRF_FAILED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL: "INTERNAL_ERROR",
});

export class ApiError extends Error {
  constructor(statusCode, message, { code, errors } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code ?? ERROR_CODES.INTERNAL;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = "Bad request", errors) {
    return new ApiError(400, message, { code: ERROR_CODES.VALIDATION, errors });
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message, { code: ERROR_CODES.UNAUTHENTICATED });
  }
  static forbidden(message = "You do not have permission to perform this action", code = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, { code });
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message, { code: ERROR_CODES.NOT_FOUND });
  }
  static conflict(message = "Conflict", errors) {
    return new ApiError(409, message, { code: ERROR_CODES.CONFLICT, errors });
  }
  static tooManyRequests(message = "Too many requests, please try again later") {
    return new ApiError(429, message, { code: ERROR_CODES.RATE_LIMITED });
  }
}
