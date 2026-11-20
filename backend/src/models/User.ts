import { model, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user", required: true },
    profilePhotoName: { type: String, select: false },
    profilePhotoMimeType: { type: String, enum: ["image/jpeg", "image/png"] },
  },
  { timestamps: true },
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
