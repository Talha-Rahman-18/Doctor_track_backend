import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../utils/pagination.js";

export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid identifier");

export const idParamSchema = z.object({ id: objectIdSchema }).strict();

/**
 * Phone policy (documented in docs/api-reference.md): spaces, dashes, dots and brackets are
 * stripped, then 8-15 digits with an optional leading "+" must remain. Stored without separators.
 */
export const phoneSchema = z
  .string({ error: "Phone is required" })
  .trim()
  .transform((value) => value.replace(/[\s\-().]/g, ""))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "Enter a valid phone number (8-15 digits, optional leading +)"));

export const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254, "Email must be at most 254 characters")
  .pipe(z.email("Enter a valid email address"));

export const requiredText = (label, { min = 1, max = 100 } = {}) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Enter a valid calendar date");

export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

export const paginationShape = {
  page: z.coerce.number().int().min(1, "page must be 1 or greater").max(100_000).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit must be 1 or greater")
    .max(MAX_PAGE_SIZE, `limit must be ${MAX_PAGE_SIZE} or less`)
    .default(DEFAULT_PAGE_SIZE),
};

/** Empty strings are treated as "no search" so the UI can submit a cleared box safely. */
export const searchSchema = z
  .string()
  .trim()
  .max(50, "Search must be at most 50 characters")
  .transform((value) => value.replace(/\s+/g, " ") || undefined)
  .optional();

export const filterText = (max = 100) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

export const dateRangeShape = {
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
};

/** Reusable `superRefine` that rejects start > end. */
export function refineDateRange(value, ctx) {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["startDate"],
      message: "Start date must be on or before the end date",
    });
  }
}
