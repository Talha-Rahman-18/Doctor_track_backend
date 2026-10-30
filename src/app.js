import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { pinoHttp } from "pino-http";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { csrfProtection } from "./middleware/csrf.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFound } from "./middleware/notFound.middleware.js";
import { generalLimiter } from "./middleware/rateLimit.middleware.js";
import routes from "./routes/index.js";
import { logger } from "./utils/logger.js";
import authRouter from './routes/auth.routes.js'


export function createApp() {
  const app = express();

   app.disable("x-powered-by");
 
  app.set("trust proxy", env.TRUST_PROXY);

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
    // methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With"] // <-- Added X-Requested-With here
}));


  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

 

  // Logs method, path (no query string, which may hold patient search terms), status and timing only.
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, path: req.url?.split("?")[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );


  

  app.use("/api/v1", generalLimiter, routes);

  // app.use("/api/v1/auth", authRouter);


  app.get("/health", (_req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    res.status(dbReady ? 200 : 503).json({ success: dbReady, status: dbReady ? "ok" : "database unavailable" });
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
