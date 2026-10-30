import { Router } from "express";
import * as dashboard from "../controllers/dashboard.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { isAdmin } from "../middleware/isAdmin.middleware.js";
import { analyticsLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  overviewQuerySchema,
  patientsPerDoctorQuerySchema,
  trendsQuerySchema,
} from "../validators/dashboard.validator.js";

const router = Router();

router.use(analyticsLimiter, authMiddleware, isAdmin);

router.get("/overview", validate({ query: overviewQuerySchema }), asyncHandler(dashboard.getOverview));
router.get(
  "/patients-per-doctor",
  validate({ query: patientsPerDoctorQuerySchema }),
  asyncHandler(dashboard.getPatientsPerDoctor),
);
router.get("/trends", validate({ query: trendsQuerySchema }), asyncHandler(dashboard.getTrends));

export default router;
