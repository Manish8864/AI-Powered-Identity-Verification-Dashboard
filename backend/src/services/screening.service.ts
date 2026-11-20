export type ScreeningProvider = "Provider Alpha" | "Provider Beta" | "Provider Gamma";
export type ScreeningCheckCode =
  | "identity-consistency"
  | "document-completeness"
  | "sanctions-pep"
  | "business-registry"
  | "business-activity";
export type ScreeningCheckStatus = "clear" | "review" | "not-connected" | "inconclusive";

export interface ScreeningCheckResult {
  code: ScreeningCheckCode;
  label: string;
  status: ScreeningCheckStatus;
  details: string;
}

export interface ScreeningResult {
  provider: ScreeningProvider;
  outcome: "completed" | "timeout" | "manual-review";
  simulated: true;
  checks: ScreeningCheckResult[];
}

interface ScreeningInput {
  workflow?: string | null;
  personalInformation?: {
    fullName?: string | null;
  };
  identityInformation?: {
    nameOnDocument?: string | null;
  };
  businessInformation?: {
    legalName?: string | null;
    entityType?: string | null;
    registrationNumber?: string | null;
    registrationType?: string | null;
    businessActivity?: string | null;
  };
  documents: Array<{ documentType?: string | null }>;
}

export function simulateScreening(
  provider: ScreeningProvider,
  application: ScreeningInput,
): ScreeningResult {
  const isBusiness = application.workflow === "business";
  const personalName = application.personalInformation?.fullName?.trim();
  const documentName = application.identityInformation?.nameOnDocument?.trim();
  const business = application.businessInformation;
  const identityMatches = Boolean(
    personalName &&
    documentName &&
    personalName.toLocaleLowerCase() === documentName.toLocaleLowerCase(),
  );
  const documents = application.documents;
  const hasIdentityDocument = documents.some((document) =>
    ["identity", "passport", "national-id", "driver-license"].includes(document.documentType ?? ""),
  );
  const hasAddressProof = documents.some((document) =>
    ["address-proof", "utility-bill", "bank-statement", "lease-agreement", "tax-document"].includes(document.documentType ?? ""),
  );
  const hasBusinessRegistration = documents.some((document) => document.documentType === "business-registration");
  const completed = provider === "Provider Alpha";
  const manualReview = provider === "Provider Gamma";
  const statusForData = (ready: boolean): ScreeningCheckStatus => {
    if (!completed) return manualReview ? "review" : "inconclusive";
    return ready ? "clear" : "review";
  };
  const checks: ScreeningCheckResult[] = [
    {
      code: "identity-consistency",
      label: "Applicant identity consistency",
      status: statusForData(identityMatches),
      details: identityMatches
        ? "The submitted profile and document names match. This demo compares text only; it does not inspect or authenticate the document."
        : "Names are missing or differ. A reviewer should compare the submitted information; no identity source was queried.",
    },
    {
      code: "document-completeness",
      label: "Document set completeness",
      status: statusForData(hasIdentityDocument && hasAddressProof),
      details: hasIdentityDocument && hasAddressProof
        ? "Identity and address-proof categories are attached. File contents have not been verified."
        : `Missing ${[
            ...(!hasIdentityDocument ? ["an identity document"] : []),
            ...(!hasAddressProof ? ["address proof"] : []),
          ].join(" and ")}. Uploaded files are not authenticity-checked.`,
    },
    {
      code: "sanctions-pep",
      label: "Sanctions and PEP screening",
      status: "not-connected",
      details: "No sanctions, politically exposed person, or adverse-media data source is connected. No match/no-match determination was made.",
    },
  ];

  if (isBusiness) {
    const hasBusinessProfile = Boolean(
      business?.legalName?.trim() &&
      business.entityType?.trim() &&
      business.registrationType?.trim() &&
      business.registrationNumber?.trim() &&
      business.businessActivity?.trim(),
    );
    checks.push(
      {
        code: "business-registry",
        label: "Business registry",
        status: "not-connected",
        details: hasBusinessRegistration
          ? "A business-registration document is attached, but no government registry was queried."
          : "No business-registration document is attached and no government registry is connected.",
      },
      {
        code: "business-activity",
        label: "Business activity",
        status: hasBusinessProfile ? "not-connected" : "inconclusive",
        details: hasBusinessProfile
          ? "Business activity details were collected, but no sanctions, adverse-media, licensing, or legal-activity source is connected."
          : "Business profile information is incomplete; legal activity cannot be assessed.",
      },
    );
  }

  return {
    provider,
    outcome: provider === "Provider Beta" ? "timeout" : manualReview ? "manual-review" : "completed",
    simulated: true,
    checks,
  };
}

export function getScreeningInput(
  application: {
    workflow: "individual" | "business";
    personalInformation: ScreeningInput["personalInformation"];
    identityInformation: ScreeningInput["identityInformation"];
    businessInformation: ScreeningInput["businessInformation"];
  },
  documents: Array<{ documentType?: string | null }>,
): ScreeningInput {
  return {
    workflow: application.workflow,
    personalInformation: application.personalInformation,
    identityInformation: application.identityInformation,
    businessInformation: application.businessInformation,
    documents,
  };
}
