import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { Doctor } from "../models/Doctor.model.js";
import { Patient } from "../models/Patient.model.js";
import { User } from "../models/User.model.js";
import { hashPassword } from "../services/auth.service.js";

export const ADMIN = { name: "Test Admin", email: "admin@example.com", password: "Sup3r-secret-pass!" };

let memoryServer;
let testDbName;

/**
 * Safe test database strategy:
 *  - default: an isolated in-memory MongoDB (mongodb-memory-server);
 *  - or set TEST_MONGODB_URI to a throw-away server. A uniquely named database is created
 *    and dropped, so no existing database is ever touched.
 */
export async function setupDb() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  testDbName = `doctor_tracker_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await mongoose.connect(uri, { dbName: testDbName });
  await Promise.all([User.init(), Doctor.init(), Patient.init()]); // build unique indexes before tests
}

export async function teardownDb() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === testDbName) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  await memoryServer?.stop();
}

export async function resetDb() {
  await Promise.all([User.deleteMany({}), Doctor.deleteMany({}), Patient.deleteMany({})]);
}

export async function createAdminUser(overrides = {}) {
  const { password, ...rest } = { ...ADMIN, ...overrides };
  return User.create({ ...rest, passwordHash: await hashPassword(password), role: "admin" });
}

/** Returns a supertest agent that carries the session cookie and the CSRF header. */
export async function loginAgent(app, credentials = ADMIN) {
  const agent = request.agent(app).set("X-Requested-With", "XMLHttpRequest");
  const res = await agent.post("/api/v1/auth/login").send({ email: credentials.email, password: credentials.password });
  if (res.status !== 200) throw new Error(`Test login failed with ${res.status}`);
  return agent;
}

export const anonymous = (app) => request.agent(app).set("X-Requested-With", "XMLHttpRequest");

export const doctorPayload = (overrides = {}) => ({
  name: "Amina Rahman",
  specialization: "Cardiology",
  hospital: "Riverside General Hospital",
  phone: "+1 (555) 010-0100",
  email: "Amina.Rahman@Example.org",
  ...overrides,
});

export const patientPayload = (overrides = {}) => ({
  name: "Alex Carter",
  age: 42,
  gender: "male",
  phone: "+15550200001",
  condition: "hypertension",
  notes: "Fictional record",
  ...overrides,
});

export async function seedDoctor(overrides = {}) {
  // Inserted straight through the model, so values must already be in normalised form.
  return Doctor.create({ ...doctorPayload(), phone: "+15550100100", ...overrides });
}

export async function seedPatient(doctorId, overrides = {}) {
  return Patient.create({ ...patientPayload(), doctor: doctorId, ...overrides });
}
