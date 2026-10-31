import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.model.js";
import { ApiError, ERROR_CODES } from "../utils/ApiError.js";

const JWT_ISSUER = "doctor-tracker";
const JWT_AUDIENCE = "doctor-tracker-admin";
const JWT_ALGORITHM = "HS256";

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync(
  "not-a-real-password",
  Math.min(env.BCRYPT_ROUNDS, 10),
);

export const hashPassword = (password) =>
  bcrypt.hash(password, env.BCRYPT_ROUNDS);

export async function authenticate({ email, password }) {
  const user = await User.findOne({ email })
    .select("+passwordHash")
    .maxTimeMS(5000);
  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (!user || !passwordMatches)
    throw ApiError.unauthorized("Invalid email or password");
  if (!user.isActive) {
    throw new ApiError(
      403,
      "This account has been disabled. Contact an administrator.",
      {
        code: "ACCOUNT_DISABLED",
      },
    );
  }
  return user.toJSON();
}

export function signToken(user) {
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user._id),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  });
  const { exp } = jwt.decode(token);
  return { token, expiresAt: new Date(exp * 1000) };
}

export function verifyToken(token) {
  try {
    const claims = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (!claims.sub) throw new Error("missing subject");
    return claims;
  } catch (error) {
    const message =
      error?.name === "TokenExpiredError"
        ? "Your session has expired"
        : "Invalid authentication token";
    throw new ApiError(401, message, { code: ERROR_CODES.UNAUTHENTICATED });
  }
}
