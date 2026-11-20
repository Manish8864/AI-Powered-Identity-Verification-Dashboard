import { describe, expect, it } from "vitest";
import { simulateScreening } from "./screening.service.js";

const individual = {
  workflow: "individual",
  personalInformation: { fullName: "Riya Shah" },
  identityInformation: { nameOnDocument: "Riya Shah" },
  documents: [{ documentType: "identity" }, { documentType: "address-proof" }],
};

describe("simulateScreening", () => {
  it("returns a clearly simulated data match and keeps live sanctions screening disconnected", () => {
    const result = simulateScreening("Provider Alpha", individual);
    expect(result).toMatchObject({ provider: "Provider Alpha", outcome: "completed", simulated: true });
    expect(result.checks.find((check) => check.code === "identity-consistency")?.status).toBe("clear");
    expect(result.checks.find((check) => check.code === "document-completeness")?.status).toBe("clear");
    expect(result.checks.find((check) => check.code === "sanctions-pep")?.status).toBe("not-connected");
  });

  it("preserves timeout and manual-review provider outcomes", () => {
    const timeout = simulateScreening("Provider Beta", individual);
    expect(timeout.outcome).toBe("timeout");
    expect(timeout.checks[0].status).toBe("inconclusive");
    const manualReview = simulateScreening("Provider Gamma", individual);
    expect(manualReview.outcome).toBe("manual-review");
    expect(manualReview.checks[0].status).toBe("review");
  });

  it("never reports connected registry or business-activity checks for a business", () => {
    const result = simulateScreening("Provider Alpha", {
      ...individual,
      workflow: "business",
      businessInformation: {
        legalName: "Example Private Limited",
        entityType: "Private Limited Company",
        registrationType: "CIN",
        registrationNumber: "SAMPLE-CIN-123",
        businessActivity: "Software services",
      },
    });
    expect(result.checks.find((check) => check.code === "business-registry")?.status).toBe("not-connected");
    expect(result.checks.find((check) => check.code === "business-activity")).toMatchObject({
      status: "not-connected",
      details: expect.stringContaining("no sanctions"),
    });
  });
});
