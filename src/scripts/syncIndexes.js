import { connectDb, disconnectDb } from "../config/db.js";
import { Doctor } from "../models/Doctor.model.js";
import { Patient } from "../models/Patient.model.js";
import { User } from "../models/User.model.js";

// Creates missing indexes and drops indexes that are no longer declared in the schemas.
async function main() {
  await connectDb();
  for (const Model of [User, Doctor, Patient]) {
    const dropped = await Model.syncIndexes();
    console.log(`${Model.modelName}: indexes in sync${dropped.length ? ` (dropped: ${dropped.join(", ")})` : ""}`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
