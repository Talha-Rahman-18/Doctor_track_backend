import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Must be set before anything that loads the env config (helpers, app, limiter) is imported.
process.env.RATE_LIMIT_LOGIN_MAX = "3";
const { ADMIN, anonymous, createAdminUser, setupDb, teardownDb } = await import("./helpers.js");
const { createApp } = await import("../app.js");
const app = createApp();

beforeAll(async () => {
  await setupDb();
  await createAdminUser();
});
afterAll(teardownDb);

describe("login rate limiting", () => {
  it("returns a standard 429 after too many failed attempts, but ignores successful logins", async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await anonymous(app).post("/api/v1/auth/login").send({ email: ADMIN.email, password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const blocked = await anonymous(app).post("/api/v1/auth/login").send({ email: ADMIN.email, password: ADMIN.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ success: false, code: "RATE_LIMITED" });
  });
});
