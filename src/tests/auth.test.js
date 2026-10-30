import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { User } from "../models/User.model.js";
import { ADMIN, anonymous, createAdminUser, loginAgent, resetDb, setupDb, teardownDb } from "./helpers.js";

const app = createApp();

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await resetDb();
  await createAdminUser();
});

describe("POST /api/v1/auth/login", () => {
  it("logs in, sets an HTTP-only cookie and never returns the hash or token", async () => {
    const res = await anonymous(app).post("/api/v1/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: ADMIN.email, role: "admin" });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|token/i);

    const cookie = res.headers["set-cookie"].find((c) => c.startsWith("dt_token="));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
  });

  it("rejects wrong passwords and unknown emails with the same message", async () => {
    const wrongPassword = await anonymous(app).post("/api/v1/auth/login").send({ email: ADMIN.email, password: "wrong-password" });
    const unknownEmail = await anonymous(app).post("/api/v1/auth/login").send({ email: "nobody@example.com", password: "whatever" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });

  it("returns structured validation errors", async () => {
    const res = await anonymous(app).post("/api/v1/auth/login").send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("blocks disabled accounts", async () => {
    await User.updateOne({ email: ADMIN.email }, { isActive: false });
    const res = await anonymous(app).post("/api/v1/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ACCOUNT_DISABLED");
  });

  it("requires the CSRF header on state-changing requests", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_FAILED");
  });
});

describe("session handling", () => {
  it("GET /auth/me needs a session", async () => {
    expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);
    const agent = await loginAgent(app);
    const res = await agent.get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(ADMIN.email);
  });

  it("logout clears the cookie so /me fails afterwards", async () => {
    const agent = await loginAgent(app);
    const out = await agent.post("/api/v1/auth/logout");
    expect(out.status).toBe(200);
    expect(out.headers["set-cookie"][0]).toMatch(/dt_token=;/);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
  });

  it("rejects tampered and expired tokens", async () => {
    const user = await User.findOne({ email: ADMIN.email });
    const claims = { issuer: "doctor-tracker", audience: "doctor-tracker-admin", subject: String(user._id) };
    const forged = jwt.sign({ role: "admin" }, "a-different-secret-a-different-secret", { ...claims, expiresIn: "1h" });
    const expired = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { ...claims, expiresIn: -10 });

    for (const token of [forged, expired, "garbage"]) {
      const res = await request(app).get("/api/v1/auth/me").set("Cookie", `dt_token=${token}`);
      expect(res.status).toBe(401);
    }
  });

  it("revokes access immediately when the user is deactivated", async () => {
    const agent = await loginAgent(app);
    await User.updateOne({ email: ADMIN.email }, { isActive: false });
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
  });

  it("returns 403 (not 401) for an authenticated non-admin role", async () => {
    const admin = await User.findOne({ email: ADMIN.email });
    // Bypass Mongoose enum validation to simulate a future role.
    await User.collection.updateOne({ _id: admin._id }, { $set: { role: "viewer" } });
    const agent = await loginAgent(app);
    const res = await agent.get("/api/v1/doctors");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});
