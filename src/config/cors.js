import { env } from "./env.js";

export const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (curl, server-to-server, same-origin) are allowed.
    if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Requested-With"],
  maxAge: 600,
};
