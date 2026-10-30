import { Router } from "express";
import * as patients from "../controllers/patient.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/isAdmin.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { idParamSchema } from "../validators/common.validator.js";
import { listPatientsQuerySchema, updatePatientSchema } from "../validators/patient.validator.js";

const router = Router();

router.use(authMiddleware, isAdmin);

router.get("/", validate({ query: listPatientsQuerySchema }), asyncHandler(patients.listPatients));
router.get("/options", asyncHandler(patients.getPatientOptions));
router.get("/:id", validate({ params: idParamSchema }), asyncHandler(patients.getPatient));
router.patch(
  "/:id",
  validate({ params: idParamSchema, body: updatePatientSchema }),
  asyncHandler(patients.updatePatient),
);
router.delete("/:id", validate({ params: idParamSchema }), asyncHandler(patients.deletePatient));

export default router;
