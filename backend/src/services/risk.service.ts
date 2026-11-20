export interface RiskInput {
  workflow?: "individual" | "business";
  personalInformation?: {
    fullName?: string | null;
    dateOfBirth?: string | null;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
  };
  identityInformation?: {
    nameOnDocument?: string | null;
    documentType?: string | null;
    documentReference?: string | null;
    nationality?: string | null;
  };
  businessInformation?: {
    legalName?: string | null;
    entityType?: string | null;
    registrationType?: string | null;
    registrationNumber?: string | null;
    businessActivity?: string | null;
    country?: string | null;
    registeredAddress?: string | null;
  };
  documents?: Array<{ documentType?: string }>;
}

export interface RiskResult {
  score: number;
  category: "Low Risk" | "Medium Risk" | "High Risk";
  factors: RiskFactor[];
  reasons: string[];
  suggestedActions: string[];
  disclaimer: string;
}

export interface RiskFactor {
  code: "personal-information" | "identity-information" | "name-match" | "address-proof" | "business-information";
  label: string;
  points: number;
  checked: boolean;
  applied: boolean;
  explanation: string;
  missingFields?: string[];
}

export function calculateRisk(input: RiskInput): RiskResult {
  const personal = input.personalInformation ?? {};
  const identity = input.identityInformation ?? {};
  const business = input.businessInformation ?? {};
  const isBusiness = input.workflow === "business";
  const missingPersonal = [
    { label: "Full name", value: personal.fullName },
    { label: "Date of birth", value: personal.dateOfBirth },
    { label: "Email", value: personal.email },
    { label: "Phone number", value: personal.phone },
    { label: "Country", value: personal.country },
    { label: "City", value: personal.city },
    { label: "Address", value: personal.address },
  ]
    .filter((field) => !field.value?.trim())
    .map((field) => field.label);
  const missingBusiness = [
    { label: "Legal business name", value: business.legalName },
    { label: "Entity type", value: business.entityType },
    { label: "Registration identifier type", value: business.registrationType },
    { label: "Registration number", value: business.registrationNumber },
    { label: "Business activity", value: business.businessActivity },
    { label: "Country of registration", value: business.country },
    { label: "Registered address", value: business.registeredAddress },
  ]
    .filter((field) => !field.value?.trim())
    .map((field) => field.label);
  const missingIdentity = [
    { label: "Name on document", value: identity.nameOnDocument },
    { label: "Document type", value: identity.documentType },
    { label: "Document reference", value: identity.documentReference },
    { label: "Nationality", value: identity.nationality },
  ]
    .filter((field) => !field.value?.trim())
    .map((field) => field.label);
  const hasNameMismatch = Boolean(
    personal.fullName?.trim() &&
    identity.nameOnDocument?.trim() &&
    personal.fullName.trim().toLocaleLowerCase() !==
      identity.nameOnDocument.trim().toLocaleLowerCase(),
  );
  const canCompareNames = Boolean(personal.fullName?.trim() && identity.nameOnDocument?.trim());
  const hasAddressProof = Boolean(input.documents?.some((document) =>
    ["address-proof", "utility-bill", "bank-statement", "lease-agreement", "tax-document"].includes(document.documentType ?? "")
  ));
  const factors: RiskFactor[] = [
    {
      code: "personal-information",
      label: isBusiness ? "Representative information" : "Personal information",
      points: missingPersonal.length ? (isBusiness ? 15 : 25) : 0,
      checked: true,
      applied: missingPersonal.length > 0,
      explanation: missingPersonal.length
        ? "Required personal information is incomplete."
        : "All required personal information is provided.",
      missingFields: missingPersonal,
    },
    {
      code: "identity-information",
      label: "Identity information",
      points: missingIdentity.length ? 25 : 0,
      checked: true,
      applied: missingIdentity.length > 0,
      explanation: missingIdentity.length
        ? "Required identity information is incomplete."
        : "All required identity information is provided.",
      missingFields: missingIdentity,
    },
    {
      code: "name-match",
      label: "Name consistency",
      points: hasNameMismatch ? (isBusiness ? 20 : 30) : 0,
      checked: canCompareNames,
      applied: hasNameMismatch,
      explanation: hasNameMismatch
        ? `Profile name "${personal.fullName}" does not match document name "${identity.nameOnDocument}".`
        : canCompareNames
          ? "The profile and document names match."
          : "Cannot compare names until both values are provided.",
    },
    {
      code: "address-proof",
      label: "Address proof",
      points: hasAddressProof ? 0 : (isBusiness ? 15 : 20),
      checked: true,
      applied: !hasAddressProof,
      explanation: hasAddressProof
        ? "An address-proof document is attached."
        : "No address-proof document is attached. Upload a utility bill, bank statement, lease agreement, or other accepted proof.",
    },
    ...(isBusiness
      ? [{
          code: "business-information" as const,
          label: "Business profile",
          points: missingBusiness.length ? 25 : 0,
          checked: true,
          applied: missingBusiness.length > 0,
          explanation: missingBusiness.length
            ? "Required business profile information is incomplete."
            : "The business profile fields are complete. This does not confirm registration or legal activity.",
          missingFields: missingBusiness,
        }]
      : []),
  ];

  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));

  const category = score <= 30 ? "Low Risk" : score <= 60 ? "Medium Risk" : "High Risk";
  const reasons = factors.filter((factor) => factor.applied).map((factor) => factor.explanation);
  const suggestedActions = [
    ...(missingPersonal.length || missingIdentity.length || hasNameMismatch
      ? ["Update the missing information and make sure the profile name matches the identity document."]
      : []),
    ...(!hasAddressProof ? ["Upload an address-proof document in My documents."] : []),
    ...(missingBusiness.length ? ["Complete the business registration, activity, address, and representative fields."] : []),
  ];

  return {
    score,
    category,
    factors,
    reasons: reasons.length ? reasons : ["No scoring rule raised a flag."],
    suggestedActions: suggestedActions.length ? suggestedActions : ["No changes are indicated by these rules."],
    disclaimer:
      "This is an illustrative, simulated risk assessment. It does not perform identity verification, fraud detection, sanctions screening, registry checks, or legal-activity assessment.",
  };
}
