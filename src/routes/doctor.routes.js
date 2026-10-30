import { Router } from "express";
import * as doctors from "../controllers/doctor.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/isAdmin.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { idParamSchema } from "../validators/common.validator.js";
import { createDoctorSchema, listDoctorsQuerySchema, updateDoctorSchema } from "../validators/doctor.validator.js";
import { createPatientSchema, listDoctorPatientsQuerySchema } from "../validators/patient.validator.js";

const router = Router();

router.use(authMiddleware, isAdmin);

router.post("/", validate({ body: createDoctorSchema }), asyncHandler(doctors.createDoctor));
router.get("/", validate({ query: listDoctorsQuerySchema }), asyncHandler(doctors.listDoctors));
// Static path must be registered before "/:id".
router.get("/options", asyncHandler(doctors.getDoctorOptions));
router.get("/:id", validate({ params: idParamSchema }), asyncHandler(doctors.getDoctor));
router.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateDoctorSchema }),
  asyncHandler(doctors.updateDoctor),
);
router.delete("/:id", validate({ params: idParamSchema }), asyncHandler(doctors.deleteDoctor));
router.get(
  "/:id/patients",
  validate({ params: idParamSchema, query: listDoctorPatientsQuerySchema }),
  asyncHandler(doctors.listDoctorPatients),
);
router.post(
  "/:id/patients",
  validate({ params: idParamSchema, body: createPatientSchema }),
  asyncHandler(doctors.createDoctorPatient),
);

export default router;
