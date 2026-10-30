import { defineConfig } from "vitest/config";

// Test-only fixtures: none of these are real secrets or connection strings.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.js"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000, // first run may download a MongoDB binary for mongodb-memory-server
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/unused_by_tests",
      JWT_SECRET: "test-only-secret-test-only-secret-1234",
      JWT_EXPIRES_IN: "1h",
      COOKIE_NAME: "dt_token",
      CLIENT_URL: "http://localhost:3000",
      BCRYPT_ROUNDS: "4",
      LOG_LEVEL: "silent",
      RATE_LIMIT_GENERAL_MAX: "100000",
      RATE_LIMIT_LOGIN_MAX: "1000",
      RATE_LIMIT_ANALYTICS_MAX: "100000",
    },
  },
});
