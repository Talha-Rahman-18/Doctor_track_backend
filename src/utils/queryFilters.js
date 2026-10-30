import { ApiError } from "./ApiError.js";

export const QUERY_TIMEOUT_MS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const collapseSpaces = (value) => value.trim().replace(/\s+/g, " ");

/** Lower-cased full name used by the prefix-search index. */
export const toSearchKey = (value) => collapseSpaces(value).toLowerCase();

/** Lower-cased words of a name, stored in a multikey index so "khan" can match "Sara Khan". */
export function toSearchTokens(value) {
  return [...new Set(toSearchKey(value).split(/[\s.,\-_/]+/).filter(Boolean))];
}

/**
 * Builds an anchored, escaped prefix regex. Anchored + case-sensitive regexes on an
 * already-lower-cased field can use index bounds; unanchored / case-insensitive ones cannot.
 */
export function buildPrefixRegex(term) {
  return new RegExp(`^${escapeRegex(toSearchKey(term))}`);
}

/** Converts YYYY-MM-DD strings into a createdAt range ([start, end + 1 day)). */
export function buildDateRange(startDate, endDate) {
  if (!startDate && !endDate) return undefined;
  const range = {};
  if (startDate) range.$gte = new Date(`${startDate}T00:00:00.000Z`);
  if (endDate) range.$lt = new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + DAY_MS);
  return range;
}

/** Maps a client sort key to a real field using an allowlist. Adds _id as a stable tiebreaker. */
export function buildSort(sortBy, sortOrder, allowlist) {
  const field = allowlist[sortBy];
  if (!field) throw ApiError.badRequest(`Unsupported sort field: ${sortBy}`);
  const direction = sortOrder === "asc" ? 1 : -1;
  return { [field]: direction, _id: direction };
}

export const toDateString = (date) => date.toISOString().slice(0, 10);
export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
