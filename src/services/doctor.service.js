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
import * as patientService from "./patient.service.js";

const SORT_FIELDS = {
  createdAt: "createdAt",
  name: "nameLower",
  specialization: "specialization",
  hospital: "hospital",
};

const LIST_PROJECTION = "name specialization hospital phone email createdAt";
const DETAIL_PROJECTION = `${LIST_PROJECTION} updatedAt`;

export function buildDoctorFilter({ search, specialization, hospital, startDate, endDate }) {
  const filter = {};
  if (search) {
    const prefix = buildPrefixRegex(search);
    // Each branch is served by its own index (nameLower, nameTokens, unique email).
    filter.$or = [{ nameLower: prefix }, { nameTokens: prefix }, { email: prefix }];
  }
  if (specialization) filter.specialization = specialization;
  if (hospital) filter.hospital = hospital;
  const createdAt = buildDateRange(startDate, endDate);
  if (createdAt) filter.createdAt = createdAt;
  return filter;
}

/** One grouped query for the whole page of doctors (avoids N+1 counting). */
async function getPatientCounts(doctorIds) {
  if (!doctorIds.length) return new Map();
  const counts = await Patient.aggregate([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: "$doctor", count: { $sum: 1 } } },
  ]).option({ maxTimeMS: QUERY_TIMEOUT_MS });
  return new Map(counts.map(({ _id, count }) => [String(_id), count]));
}

async function findDoctorOrThrow(id) {
  const doctor = await Doctor.findById(id).select(DETAIL_PROJECTION).lean().maxTimeMS(QUERY_TIMEOUT_MS);
  if (!doctor) throw ApiError.notFound("Doctor not found");
  return doctor;
}

export async function createDoctor(input) {
  const doctor = await Doctor.create(input);
  return { ...doctor.toJSON(), patientCount: 0 };
}

export async function listDoctors(query) {
  const { page, limit, sortBy, sortOrder } = query;
  const filter = buildDoctorFilter(query);

  const [total, doctors] = await Promise.all([
    Doctor.countDocuments(filter).maxTimeMS(QUERY_TIMEOUT_MS),
    Doctor.find(filter)
      .select(LIST_PROJECTION)
      .sort(buildSort(sortBy, sortOrder, SORT_FIELDS))
      .skip(getSkip({ page, limit }))
      .limit(limit)
      .lean()
      .maxTimeMS(QUERY_TIMEOUT_MS),
  ]);

  const counts = await getPatientCounts(doctors.map((doctor) => doctor._id));
  const items = doctors.map((doctor) => ({ ...doctor, patientCount: counts.get(String(doctor._id)) ?? 0 }));

  return { items, pagination: buildPagination({ page, limit, total }) };
}

export async function getDoctorById(id) {
  const [doctor, patientCount] = await Promise.all([
    findDoctorOrThrow(id),
    Patient.countDocuments({ doctor: id }).maxTimeMS(QUERY_TIMEOUT_MS),
  ]);
  return { ...doctor, patientCount };
}

export async function updateDoctor(id, changes) {
  // Load + save (instead of findOneAndUpdate) so schema hooks keep derived search fields in sync.
  const doctor = await Doctor.findById(id);
  if (!doctor) throw ApiError.notFound("Doctor not found");
  doctor.set(changes);
  await doctor.save();
  const patientCount = await Patient.countDocuments({ doctor: id }).maxTimeMS(QUERY_TIMEOUT_MS);
  return { ...doctor.toJSON(), patientCount };
}

/**
 * Deletion policy: a doctor with patients cannot be deleted (409). Patients must be reassigned
 * or deleted first, so patient records are never silently orphaned or destroyed.
 * Known limitation: the check and delete are not atomic; a patient created in between would
 * reference a missing doctor. A transaction (replica set) would close that gap.
 */
export async function deleteDoctor(id) {
  const doctor = await Doctor.exists({ _id: id });
  if (!doctor) throw ApiError.notFound("Doctor not found");

  const patientCount = await Patient.countDocuments({ doctor: id }).maxTimeMS(QUERY_TIMEOUT_MS);
  if (patientCount > 0) {
    throw ApiError.conflict(
      `This doctor still has ${patientCount} patient${patientCount === 1 ? "" : "s"}. Reassign or delete them before deleting the doctor.`,
    );
  }
  await Doctor.deleteOne({ _id: id });
}

export async function listDoctorPatients(doctorId, query) {
  await findDoctorOrThrow(doctorId);
  return patientService.listPatients({ ...query, doctor: doctorId }, { populateDoctor: false });
}

export async function createPatientForDoctor(doctorId, input) {
  return patientService.createPatient({ ...input, doctor: doctorId });
}

/** Distinct values for the filter dropdowns. `distinct` is answered from the compound indexes. */
export async function getFilterOptions() {
  const [specializations, hospitals] = await Promise.all([
    Doctor.distinct("specialization").maxTimeMS(QUERY_TIMEOUT_MS),
    Doctor.distinct("hospital").maxTimeMS(QUERY_TIMEOUT_MS),
  ]);
  const sort = (values) => values.sort((a, b) => a.localeCompare(b));
  return { specializations: sort(specializations), hospitals: sort(hospitals) };
}
