import mongoose from "mongoose";
import { collapseSpaces, toSearchKey, toSearchTokens } from "../utils/queryFilters.js";

export const GENDERS = Object.freeze(["male", "female", "other"]);

const capitalizeFirst = (value) => {
  const collapsed = collapseSpaces(value);
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
};

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100, set: collapseSpaces },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    age: { type: Number, required: true, min: 0, max: 120, validate: Number.isInteger },
    gender: { type: String, enum: GENDERS, required: true },
    phone: { type: String, required: true, trim: true, maxlength: 16 },
    // Free text, first letter capitalised so "diabetes" and "Diabetes" share one filter value.
    condition: { type: String, required: true, trim: true, maxlength: 100, set: capitalizeFirst },
    // Sensitive free text: excluded from list projections and never logged.
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    nameLower: { type: String, select: false },
    nameTokens: { type: [String], select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.nameLower;
        delete ret.nameTokens;
        delete ret.__v;
        return ret;
      },
    },
  },
);

patientSchema.pre("validate", function syncSearchFields() {
  if (this.isNew || this.isModified("name")) {
    this.nameLower = toSearchKey(this.name);
    this.nameTokens = toSearchTokens(this.name);
  }
});

// Doctor-scoped listing (newest first) and the patients-per-doctor aggregation.
// Its `doctor` prefix also serves plain `{ doctor }` lookups, so no separate doctor index is needed.
patientSchema.index({ doctor: 1, createdAt: -1 });
// Global listing order + date-range filtering.
patientSchema.index({ createdAt: -1 });
// Condition filter + analytics grouping by condition.
patientSchema.index({ condition: 1, createdAt: -1 });
// Name prefix search / sort-by-name, and any-word prefix search.
patientSchema.index({ nameLower: 1 });
patientSchema.index({ nameTokens: 1 });

export const Patient = mongoose.models.Patient || mongoose.model("Patient", patientSchema);
