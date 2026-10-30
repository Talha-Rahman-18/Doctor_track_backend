import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { Patient } from "../models/Patient.model.js";
import {
  createAdminUser, loginAgent, patientPayload, resetDb, seedDoctor, seedPatient, setupDb, teardownDb,
} from "./helpers.js";

const app = createApp();
let agent;
let doctor;

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await resetDb();
  await createAdminUser();
  agent = await loginAgent(app);
  doctor = await seedDoctor();
});

describe("POST /doctors/:id/patients", () => {
  it("creates a patient under the doctor and normalises the condition", async () => {
    const res = await agent.post(`/api/v1/doctors/${doctor._id}/patients`).send(patientPayload());
    expect(res.status).toBe(201);
    expect(res.body.data.patient).toMatchObject({ condition: "Hypertension", doctor: String(doctor._id), age: 42 });
  });

  it("rejects a malformed doctor id (400) and an unknown doctor (404)", async () => {
    expect((await agent.post("/api/v1/doctors/not-an-id/patients").send(patientPayload())).status).toBe(400);
    const missing = await agent.post("/api/v1/doctors/507f1f77bcf86cd799439011/patients").send(patientPayload());
    expect(missing.status).toBe(404);
    expect(await Patient.countDocuments()).toBe(0);
  });

  it("validates fields and refuses a doctor id in the body", async () => {
    const invalid = await agent.post(`/api/v1/doctors/${doctor._id}/patients`).send(patientPayload({ age: 200, condition: "" }));
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(["age", "condition"]));

    const sneaky = await agent.post(`/api/v1/doctors/${doctor._id}/patients`).send({ ...patientPayload(), doctor: "507f1f77bcf86cd799439011" });
    expect(sneaky.status).toBe(400);
  });
});

describe("GET /patients and /doctors/:id/patients", () => {
  beforeEach(async () => {
    const other = await seedDoctor({ email: "other@example.org", name: "Other Doctor" });
    await seedPatient(doctor._id, { name: "Alice Brown", condition: "Asthma", age: 30 });
    await seedPatient(doctor._id, { name: "Bob Stone", condition: "Migraine", age: 50 });
    await seedPatient(other._id, { name: "Carol Brown", condition: "Asthma", age: 41 });
  });

  it("lists patients with a populated doctor summary and without sensitive notes", async () => {
    const res = await agent.get("/api/v1/patients");
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.data.patients[0].doctor).toHaveProperty("name");
    expect(res.body.data.patients[0]).not.toHaveProperty("notes");
  });

  it("filters by doctor, condition and search", async () => {
    expect((await agent.get(`/api/v1/patients?doctor=${doctor._id}`)).body.pagination.total).toBe(2);
    expect((await agent.get("/api/v1/patients?condition=Asthma")).body.pagination.total).toBe(2);
    expect((await agent.get("/api/v1/patients?search=brown")).body.pagination.total).toBe(2);
    expect((await agent.get("/api/v1/patients?search=zzz")).body.data.patients).toEqual([]);
  });

  it("sorts with an allow-list and paginates", async () => {
    const asc = await agent.get("/api/v1/patients?sortBy=age&sortOrder=asc&limit=2");
    expect(asc.body.data.patients.map((p) => p.age)).toEqual([30, 41]);
    expect(asc.body.pagination.hasNextPage).toBe(true);
    expect((await agent.get("/api/v1/patients?sortBy=notes")).status).toBe(400);
  });

  it("lists a doctor's own patients and 404s for an unknown doctor", async () => {
    const res = await agent.get(`/api/v1/doctors/${doctor._id}/patients`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    expect((await agent.get("/api/v1/doctors/507f1f77bcf86cd799439011/patients")).status).toBe(404);
  });

  it("returns patient options for the condition filter", async () => {
    const res = await agent.get("/api/v1/patients/options");
    expect(res.body.data.conditions).toEqual(["Asthma", "Migraine"]);
  });
});

describe("single patient operations", () => {
  it("returns details including notes, updates, reassigns and deletes", async () => {
    const patient = await seedPatient(doctor._id);
    const other = await seedDoctor({ email: "other@example.org", name: "Other Doctor" });

    const get = await agent.get(`/api/v1/patients/${patient._id}`);
    expect(get.status).toBe(200);
    expect(get.body.data.patient.notes).toBe("Fictional record");

    const patch = await agent.patch(`/api/v1/patients/${patient._id}`).send({ age: 43, condition: "diabetes" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.patient).toMatchObject({ age: 43, condition: "Diabetes" });

    const move = await agent.patch(`/api/v1/patients/${patient._id}`).send({ doctor: String(other._id) });
    expect(move.body.data.patient.doctor._id).toBe(String(other._id));

    expect((await agent.patch(`/api/v1/patients/${patient._id}`).send({ doctor: "507f1f77bcf86cd799439011" })).status).toBe(404);
    expect((await agent.patch(`/api/v1/patients/${patient._id}`).send({ age: -1 })).status).toBe(400);

    await agent.delete(`/api/v1/patients/${patient._id}`).expect(204);
    expect((await agent.get(`/api/v1/patients/${patient._id}`)).status).toBe(404);
    expect((await agent.delete(`/api/v1/patients/${patient._id}`)).status).toBe(404);
  });
});
