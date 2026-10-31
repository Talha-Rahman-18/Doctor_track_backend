import mongoose from "mongoose";

export const ROLES = Object.freeze({ ADMIN: "admin" });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.ADMIN,
      required: true,
    },
    isActive: { type: Boolean, default: true },
    token: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Login looks users up by email only; this unique index also enforces one account per email.
userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
