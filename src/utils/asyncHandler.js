// Express 5 already forwards rejected promises, but wrapping keeps the behaviour explicit
// and safe if the code is ever run on Express 4.
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
