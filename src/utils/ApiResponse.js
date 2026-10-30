export function sendSuccess(res, { statusCode = 200, message = "OK", data, pagination } = {}) {
  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
}

export function sendNoContent(res) {
  return res.status(204).send();
}
