import * as dashboardService from "../services/dashboard.service.js";
import { sendSuccess } from "../utils/ApiResponse.js";

export async function getOverview(req, res) {
  const overview = await dashboardService.getOverview(req.validated.query);
  return sendSuccess(res, { message: "Dashboard overview retrieved", data: overview });
}

export async function getPatientsPerDoctor(req, res) {
  const data = await dashboardService.getPatientsPerDoctor(req.validated.query);
  return sendSuccess(res, { message: "Patients per doctor retrieved", data });
}

export async function getTrends(req, res) {
  const data = await dashboardService.getTrends(req.validated.query);
  return sendSuccess(res, { message: "Trends retrieved", data });
}
