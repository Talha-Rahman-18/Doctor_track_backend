import { Doctor } from "../models/Doctor.model.js";
import { Patient } from "../models/Patient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { buildPagination, getSkip } from "../utils/pagination.js";
import {
  QUERY_TIMEOUT_MS,
  buildDateRange,
  buildPrefixRegex,
  buildSort,
} from "../utils/queryFilters.js";

const SORT_FIELDS = { createdAt: "createdAt", name: "nameLower", age: "age", condition: "condition" };

// Lists deliberately omit `notes` (sensitive free text); only the detail view returns it.
const LIST_PROJECTION = "name doctor age gender phone condition createdAt";
const DETAIL_PROJECTION = `${LIST_PROJECTION} notes updatedAt`;
const DOCTOR_SUMMARY = "name specialization hospital";

export function buildPatientFilter({ search, doctor, condition, startDate, endDate }) {
  const filter = {};
  if (search) {
    const prefix = buildPrefixRegex(search);
    filter.$or = [{ nameLower: prefix }, { nameTokens: prefix }];
  }
  if (doctor) filter.doctor = doctor;
  if (condition) filter.condition = condition;
  const createdAt = buildDateRange(startDate, endDate);
  if (createdAt) filter.createdAt = createdAt;
  return filter;
}

async function assertDoctorExists(doctorId) {
  const exists = await Doctor.exists({ _id: doctorId }).maxTimeMS(QUERY_TIMEOUT_MS);
  if (!exists) throw ApiError.notFound("Doctor not found");
}

export async function createPatient(input) {
  await assertDoctorExists(input.doctor);
  const patient = await Patient.create(input);
  return patient.toJSON();
}

export async function listPatients(query, { populateDoctor = true } = {}) {
  const { page, limit, sortBy, sortOrder } = query;
  const filter = buildPatientFilter(query);

  let findQuery = Patient.find(filter)
    .select(LIST_PROJECTION)
    .sort(buildSort(sortBy, sortOrder, SORT_FIELDS))
    .skip(getSkip({ page, limit }))
    .limit(limit);

  // One batched $in query for the page, not one query per patient.
  if (populateDoctor) findQuery = findQuery.populate({ path: "doctor", select: DOCTOR_SUMMARY });

  const [total, items] = await Promise.all([
    Patient.countDocuments(filter).maxTimeMS(QUERY_TIMEOUT_MS),
    findQuery.lean().maxTimeMS(QUERY_TIMEOUT_MS),
  ]);

  return { items, pagination: buildPagination({ page, limit, total }) };
}

export async function getPatientById(id) {
  const patient = await Patient.findById(id)
    .select(DETAIL_PROJECTION)
    .populate({ path: "doctor", select: DOCTOR_SUMMARY })
    .lean()
    .maxTimeMS(QUERY_TIMEOUT_MS);
  if (!patient) throw ApiError.notFound("Patient not found");
  return patient;
}

export async function updatePatient(id, changes) {
  const patient = await Patient.findById(id);
  if (!patient) throw ApiError.notFound("Patient not found");

  if (changes.doctor && String(changes.doctor) !== String(patient.doctor)) {
    await assertDoctorExists(changes.doctor);
  }
  patient.set(changes);
  await patient.save();
  return getPatientById(id);
}

/** Patients are hard-deleted: there is no soft-delete or archive in this version. */
export async function deletePatient(id) {
  const result = await Patient.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw ApiError.notFound("Patient not found");
}

export async function getFilterOptions() {
  const conditions = await Patient.distinct("condition").maxTimeMS(QUERY_TIMEOUT_MS);
  return { conditions: conditions.sort((a, b) => a.localeCompare(b)) };
}
