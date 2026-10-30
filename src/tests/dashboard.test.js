import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { Patient } from "../models/Patient.model.js";
import { createAdminUser, loginAgent, resetDb, seedDoctor, seedPatient, setupDb, teardownDb } from "./helpers.js";

const app = createApp();
let agent;

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await resetDb();
  await createAdminUser();
  agent = await loginAgent(app);
});

describe("dashboard with an empty database", () => {
  it("returns zeros instead of failing", async () => {
    const overview = await agent.get("/api/v1/dashboard/overview");
    expect(overview.status).toBe(200);
    expect(overview.body.data.totals).toEqual({ doctors: 0, patients: 0, averagePatientsPerDoctor: 0 });
    expect(overview.body.data.topConditions).toEqual([]);

    const perDoctor = await agent.get("/api/v1/dashboard/patients-per-doctor");
    expect(perDoctor.body.data.items).toEqual([]);

    const trends = await agent.get("/api/v1/dashboard/trends?startDate=2026-01-01&endDate=2026-01-05");
    expect(trends.body.data.series).toHaveLength(5);
    expect(trends.body.data.series.every((p) => p.doctors === 0 && p.patients === 0)).toBe(true);
  });
});

describe("dashboard analytics from real data", () => {
  let busy;
  beforeEach(async () => {
    busy = await seedDoctor({ name: "Busy Doctor", email: "busy@example.org" });
    const quiet = await seedDoctor({ name: "Quiet Doctor", email: "quiet@example.org" });
    await seedPatient(busy._id, { name: "P One", condition: "Asthma" });
    await seedPatient(busy._id, { name: "P Two", condition: "Asthma" });
    await seedPatient(busy._id, { name: "P Three", condition: "Migraine" });
    await seedPatient(quiet._id, { name: "P Four", condition: "Asthma" });
  });

  it("computes totals, averages and top conditions", async () => {
    const res = await agent.get("/api/v1/dashboard/overview");
    expect(res.body.data.totals).toEqual({ doctors: 2, patients: 4, averagePatientsPerDoctor: 2 });
    expect(res.body.data.inRange).toEqual({ doctors: 2, patients: 4 });
    expect(res.body.data.topConditions[0]).toEqual({ condition: "Asthma", count: 3 });
  });

  it("ranks doctors by patient count with names resolved", async () => {
    const res = await agent.get("/api/v1/dashboard/patients-per-doctor?limit=1");
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ doctorName: "Busy Doctor", patientCount: 3 });
  });

  it("buckets creation trends per day with zero-filled gaps", async () => {
    await Patient.collection.updateMany({}, { $set: { createdAt: new Date("2026-03-02T12:00:00Z") } });
    const res = await agent.get("/api/v1/dashboard/trends?startDate=2026-03-01&endDate=2026-03-03");
    const byDate = Object.fromEntries(res.body.data.series.map((p) => [p.date, p.patients]));
    expect(byDate).toEqual({ "2026-03-01": 0, "2026-03-02": 4, "2026-03-03": 0 });
  });

  it("supports monthly buckets", async () => {
    const res = await agent.get("/api/v1/dashboard/trends?interval=month&startDate=2026-01-15&endDate=2026-03-10");
    expect(res.body.data.series.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("validates ranges", async () => {
    expect((await agent.get("/api/v1/dashboard/trends?startDate=2026-03-05&endDate=2026-03-01")).status).toBe(400);
    expect((await agent.get("/api/v1/dashboard/trends?startDate=2020-01-01&endDate=2026-01-01")).status).toBe(400);
    expect((await agent.get("/api/v1/dashboard/patients-per-doctor?limit=99")).status).toBe(400);
  });
});
