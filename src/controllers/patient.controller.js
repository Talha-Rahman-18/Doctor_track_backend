import * as patientService from "../services/patient.service.js";
import { sendNoContent, sendSuccess } from "../utils/ApiResponse.js";

export async function listPatients(req, res) {
  const { items, pagination } = await patientService.listPatients(req.validated.query);
  return sendSuccess(res, { message: "Patients retrieved successfully", data: { patients: items }, pagination });
}

export async function getPatientOptions(_req, res) {
  const options = await patientService.getFilterOptions();
  return sendSuccess(res, { message: "Patient filter options retrieved", data: options });
}

export async function getPatient(req, res) {
  const patient = await patientService.getPatientById(req.validated.params.id);
  return sendSuccess(res, { message: "Patient retrieved successfully", data: { patient } });
}

export async function updatePatient(req, res) {
  const patient = await patientService.updatePatient(req.validated.params.id, req.validated.body);
  return sendSuccess(res, { message: "Patient updated successfully", data: { patient } });
}

export async function deletePatient(req, res) {
  await patientService.deletePatient(req.validated.params.id);
  return sendNoContent(res);
}
