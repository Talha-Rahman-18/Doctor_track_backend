import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

// In production, index builds are an explicit deploy step (`npm run db:sync-indexes`)
// so that a server restart never triggers an unexpected index build on a large collection.
mongoose.set("autoIndex", !env.isProduction);
mongoose.set("strictQuery", true);

export async function connectDb(uri = env.MONGODB_URI) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info("MongoDB connected");
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
