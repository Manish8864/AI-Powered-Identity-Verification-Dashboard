import { model, Schema, type InferSchemaType } from "mongoose";

const documentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    submissionMode: { type: String, enum: ["standard", "demo", "real"], default: "standard", index: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "VerificationApplication",
      required: true,
      index: true,
    },
    originalName: { type: String, required: true, maxlength: 180 },
    storedName: { type: String, required: true, unique: true, select: false },
    mimeType: { type: String, required: true, enum: ["application/pdf", "image/jpeg", "image/png"] },
    size: { type: Number, required: true, max: 5 * 1024 * 1024 },
    documentType: {
      type: String,
      required: true,
      enum: [
        "identity",
        "passport",
        "national-id",
        "driver-license",
        "residence-permit",
        "voter-id",
        "birth-certificate",
        "address-proof",
        "utility-bill",
        "bank-statement",
        "lease-agreement",
        "tax-document",
        "employment-letter",
        "business-registration",
        "supporting",
      ],
    },
    reviewStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export type DocumentRecord = InferSchemaType<typeof documentSchema>;
export const Document = model("Document", documentSchema);
