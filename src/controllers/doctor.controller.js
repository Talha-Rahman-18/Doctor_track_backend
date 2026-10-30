import * as doctorService from "../services/doctor.service.js";
import { sendNoContent, sendSuccess } from "../utils/ApiResponse.js";

export async function createDoctor(req, res) {
  const doctor = await doctorService.createDoctor(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: "Doctor created successfully", data: { doctor } });
}

export async function listDoctors(req, res) {
  const { items, pagination } = await doctorService.listDoctors(req.validated.query);
  return sendSuccess(res, { message: "Doctors retrieved successfully", data: { doctors: items }, pagination });
}

export async function getDoctorOptions(_req, res) {
  const options = await doctorService.getFilterOptions();
  return sendSuccess(res, { message: "Doctor filter options retrieved", data: options });
}

export async function getDoctor(req, res) {
  const doctor = await doctorService.getDoctorById(req.validated.params.id);
  return sendSuccess(res, { message: "Doctor retrieved successfully", data: { doctor } });
}

export async function updateDoctor(req, res) {
  const doctor = await doctorService.updateDoctor(req.validated.params.id, req.validated.body);
  return sendSuccess(res, { message: "Doctor updated successfully", data: { doctor } });
}

export async function deleteDoctor(req, res) {
  await doctorService.deleteDoctor(req.validated.params.id);
  return sendNoContent(res);
}

export async function listDoctorPatients(req, res) {
  const { items, pagination } = await doctorService.listDoctorPatients(req.validated.params.id, req.validated.query);
  return sendSuccess(res, { message: "Patients retrieved successfully", data: { patients: items }, pagination });
}

export async function createDoctorPatient(req, res) {
  const patient = await doctorService.createPatientForDoctor(req.validated.params.id, req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: "Patient added successfully", data: { patient } });
}
