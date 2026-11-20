import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../middleware/errorHandler.js";

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) {
    throw new HttpError(409, "An account with this email already exists");
  }
  const user = await User.create({
    name: input.name,
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: "user",
  });
  return {
    token: signToken(user._id.toString(), "user"),
    user: publicUser({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    }),
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash",
  );
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  return {
    token: signToken(user._id.toString(), user.role),
    user: publicUser({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    }),
  };
}

export function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function signToken(userId: string, role: "user" | "admin") {
  try {
    return jwt.sign({ role }, env.JWT_SECRET, { subject: userId, expiresIn: "8h" });
  } catch (error) {
    throw new HttpError(500, "Unable to create authentication token. Please contact support.");
  }
}
