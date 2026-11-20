import { model, Schema, type InferSchemaType } from "mongoose";

const reviewSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "VerificationApplication",
      required: true,
      index: true,
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: [
        "Review Started",
        "Screening Run",
        "Check Decision",
        "Approved",
        "Rejected",
        "Correction Requested",
        "Note Added",
      ],
      required: true,
    },
    comments: { type: String, trim: true, maxlength: 2000, default: "" },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type ReviewRecord = InferSchemaType<typeof reviewSchema>;
export const Review = model("Review", reviewSchema);
