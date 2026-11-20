import { model, Schema, type InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "VerificationApplication" },
    message: { type: String, required: true, maxlength: 300 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type NotificationRecord = InferSchemaType<typeof notificationSchema>;
export const Notification = model("Notification", notificationSchema);
