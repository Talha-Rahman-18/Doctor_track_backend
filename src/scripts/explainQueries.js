import { connectDb, disconnectDb } from "../config/db.js";
import { Doctor } from "../models/Doctor.model.js";
import { Patient } from "../models/Patient.model.js";
import { buildDoctorFilter } from "../services/doctor.service.js";
import { buildPatientFilter } from "../services/patient.service.js";

/** Walks the winning plan and returns the stage names, e.g. LIMIT > FETCH > IXSCAN. */
function describePlan(stage, parts = []) {
  if (!stage) return parts;
  parts.push(stage.stage + (stage.indexName ? `(${stage.indexName})` : ""));
  (stage.inputStages ?? (stage.inputStage ? [stage.inputStage] : [])).forEach((s) => describePlan(s, parts));
  return parts;
}

async function explain(label, query) {
  const result = await query.explain("executionStats");
  const stats = result.executionStats;
  console.log(`\n${label}`);
  console.log(`  plan:        ${describePlan(result.queryPlanner.winningPlan).join(" > ")}`);
  console.log(`  returned:    ${stats.nReturned}`);
  console.log(`  keys/docs:   ${stats.totalKeysExamined} keys, ${stats.totalDocsExamined} docs examined`);
  console.log(`  time:        ${stats.executionTimeMillis} ms`);
}

async function main() {
  await connectDb();
  const someDoctor = await Doctor.findOne().select("_id specialization").lean();

  await explain("Doctors: default listing (createdAt desc)", Doctor.find({}).sort({ createdAt: -1 }).limit(10));
  await explain(
    "Doctors: specialization filter + newest first",
    Doctor.find(buildDoctorFilter({ specialization: someDoctor?.specialization ?? "Cardiology" }))
      .sort({ createdAt: -1 })
      .limit(10),
  );
  await explain("Doctors: name prefix search", Doctor.find(buildDoctorFilter({ search: "ami" })).limit(10));
  await explain(
    "Patients: doctor-scoped listing",
    Patient.find(buildPatientFilter({ doctor: someDoctor?._id })).sort({ createdAt: -1 }).limit(10),
  );
  await explain("Patients: condition filter", Patient.find(buildPatientFilter({ condition: "Asthma" })).sort({ createdAt: -1 }).limit(10));
  await explain("Patients: name prefix search", Patient.find(buildPatientFilter({ search: "ka" })).limit(10));
  await explain(
    "Patients: date range",
    Patient.find(buildPatientFilter({ startDate: "2026-01-01", endDate: "2026-12-31" })).sort({ createdAt: -1 }).limit(10),
  );
  console.log("\nLook for IXSCAN (index used) versus COLLSCAN (full collection scan) in each plan.");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
