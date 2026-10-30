import mongoose from "mongoose";
import { collapseSpaces, toSearchKey, toSearchTokens } from "../utils/queryFilters.js";

const requiredText = (max, extra = {}) => ({
  type: String,
  required: true,
  trim: true,
  maxlength: max,
  set: collapseSpaces,
  ...extra,
});

const doctorSchema = new mongoose.Schema(
  {
    name: requiredText(100, { minlength: 2 }),
    specialization: requiredText(100),
    hospital: requiredText(150),
    phone: { type: String, required: true, trim: true, maxlength: 16 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // Derived search fields (see docs/architecture.md, "Search strategy")
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

// The service layer updates via doc.save(), so this hook keeps derived fields in sync.
doctorSchema.pre("validate", function syncSearchFields() {
  if (this.isNew || this.isModified("name")) {
    this.nameLower = toSearchKey(this.name);
    this.nameTokens = toSearchTokens(this.name);
  }
});

// Unique identifier + prefix search on email.
doctorSchema.index({ email: 1 }, { unique: true });
// Name prefix search and sort-by-name.
doctorSchema.index({ nameLower: 1 });
// Prefix search on any word of the name (multikey).
doctorSchema.index({ nameTokens: 1 });
// Default listing order + date-range filtering.
doctorSchema.index({ createdAt: -1 });
// Filter by specialization/hospital while sorting newest first. Each also serves
// sort-by-specialization / sort-by-hospital through its leading key.
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });

export const Doctor = mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema);
