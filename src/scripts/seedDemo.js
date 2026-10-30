import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { Doctor } from "../models/Doctor.model.js";
import { Patient } from "../models/Patient.model.js";

// All people, hospitals and numbers below are fictional. Phone numbers use the 555-01xx
// range reserved for fiction; emails use the reserved example.org domain.
const DOCTORS = [
  ["Amina Rahman", "Cardiology", "Riverside General Hospital"],
  ["Daniel Okafor", "Neurology", "Riverside General Hospital"],
  ["Priya Nair", "Pediatrics", "Lakeview Medical Center"],
  ["Marcus Chen", "Orthopedics", "Lakeview Medical Center"],
  ["Sofia Alvarez", "Dermatology", "Northgate Clinic"],
  ["Tariq Hossain", "Endocrinology", "Northgate Clinic"],
  ["Elena Petrova", "Oncology", "Riverside General Hospital"],
  ["James Whitfield", "Pulmonology", "Lakeview Medical Center"],
];
const FIRST = ["Alex", "Bina", "Carlos", "Dina", "Emre", "Farah", "Gabe", "Hana", "Ivan", "Jia", "Kofi", "Lena", "Mira", "Noor", "Omar", "Pia"];
const LAST = ["Abbott", "Banerjee", "Carter", "Dube", "Ellis", "Fischer", "Gomez", "Haque", "Ibrahim", "Jensen", "Khan", "Lopez"];
const CONDITIONS = ["Hypertension", "Type 2 diabetes", "Asthma", "Migraine", "Arthritis", "Eczema", "Anxiety", "Back pain", "Anemia", "Allergic rhinitis"];
const GENDERS = ["female", "male", "other"];

const PATIENT_COUNT = 64;
const DAY_MS = 86_400_000;

async function main() {
  if (env.isProduction && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed demo data in production (set ALLOW_DEMO_SEED=true to override).");
  }
  await connectDb();
  const now = Date.now();

  const doctors = [];
  let createdDoctors = 0;
  for (const [index, [name, specialization, hospital]] of DOCTORS.entries()) {
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@example.org`;
    let doctor = await Doctor.findOne({ email });
    if (!doctor) {
      doctor = await Doctor.create({
        name,
        specialization,
        hospital,
        email,
        phone: `+1555010${String(100 + index).slice(-4)}`,
        createdAt: new Date(now - (75 - index * 8) * DAY_MS),
      });
      createdDoctors += 1;
    }
    doctors.push(doctor);
  }

  let createdPatients = 0;
  for (let i = 0; i < PATIENT_COUNT; i += 1) {
    // Uneven distribution so the "patients per doctor" chart is interesting.
    const doctor = doctors[(i * i + i) % doctors.length];
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const phone = `+1555020${String(1000 + i).slice(-4)}`;

    const exists = await Patient.exists({ doctor: doctor._id, name, phone });
    if (exists) continue;

    const earliest = doctor.createdAt.getTime();
    const createdAt = new Date(earliest + ((now - earliest) * ((i * 37) % 100)) / 100);
    await Patient.create({
      name,
      doctor: doctor._id,
      age: 18 + ((i * 11) % 65),
      gender: GENDERS[i % GENDERS.length],
      phone,
      condition: CONDITIONS[(i * 3) % CONDITIONS.length],
      notes: "Fictional demo record.",
      createdAt,
    });
    createdPatients += 1;
  }

  console.log(`Demo data ready: ${createdDoctors} doctors and ${createdPatients} patients created (existing records skipped).`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
