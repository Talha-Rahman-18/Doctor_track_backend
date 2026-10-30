import { z } from "zod";
import { emailSchema } from "./common.validator.js";

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ error: "Password is required" })
      .min(1, "Password is required")
      .max(128, "Password must be at most 128 characters"),
  })
  .strict();
