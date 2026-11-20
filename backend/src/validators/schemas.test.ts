import { describe, expect, it } from "vitest";
import { applicationInputSchema } from "./schemas.js";

describe("applicationInputSchema", () => {
  it("accepts the unified standard submission mode", () => {
    expect(applicationInputSchema.parse({ submissionMode: "standard" })).toEqual({
      submissionMode: "standard",
    });
  });

  it("accepts business workflow data and registration details", () => {
    expect(applicationInputSchema.parse({
      workflow: "business",
      businessInformation: {
        legalName: "Example Private Limited",
        entityType: "Private Limited Company",
        registrationType: "CIN",
        registrationNumber: "SAMPLE-CIN-123",
        businessActivity: "Software services",
        country: "India",
        registeredAddress: "1 Market Road",
      },
    })).toMatchObject({
      workflow: "business",
      businessInformation: {
        registrationType: "CIN",
        country: "India",
      },
    });
  });

  it("accepts India-relevant identity document types", () => {
    expect(applicationInputSchema.parse({
      identityInformation: { documentType: "aadhaar" },
    })).toMatchObject({
      identityInformation: { documentType: "aadhaar" },
    });
  });
});
