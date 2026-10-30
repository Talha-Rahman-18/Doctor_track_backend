import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../utils/ApiError.js";
import { buildPagination } from "../utils/pagination.js";
import { buildDateRange, buildPrefixRegex, buildSort, escapeRegex, toSearchTokens } from "../utils/queryFilters.js";
import { validate } from "../middleware/validate.middleware.js";
import { loginSchema } from "../validators/auth.validator.js";
import { createDoctorSchema, listDoctorsQuerySchema, updateDoctorSchema } from "../validators/doctor.validator.js";
import { createPatientSchema, updatePatientSchema } from "../validators/patient.validator.js";
import { isAdmin } from "../middleware/isAdmin.middleware.js";

describe("validators", () => {
  it("normalises login email", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Example.COM ", password: "x" });
    expect(parsed.email).toBe("admin@example.com");
  });

  it("normalises doctor phone/email and rejects unknown keys", () => {
    const parsed = createDoctorSchema.parse({
      name: " Amina   Rahman ",
      specialization: "Cardiology",
      hospital: "Riverside",
      phone: "+1 (555) 010-0100",
      email: "A@B.org",
    });
    expect(parsed).toMatchObject({ name: "Amina Rahman", phone: "+15550100100", email: "a@b.org" });
    expect(createDoctorSchema.safeParse({ ...parsed, role: "admin" }).success).toBe(false);
  });

  it("rejects an empty doctor PATCH and invalid phone", () => {
    expect(updateDoctorSchema.safeParse({}).success).toBe(false);
    expect(updateDoctorSchema.safeParse({ phone: "abc" }).success).toBe(false);
  });

  it("enforces patient age range and blocks doctor in create body", () => {
    const base = { name: "Alex Carter", age: 30, gender: "male", phone: "+15550200001", condition: "Asthma" };
    expect(createPatientSchema.safeParse(base).success).toBe(true);
    expect(createPatientSchema.safeParse({ ...base, age: 121 }).success).toBe(false);
    expect(createPatientSchema.safeParse({ ...base, age: 30.5 }).success).toBe(false);
    expect(createPatientSchema.safeParse({ ...base, doctor: "507f1f77bcf86cd799439011" }).success).toBe(false);
    expect(updatePatientSchema.safeParse({ doctor: "not-an-id" }).success).toBe(false);
  });

  it("applies pagination defaults and rejects bad query input", () => {
    expect(listDoctorsQuerySchema.parse({})).toMatchObject({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
    expect(listDoctorsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listDoctorsQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(listDoctorsQuerySchema.safeParse({ sortBy: "$where" }).success).toBe(false);
    expect(listDoctorsQuerySchema.safeParse({ startDate: "2026-02-31" }).success).toBe(false);
    expect(listDoctorsQuerySchema.safeParse({ startDate: "2026-03-02", endDate: "2026-03-01" }).success).toBe(false);
    expect(listDoctorsQuerySchema.safeParse({ unknown: "1" }).success).toBe(false);
  });
});

describe("query helpers", () => {
  it("escapes regex metacharacters and anchors the search", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    const re = buildPrefixRegex("Dr. (Test)");
    expect(re.test("dr. (test) smith")).toBe(true);
    expect(re.test("xdr. (test)")).toBe(false);
  });

  it("tokenises names for any-word prefix search", () => {
    expect(toSearchTokens("Sara  Khan-Lopez")).toEqual(["sara", "khan", "lopez"]);
  });

  it("builds an inclusive end-date range", () => {
    const range = buildDateRange("2026-01-01", "2026-01-31");
    expect(range.$gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.$lt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(buildDateRange()).toBeUndefined();
  });

  it("only allows allow-listed sort fields", () => {
    expect(buildSort("name", "asc", { name: "nameLower" })).toEqual({ nameLower: 1, _id: 1 });
    expect(() => buildSort("password", "asc", { name: "nameLower" })).toThrow(ApiError);
  });

  it("computes pagination metadata, including empty results", () => {
    expect(buildPagination({ page: 2, limit: 10, total: 25 })).toMatchObject({ totalPages: 3, hasNextPage: true, hasPreviousPage: true });
    expect(buildPagination({ page: 1, limit: 10, total: 0 })).toMatchObject({ totalPages: 0, hasNextPage: false, hasPreviousPage: false });
  });
});

describe("middleware", () => {
  it("validate() exposes parsed data and reports field errors", () => {
    const next = vi.fn();
    const ok = { body: { email: "A@b.org", password: "x" } };
    validate({ body: loginSchema })(ok, {}, next);
    expect(ok.validated.body.email).toBe("a@b.org");
    expect(next).toHaveBeenCalledWith();

    const bad = { body: { email: "nope", password: "" } };
    validate({ body: loginSchema })(bad, {}, next);
    const error = next.mock.calls.at(-1)[0];
    expect(error.statusCode).toBe(400);
    expect(error.errors.map((e) => e.field)).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("isAdmin never treats a missing user as an administrator", () => {
    const next = vi.fn();
    isAdmin({}, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
    isAdmin({ user: { role: "viewer" } }, {}, next);
    expect(next.mock.calls[1][0].statusCode).toBe(403);
    isAdmin({ user: { role: "admin" } }, {}, next);
    expect(next.mock.calls[2][0]).toBeUndefined();
  });
});
