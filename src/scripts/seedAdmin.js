import { z } from "zod";
import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.model.js";
import { hashPassword } from "../services/auth.service.js";
import { emailSchema } from "../validators/common.validator.js";

const PLACEHOLDER_PASSWORD = "ChangeMe-Before-Use-123!";

const adminSchema = z.object({
  name: z.string().trim().min(2, "ADMIN_NAME is required (2-80 chars)").max(80),
  email: emailSchema,
  password: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters").max(128),
});

async function main() {
  const parsed = adminSchema.safeParse({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in server/.env:\n${details}`);
  }
  const { name, email, password } = parsed.data;

  if (env.isProduction && password === PLACEHOLDER_PASSWORD) {
    throw new Error("Refusing to create a production admin with the example password.");
  }

  await connectDb();
  const existing = await User.exists({ email });
  if (existing) {
    // Never overwrite an existing administrator's password from a seed script.
    console.log(`Admin ${email} already exists. Nothing changed.`);
    return;
  }

  await User.create({ name, email, passwordHash: await hashPassword(password), role: "admin" });
  console.log(`Admin ${email} created.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
