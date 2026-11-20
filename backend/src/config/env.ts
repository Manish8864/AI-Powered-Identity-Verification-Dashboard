import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/compliance_platform"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(12).default("change_this_password"),
  UPLOAD_DIR: z.string().default("./private-uploads"),
});

export const env = envSchema.parse(process.env);
