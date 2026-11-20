import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const personalInformationSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  dateOfBirth: z.string().max(20).optional(),
  email: z.string().trim().max(254).optional(),
  phone: z.string().trim().max(32).optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(240).optional(),
});

const identityInformationSchema = z.object({
  nameOnDocument: z.string().trim().max(120).optional(),
  documentType: z.enum(["passport", "national-id", "driver-license", "aadhaar", "pan", "voter-id"]).optional(),
  documentReference: z.string().trim().max(64).optional(),
  nationality: z.string().trim().max(80).optional(),
});

const businessInformationSchema = z.object({
  legalName: z.string().trim().max(160).optional(),
  entityType: z.string().trim().max(60).optional(),
  registrationType: z.string().trim().max(40).optional(),
  registrationNumber: z.string().trim().max(80).optional(),
  businessActivity: z.string().trim().max(500).optional(),
  country: z.string().trim().max(80).optional(),
  registeredAddress: z.string().trim().max(240).optional(),
  website: z.string().trim().max(200).optional(),
});

export const applicationInputSchema = z.object({
  submissionMode: z.enum(["standard", "demo", "real"]).optional(),
  workflow: z.enum(["individual", "business"]).optional(),
  personalInformation: personalInformationSchema.optional(),
  identityInformation: identityInformationSchema.optional(),
  businessInformation: businessInformationSchema.optional(),
});

export const screeningProviderSchema = z.enum(["Provider Alpha", "Provider Beta", "Provider Gamma"]);

export const screeningCheckCodeSchema = z.enum([
  "identity-consistency",
  "document-completeness",
  "sanctions-pep",
  "business-registry",
  "business-activity",
]);

export const screeningDecisionSchema = z.object({
  decision: z.enum(["accepted", "flagged", "needs-information"]),
  comments: z.string().trim().max(2000).optional().default(""),
});

export const statusChangeSchema = z.object({
  status: z.enum(["Under Review", "Approved", "Rejected", "Correction Required"]),
  comments: z.string().trim().max(2000).optional().default(""),
});

export const reviewNoteSchema = z.object({
  comments: z.string().trim().min(1).max(2000),
});

export const documentTypeSchema = z.enum([
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
]);
