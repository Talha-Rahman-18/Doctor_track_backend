import { ApiError } from "../utils/ApiError.js";

function formatIssues(issues) {
  return issues.map((issue) => {
    if (issue.code === "unrecognized_keys") {
      return { field: issue.keys.join(", "), message: `Unexpected field: ${issue.keys.join(", ")}` };
    }
    return { field: issue.path.join("."), message: issue.message };
  });
}

/**
 * validate({ body, query, params }) parses each request source with its Zod schema and exposes
 * the parsed (coerced, normalised, unknown-key-free) result on `req.validated`.
 * Express 5 makes `req.query` read-only, so controllers must read from `req.validated`.
 */
export const validate = (schemas) => (req, _res, next) => {
  const validated = {};
  const errors = [];

  for (const source of ["params", "query", "body"]) {
    const schema = schemas[source];
    if (!schema) continue;
    const result = schema.safeParse(req[source] ?? {});
    if (result.success) validated[source] = result.data;
    else errors.push(...formatIssues(result.error.issues));
  }

  if (errors.length) return next(ApiError.badRequest("Validation failed", errors));
  req.validated = validated;
  return next();
};
