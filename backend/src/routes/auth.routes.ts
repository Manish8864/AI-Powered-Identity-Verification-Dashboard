import { Router } from "express";
import { User } from "../models/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { loginSchema, registerSchema } from "../validators/schemas.js";
import { loginUser, publicUser, registerUser } from "../services/auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (request, response) => {
    const body = request.body ?? {};
    const result = await registerUser(
      registerSchema.parse({
        ...body,
        name: body.name ?? body.fullName,
      }),
    );
    response.status(201).json(result);
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    response.json(await loginUser(loginSchema.parse(request.body)));
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const user = await User.findById(request.auth?.userId);
    if (!user) {
      response.status(401).json({ error: "Account no longer exists" });
      return;
    }
    response.json({
      user: publicUser({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      }),
    });
  }),
);
