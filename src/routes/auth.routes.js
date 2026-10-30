import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { loginLimiter } from "../middleware/rateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginSchema } from "../validators/auth.validator.js";
import {login,logout,me} from '../controllers/auth.controller.js'

const router = Router();

router.post("/login", loginLimiter, validate({ body: loginSchema }), asyncHandler(login));
router.post("/logout", asyncHandler(logout));
router.get("/me", authMiddleware, asyncHandler(me));

export default router;
