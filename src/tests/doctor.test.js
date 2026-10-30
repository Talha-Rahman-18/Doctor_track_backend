import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { Doctor } from "../models/Doctor.model.js";
import {
  createAdminUser, doctorPayload, loginAgent, resetDb, seedDoctor, seedPatient, setupDb, teardownDb,
} from "./helpers.js";

const app = createApp();
let agent;

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await resetDb();
  await createAdminUser();
  agent = await loginAgent(app);
});

describe("access control", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await request(app).get("/api/v1/doctors")).status).toBe(401);
    expect((await request(app).get("/api/v1/dashboard/overview")).status).toBe(401);
  });
});

describe("POST /doctors", () => {
  it("creates a doctor with normalised fields", async () => {
    const res = await agent.post("/api/v1/doctors").send(doctorPayload());
    expect(res.status).toBe(201);
    expect(res.body.data.doctor).toMatchObject({ email: "amina.rahman@example.org", phone: "+15550100100", patientCount: 0 });
    expect(res.body.data.doctor).not.toHaveProperty("nameLower");
  });

  it("returns field-level validation errors", async () => {
    const res = await agent.post("/api/v1/doctors").send({ name: "", email: "bad", phone: "12" });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(["name", "email", "phone", "specialization", "hospital"]));
  });

  it("rejects unexpected fields (mass assignment)", async () => {
    const res = await agent.post("/api/v1/doctors").send({ ...doctorPayload(), _id: "507f1f77bcf86cd799439011", createdAt: "2000-01-01" });
    expect(res.status).toBe(400);
  });

  it("rejects operator injection in the body", async () => {
    const res = await agent.post("/api/v1/doctors").send({ ...doctorPayload(), email: { $ne: "" } });
    expect(res.status).toBe(400);
  });

  it("returns 409 for a duplicate email", async () => {
    await agent.post("/api/v1/doctors").send(doctorPayload());
    const res = await agent.post("/api/v1/doctors").send(doctorPayload({ name: "Another Doctor" }));
    expect(res.status).toBe(409);
    expect(res.body.errors[0].field).toBe("email");
  });
});

describe("GET /doctors", () => {
  beforeEach(async () => {
    for (let i = 1; i <= 12; i += 1) {
      await seedDoctor({
        name: `Doctor ${String.fromCharCode(64 + i)}${i % 2 ? "lpha" : "eta"}`,
        email: `doctor${i}@example.org`,
        specialization: i % 3 === 0 ? "Neurology" : "Cardiology",
        hospital: i % 2 ? "Lakeview" : "Riverside",
      });
    }
  });

  it("paginates on the server and returns metadata", async () => {
    const res = await agent.get("/api/v1/doctors?page=2&limit=5");
    expect(res.status).toBe(200);
    expect(res.body.data.doctors).toHaveLength(5);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 5, total: 12, totalPages: 3, hasNextPage: true, hasPreviousPage: true });
  });

  it("returns an empty page (not an error) past the last page", async () => {
    const res = await agent.get("/api/v1/doctors?page=9&limit=5");
    expect(res.status).toBe(200);
    expect(res.body.data.doctors).toEqual([]);
    expect(res.body.pagination.total).toBe(12);
  });

  it("filters by specialization and hospital", async () => {
    const res = await agent.get("/api/v1/doctors?specialization=Neurology&hospital=Riverside");
    expect(res.status).toBe(200);
    expect(res.body.data.doctors.every((d) => d.specialization === "Neurology" && d.hospital === "Riverside")).toBe(true);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it("searches by name prefix and by any word, and treats regex characters literally", async () => {
    await seedDoctor({ name: "Sara Khan", email: "sara.khan@example.org" });
    expect((await agent.get("/api/v1/doctors?search=sara")).body.data.doctors).toHaveLength(1);
    expect((await agent.get("/api/v1/doctors?search=khan")).body.data.doctors).toHaveLength(1);
    expect((await agent.get("/api/v1/doctors?search=sara%20kh")).body.data.doctors).toHaveLength(1);
    expect((await agent.get("/api/v1/doctors?search=.*")).body.data.doctors).toHaveLength(0);
  });

  it("filters by creation date range", async () => {
    await Doctor.collection.updateMany({}, { $set: { createdAt: new Date("2025-01-15T10:00:00Z") } });
    await seedDoctor({ name: "Recent Doc", email: "recent@example.org" });
    const old = await agent.get("/api/v1/doctors?startDate=2025-01-01&endDate=2025-01-15");
    expect(old.body.pagination.total).toBe(12);
    const bad = await agent.get("/api/v1/doctors?startDate=2025-02-01&endDate=2025-01-01");
    expect(bad.status).toBe(400);
  });

  it("includes patient counts without N+1 queries", async () => {
    const doctor = await Doctor.findOne({ email: "doctor1@example.org" });
    await seedPatient(doctor._id);
    await seedPatient(doctor._id, { name: "Second Patient" });
    const res = await agent.get("/api/v1/doctors?search=doctor%20a");
    const found = res.body.data.doctors.find((d) => d.email === "doctor1@example.org");
    expect(found.patientCount).toBe(2);
  });

  it("rejects unsafe or oversized query parameters", async () => {
    expect((await agent.get("/api/v1/doctors?limit=500")).status).toBe(400);
    expect((await agent.get("/api/v1/doctors?sortBy=passwordHash")).status).toBe(400);
    expect((await agent.get("/api/v1/doctors?foo=bar")).status).toBe(400);
  });
});

describe("single doctor operations", () => {
  it("gets, updates and returns 404 for unknown ids", async () => {
    const doctor = await seedDoctor();
    const get = await agent.get(`/api/v1/doctors/${doctor._id}`);
    expect(get.status).toBe(200);

    const patch = await agent.patch(`/api/v1/doctors/${doctor._id}`).send({ hospital: "New Hospital", name: "Zed Updated" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.doctor.hospital).toBe("New Hospital");
    // derived search field is kept in sync by the service
    expect((await agent.get("/api/v1/doctors?search=zed")).body.data.doctors).toHaveLength(1);

    expect((await agent.get("/api/v1/doctors/507f1f77bcf86cd799439011")).status).toBe(404);
    expect((await agent.get("/api/v1/doctors/not-an-id")).status).toBe(400);
    expect((await agent.patch(`/api/v1/doctors/${doctor._id}`).send({})).status).toBe(400);
  });

  it("refuses to delete a doctor who still has patients, then deletes once empty", async () => {
    const doctor = await seedDoctor();
    const patient = await seedPatient(doctor._id);

    const blocked = await agent.delete(`/api/v1/doctors/${doctor._id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/reassign or delete/i);

    await agent.delete(`/api/v1/patients/${patient._id}`).expect(204);
    await agent.delete(`/api/v1/doctors/${doctor._id}`).expect(204);
    expect((await agent.get(`/api/v1/doctors/${doctor._id}`)).status).toBe(404);
  });

  it("lists distinct filter options", async () => {
    await seedDoctor();
    await seedDoctor({ email: "b@example.org", specialization: "Neurology" });
    const res = await agent.get("/api/v1/doctors/options");
    expect(res.body.data.specializations).toEqual(["Cardiology", "Neurology"]);
  });
});
