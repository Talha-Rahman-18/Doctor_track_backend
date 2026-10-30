import { z } from "zod";
import {
  dateRangeShape,
  filterText,
  objectIdSchema,
  paginationShape,
  phoneSchema,
  refineDateRange,
  requiredText,
  searchSchema,
  sortOrderSchema,
} from "./common.validator.js";

export const PATIENT_SORT_FIELDS = ["createdAt", "name", "age", "condition"];
export const PATIENT_GENDERS = ["male", "female", "other"];

const optionalNotes = z
  .string()
  .trim()
  .max(1000, "Notes must be at most 1000 characters");

const patientFields = {
  name: requiredText("Name", { min: 2, max: 100 }),
  age: z
    .number({ error: "Age is required and must be a number" })
    .int("Age must be a whole number")
    .min(0, "Age must be 0 or greater")
    .max(120, "Age must be 120 or less"),
  gender: z.enum(PATIENT_GENDERS, { error: "Select a gender" }),
  phone: phoneSchema,
  condition: requiredText("Condition", { max: 100 }),
  notes: optionalNotes,
};

/** The doctor comes from the URL (POST /doctors/:id/patients), never from the body. */
export const createPatientSchema = z
  .object({ ...patientFields, notes: optionalNotes.default("") })
  .strict();

/** `doctor` may be supplied on update to reassign a patient to another doctor. */
export const updatePatientSchema = z
  .object({ ...patientFields, doctor: objectIdSchema })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

const patientListShape = {
  ...paginationShape,
  search: searchSchema,
  condition: filterText(100),
  ...dateRangeShape,
  sortBy: z.enum(PATIENT_SORT_FIELDS).default("createdAt"),
  sortOrder: sortOrderSchema,
};

export const listPatientsQuerySchema = z
  .object({ ...patientListShape, doctor: objectIdSchema.optional() })
  .strict()
  .superRefine(refineDateRange);

export const listDoctorPatientsQuerySchema = z
  .object(patientListShape)
  .strict()
  .superRefine(refineDateRange);
