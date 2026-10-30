import { z } from "zod";
import {
  dateRangeShape,
  emailSchema,
  filterText,
  paginationShape,
  phoneSchema,
  refineDateRange,
  requiredText,
  searchSchema,
  sortOrderSchema,
} from "./common.validator.js";

export const DOCTOR_SORT_FIELDS = ["createdAt", "name", "specialization", "hospital"];

const doctorFields = {
  name: requiredText("Name", { min: 2, max: 100 }),
  specialization: requiredText("Specialization", { max: 100 }),
  hospital: requiredText("Hospital", { max: 150 }),
  phone: phoneSchema,
  email: emailSchema,
};

export const createDoctorSchema = z.object(doctorFields).strict();

/** PATCH: every field optional, at least one required, unknown fields rejected. */
export const updateDoctorSchema = z
  .object(doctorFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export const listDoctorsQuerySchema = z
  .object({
    ...paginationShape,
    search: searchSchema,
    specialization: filterText(100),
    hospital: filterText(150),
    ...dateRangeShape,
    sortBy: z.enum(DOCTOR_SORT_FIELDS).default("createdAt"),
    sortOrder: sortOrderSchema,
  })
  .strict()
  .superRefine(refineDateRange);
