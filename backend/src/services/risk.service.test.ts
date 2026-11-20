import { describe, expect, it } from "vitest";
import { calculateRisk } from "./risk.service.js";

describe("calculateRisk", () => {
  it("scores a complete application with an ordinary document reference as low risk", () => {
    const result = calculateRisk({
      personalInformation: {
        fullName: "Alex Morgan",
        dateOfBirth: "1990-01-01",
        email: "alex@example.com",
        phone: "555-0100",
        country: "Canada",
        city: "Toronto",
        address: "1 Main Street",
      },
      identityInformation: {
        documentType: "passport",
        documentReference: "P12345678",
        nameOnDocument: "Alex Morgan",
        nationality: "Canadian",
      },
      documents: [{ documentType: "address-proof" }],
    });
    expect(result.score).toBe(0);
    expect(result.category).toBe("Low Risk");
    expect(result.disclaimer).toContain("simulated risk assessment");
    expect(result.factors.every((factor) => !factor.applied)).toBe(true);
    expect(result.factors.reduce((total, factor) => total + factor.points, 0)).toBe(result.score);
  });

  it("adds transparent rules for missing information and address proof", () => {
    const result = calculateRisk({
      personalInformation: { fullName: "Alex Morgan" },
      identityInformation: { documentReference: "P12345678" },
    });
    expect(result.score).toBe(70);
    expect(result.category).toBe("High Risk");
    expect(result.reasons).toHaveLength(3);
    expect(result.factors.reduce((total, factor) => total + factor.points, 0)).toBe(result.score);
    expect(result.factors.find((factor) => factor.code === "personal-information")).toMatchObject({
      points: 25,
      checked: true,
      missingFields: ["Date of birth", "Email", "Phone number", "Country", "City", "Address"],
    });
    expect(result.factors.find((factor) => factor.code === "identity-information")).toMatchObject({
      points: 25,
      checked: true,
      missingFields: ["Name on document", "Document type", "Nationality"],
    });
    expect(result.factors.find((factor) => factor.code === "name-match")).toMatchObject({
      checked: false,
      points: 0,
    });
  });

  it("recognizes categorized address documents and lists address proof as the only factor", () => {
    const result = calculateRisk({
      personalInformation: {
        fullName: "Alex Morgan",
        dateOfBirth: "1990-01-01",
        email: "alex@example.com",
        phone: "555-0100",
        country: "Canada",
        city: "Toronto",
        address: "1 Main Street",
      },
      identityInformation: {
        nameOnDocument: "Alex Morgan",
        documentType: "passport",
        documentReference: "P12345678",
        nationality: "Canadian",
      },
      documents: [{ documentType: "utility-bill" }],
    });
    expect(result.score).toBe(0);
    expect(result.factors.find((factor) => factor.code === "address-proof")).toMatchObject({
      applied: false,
      checked: true,
      points: 0,
    });
  });

  it("flags a mismatch between the applicant and document names", () => {
    const result = calculateRisk({
      personalInformation: { fullName: "Alex Morgan" },
      identityInformation: {
        nameOnDocument: "Jordan Lee",
        documentReference: "P12345678",
      },
    });
    expect(result.score).toBe(100);
    expect(result.category).toBe("High Risk");
    expect(result.factors.find((factor) => factor.code === "name-match")).toMatchObject({
      applied: true,
      checked: true,
      points: 30,
      explanation: 'Profile name "Alex Morgan" does not match document name "Jordan Lee".',
    });
  });

  it("scores missing business profile details while keeping the factor total equal to the score", () => {
    const result = calculateRisk({
      workflow: "business",
      personalInformation: {
        fullName: "Riya Shah",
        dateOfBirth: "1988-04-12",
        email: "riya@example.in",
        phone: "+91-9000000000",
        country: "India",
        city: "Mumbai",
        address: "1 Market Road",
      },
      identityInformation: {
        nameOnDocument: "Riya Shah",
        documentType: "national-id",
        documentReference: "SAMPLE-1234",
        nationality: "Indian",
      },
      businessInformation: {
        legalName: "Example Private Limited",
        entityType: "Private Limited Company",
      },
      documents: [{ documentType: "address-proof" }],
    });
    expect(result.score).toBe(25);
    expect(result.factors.find((factor) => factor.code === "business-information")).toMatchObject({
      points: 25,
      applied: true,
      missingFields: [
        "Registration identifier type",
        "Registration number",
        "Business activity",
        "Country of registration",
        "Registered address",
      ],
    });
    expect(result.factors.reduce((total, factor) => total + factor.points, 0)).toBe(result.score);
    expect(result.disclaimer).toContain("legal-activity assessment");
  });
});
