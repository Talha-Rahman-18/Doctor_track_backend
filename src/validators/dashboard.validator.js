import { z } from "zod";
import { dateRangeShape, refineDateRange } from "./common.validator.js";

export const overviewQuerySchema = z.object(dateRangeShape).strict().superRefine(refineDateRange);

export const patientsPerDoctorQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(20).default(10) })
  .strict();

export const trendsQuerySchema = z
  .object({ ...dateRangeShape, interval: z.enum(["day", "month"]).default("day") })
  .strict()
  .superRefine(refineDateRange);
