import { Doctor } from "../models/Doctor.model.js";
import { Patient } from "../models/Patient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { QUERY_TIMEOUT_MS, addDays, buildDateRange, toDateString } from "../utils/queryFilters.js";

const DEFAULT_RANGE_DAYS = 30;
const MAX_DAILY_RANGE_DAYS = 366;
const MAX_MONTHLY_RANGE_DAYS = 365 * 5;
const TOP_CONDITIONS = 8;

const run = (aggregate) => aggregate.option({ maxTimeMS: QUERY_TIMEOUT_MS });

/** Applies the default window (last 30 days, ending today UTC) when dates are omitted. */
export function resolveRange({ startDate, endDate } = {}) {
  const end = endDate ?? toDateString(new Date());
  const start = startDate ?? toDateString(addDays(new Date(`${end}T00:00:00.000Z`), -(DEFAULT_RANGE_DAYS - 1)));
  if (start > end) throw ApiError.badRequest("Start date must be on or before the end date");
  return { startDate: start, endDate: end };
}

export async function getOverview(query) {
  const range = resolveRange(query);
  const createdAt = buildDateRange(range.startDate, range.endDate);

  const [totalDoctors, totalPatients, newDoctors, newPatients, topConditions] = await Promise.all([
    Doctor.estimatedDocumentCount(),
    Patient.estimatedDocumentCount(),
    Doctor.countDocuments({ createdAt }).maxTimeMS(QUERY_TIMEOUT_MS),
    Patient.countDocuments({ createdAt }).maxTimeMS(QUERY_TIMEOUT_MS),
    run(
      Patient.aggregate([
        { $match: { createdAt } },
        { $group: { _id: "$condition", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: TOP_CONDITIONS },
        { $project: { _id: 0, condition: "$_id", count: 1 } },
      ]),
    ),
  ]);

  return {
    range,
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      averagePatientsPerDoctor: totalDoctors ? Number((totalPatients / totalDoctors).toFixed(1)) : 0,
    },
    inRange: { doctors: newDoctors, patients: newPatients },
    topConditions,
  };
}

/** All-time patient counts for the busiest doctors. $lookup runs only after $limit. */
export async function getPatientsPerDoctor({ limit }) {
  const rows = await run(
    Patient.aggregate([
      { $group: { _id: "$doctor", patientCount: { $sum: 1 } } },
      { $sort: { patientCount: -1, _id: 1 } },
      { $limit: limit },
      { $lookup: { from: Doctor.collection.name, localField: "_id", foreignField: "_id", as: "doctor" } },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          doctorId: "$_id",
          doctorName: { $ifNull: ["$doctor.name", "Unknown doctor"] },
          specialization: { $ifNull: ["$doctor.specialization", ""] },
          patientCount: 1,
        },
      },
    ]),
  );
  return { items: rows };
}

function bucketKey(date, interval) {
  const iso = date.toISOString();
  return interval === "month" ? `${iso.slice(0, 7)}-01` : iso.slice(0, 10);
}

/** Zero-filled list of bucket keys so charts show gaps as 0 instead of skipping days/months. */
function buildBuckets(startDate, endDate, interval) {
  const keys = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  if (interval === "month") cursor.setUTCDate(1);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    keys.push(bucketKey(cursor, interval));
    if (interval === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function groupByBucket(Model, createdAt, interval) {
  return run(
    Model.aggregate([
      { $match: { createdAt } },
      { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: interval, timezone: "UTC" } }, count: { $sum: 1 } } },
    ]),
  );
}

export async function getTrends({ interval, ...dates }) {
  const range = resolveRange(dates);
  const spanDays = (new Date(range.endDate) - new Date(range.startDate)) / 86_400_000 + 1;
  const maxDays = interval === "month" ? MAX_MONTHLY_RANGE_DAYS : MAX_DAILY_RANGE_DAYS;
  if (spanDays > maxDays) {
    throw ApiError.badRequest(
      interval === "month"
        ? "Date range is too large (maximum 5 years)"
        : "Date range is too large for daily data (maximum 366 days). Choose monthly data instead.",
    );
  }

  const createdAt = buildDateRange(range.startDate, range.endDate);
  const [doctorRows, patientRows] = await Promise.all([
    groupByBucket(Doctor, createdAt, interval),
    groupByBucket(Patient, createdAt, interval),
  ]);

  const toMap = (rows) => new Map(rows.map((row) => [bucketKey(row._id, interval), row.count]));
  const doctors = toMap(doctorRows);
  const patients = toMap(patientRows);

  const series = buildBuckets(range.startDate, range.endDate, interval).map((date) => ({
    date,
    doctors: doctors.get(date) ?? 0,
    patients: patients.get(date) ?? 0,
  }));

  return { range, interval, series };
}
