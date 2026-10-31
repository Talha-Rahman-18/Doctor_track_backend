# API Reference

Base URL: `/api/v1` (e.g. `http://localhost:5000/api/v1`). All bodies are JSON.

## Conventions

**Authentication.** `POST /auth/login` sets an HTTP-only cookie (name from `COOKIE_NAME`, default `dt_token`). Every other
endpoint except `POST /auth/logout` requires that cookie. Doctors, patients and dashboard also require the `admin` role.
Clients must send credentials (`withCredentials: true`).

**CSRF.** Every non-GET request must include the header `X-Requested-With: XMLHttpRequest`, and if an `Origin` header is
present it must be listed in `CLIENT_URL`. Otherwise: `403` with `code: "CSRF_FAILED"`.

**Success envelope**
```json
{ "success": true, "message": "Doctor created successfully", "data": { "doctor": {} } }
```
List endpoints add `"pagination": { "page", "limit", "total", "totalPages", "hasNextPage", "hasPreviousPage" }`.
Deletes return `204 No Content`.

**Error envelope**
```json
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Enter a valid email address" }] }
```
`errors` is present for validation (400) and some conflict (409) errors. `code` is one of `VALIDATION_ERROR`,
`UNAUTHENTICATED`, `FORBIDDEN`, `CSRF_FAILED`, `ACCOUNT_DISABLED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`,
`SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.

**Common errors (all protected endpoints)**

| Status | When |
|---|---|
| 400 | Invalid body/query/params (unknown keys are rejected), malformed ObjectId |
| 401 | Missing, invalid or expired cookie; user deactivated |
| 403 | Authenticated but not an admin, or CSRF check failed |
| 404 | Resource (or referenced doctor) not found |
| 409 | Duplicate unique value, or deleting a doctor who still has patients |
| 413 | Body larger than 10 kB |
| 429 | Rate limit exceeded |
| 503 | Database unavailable or a query exceeded its 5 s time limit |

**Validation policies**

- Strings are trimmed and inner whitespace collapsed. Emails are lower-cased.
- **Phone:** spaces, `-`, `.`, `(`, `)` are stripped; the remainder must match `^\+?\d{8,15}$`. Stored without separators.
- **Patient age:** integer 0–120. **Gender:** `male | female | other`. **Condition:** ≤ 100 chars (first letter capitalised on save). **Notes:** optional, ≤ 1000 chars; send `""` to clear. `null` is not accepted.
- **Dates:** `YYYY-MM-DD`, UTC, validated as real calendar dates; `startDate ≤ endDate`; the end date is inclusive. Filters apply to `createdAt`.
- **Pagination:** `page` ≥ 1 (default 1), `limit` 1–50 (default 10). Out-of-range values are rejected with 400. A page beyond the last returns an empty list with correct metadata.
- **Search:** max 50 chars, **prefix** match (see `architecture.md`). Regex metacharacters are escaped.
- **Sorting:** `sortBy` must be in the endpoint's allow-list; `sortOrder` is `asc | desc` (default `desc`).

---

## Authentication

### `POST /auth/login`
Public. Rate limited (failed attempts only).
Body: `{ "email": "admin@example.com", "password": "…" }`
`200` → `{ data: { user: { _id, name, email, role, isActive, createdAt, updatedAt } } }` + `Set-Cookie`.
Errors: `400` validation, `401` invalid credentials (same message for unknown email and wrong password), `403 ACCOUNT_DISABLED`, `429`.

### `POST /auth/logout`
Clears the cookie. `200`.

### `GET /auth/me`
Auth required. `200` → `{ data: { user: { id, name, email, role } } }`. `401` otherwise.

---

## Doctors (admin only)

Doctor object: `{ _id, name, specialization, hospital, phone, email, patientCount, createdAt, updatedAt }`

### `POST /doctors`
Body (all required, no other keys): `name` (2–100), `specialization` (≤100), `hospital` (≤150), `phone`, `email`.
`201` → `{ data: { doctor } }`. Errors: `400`, `409` duplicate email (`errors[0].field = "email"`).

### `GET /doctors`
Query: `page`, `limit`, `search` (name prefix, any-word prefix, or email prefix), `specialization`, `hospital` (exact match),
`startDate`, `endDate`, `sortBy` (`createdAt | name | specialization | hospital`), `sortOrder`.
`200` → `{ data: { doctors: [...] }, pagination }`. `patientCount` is computed with one grouped query per page.

### `GET /doctors/options`
Distinct values for filter dropdowns. `200` → `{ data: { specializations: [], hospitals: [] } }`.

### `GET /doctors/:id`
`200` → `{ data: { doctor } }`. `400` malformed id, `404`.

### `PATCH /doctors/:id`
Body: any subset of the create fields; at least one; unknown keys rejected. `200` → `{ data: { doctor } }`. `404`, `409`.

### `DELETE /doctors/:id`
`204`. `409` if the doctor still has patients (message tells the admin to reassign or delete them first). `404`.

### `GET /doctors/:id/patients`
Query: as `GET /patients` without `doctor`. `200` → `{ data: { patients: [...] }, pagination }`. `404` if the doctor does not exist.

### `POST /doctors/:id/patients`
Body: patient create fields (below). The doctor comes from the URL; a `doctor` key in the body is rejected.
`201` → `{ data: { patient } }`. `404` doctor not found.

---

## Patients (admin only)

Patient object (list): `{ _id, name, age, gender, phone, condition, createdAt, doctor: { _id, name, specialization, hospital } }`.
The detail endpoint also returns `notes` and `updatedAt`. **`notes` is intentionally omitted from lists.**

### `GET /patients`
Query: `page`, `limit`, `search` (name prefix / any-word prefix), `doctor` (ObjectId), `condition` (exact),
`startDate`, `endDate`, `sortBy` (`createdAt | name | age | condition`), `sortOrder`. `200` → list + pagination.

### `GET /patients/options`
`200` → `{ data: { conditions: [] } }`.

### `GET /patients/:id`
`200` → `{ data: { patient } }` (with populated `doctor` summary and `notes`). `404`.

### `PATCH /patients/:id`
Body: any subset of `name, age, gender, phone, condition, notes, doctor` (at least one). Supplying `doctor` reassigns the patient
(`404` if that doctor does not exist). `200` → `{ data: { patient } }`.

### `DELETE /patients/:id`
Hard delete. `204`, or `404`.

**Patient create fields:** `name` (2–100), `age`, `gender`, `phone`, `condition`, `notes` (optional, default `""`).

---

## Dashboard (admin only; limited to 60 requests/minute/IP by default)

### `GET /dashboard/overview`
Query: `startDate`, `endDate` (default: last 30 days ending today, UTC).
`200` → `{ data: { range, totals: { doctors, patients, averagePatientsPerDoctor }, inRange: { doctors, patients }, topConditions: [{ condition, count }] } }`.
`totals` are all-time; `inRange` and `topConditions` use the range.

### `GET /dashboard/patients-per-doctor`
Query: `limit` (1–20, default 10). All-time. `200` → `{ data: { items: [{ doctorId, doctorName, specialization, patientCount }] } }`, busiest first.

### `GET /dashboard/trends`
Query: `startDate`, `endDate`, `interval` (`day | month`, default `day`). Daily ranges are limited to 366 days, monthly to 5 years (`400` otherwise).
`200` → `{ data: { range, interval, series: [{ date, doctors, patients }] } }`. Buckets with no activity are included with `0`
so charts have a continuous axis. Monthly buckets are keyed by the first day of the month.

---

## Health

`GET /health` (outside `/api/v1`, no auth): `200 { success: true, status: "ok" }` or `503` when MongoDB is not connected.
