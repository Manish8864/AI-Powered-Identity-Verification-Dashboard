import { model, Schema, type InferSchemaType } from "mongoose";

const personalInformationSchema = new Schema(
  {
    fullName: { type: String, trim: true, maxlength: 120 },
    dateOfBirth: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 32 },
    country: { type: String, trim: true, maxlength: 80 },
    city: { type: String, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 240 },
  },
  { _id: false },
);

const identityInformationSchema = new Schema(
  {
    nameOnDocument: { type: String, trim: true, maxlength: 120 },
    documentType: { type: String, trim: true, maxlength: 40 },
    documentReference: { type: String, trim: true, maxlength: 64 },
    nationality: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const businessInformationSchema = new Schema(
  {
    legalName: { type: String, trim: true, maxlength: 160 },
    entityType: { type: String, trim: true, maxlength: 60 },
    registrationType: { type: String, trim: true, maxlength: 40 },
    registrationNumber: { type: String, trim: true, maxlength: 80 },
    businessActivity: { type: String, trim: true, maxlength: 500 },
    country: { type: String, trim: true, maxlength: 80 },
    registeredAddress: { type: String, trim: true, maxlength: 240 },
    website: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const screeningCheckSchema = new Schema(
  {
    code: {
      type: String,
      enum: [
        "identity-consistency",
        "document-completeness",
        "sanctions-pep",
        "business-registry",
        "business-activity",
      ],
      required: true,
    },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: ["clear", "review", "not-connected", "inconclusive"],
      required: true,
    },
    details: { type: String, required: true, maxlength: 500 },
    reviewerDecision: {
      type: String,
      enum: ["accepted", "flagged", "needs-information"],
    },
    reviewerNote: { type: String, trim: true, maxlength: 2000, default: "" },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

const screeningRunSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ["Provider Alpha", "Provider Beta", "Provider Gamma"],
      required: true,
    },
    outcome: {
      type: String,
      enum: ["completed", "timeout", "manual-review"],
      required: true,
    },
    simulated: { type: Boolean, required: true, default: true },
    checks: { type: [screeningCheckSchema], default: [] },
  },
  { timestamps: true },
);

const applicationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    submissionMode: { type: String, enum: ["standard", "demo", "real"], default: "standard", index: true },
    applicationId: { type: String, required: true, unique: true, index: true },
    workflow: { type: String, enum: ["individual", "business"], default: "individual", index: true },
    personalInformation: { type: personalInformationSchema, default: () => ({}) },
    identityInformation: { type: identityInformationSchema, default: () => ({}) },
    businessInformation: { type: businessInformationSchema, default: () => ({}) },
    screeningRuns: { type: [screeningRunSchema], default: [] },
    documentIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
    status: {
      type: String,
      enum: [
        "Not Started",
        "Draft",
        "Submitted",
        "Under Review",
        "Approved",
        "Rejected",
        "Correction Required",
      ],
      default: "Draft",
      index: true,
    },
    statusChangedAt: { type: Date },
    adminViewedAt: { type: Date },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    riskCategory: { type: String, enum: ["Low Risk", "Medium Risk", "High Risk"], default: "Low Risk" },
    riskReasons: { type: [String], default: [] },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

applicationSchema.index({ status: 1, updatedAt: -1 });
applicationSchema.index({ "personalInformation.email": 1 });

export type VerificationApplicationRecord = InferSchemaType<typeof applicationSchema>;
export const VerificationApplication = model(
  "VerificationApplication",
  applicationSchema,
);
