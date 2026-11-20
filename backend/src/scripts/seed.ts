import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { VerificationApplication } from "../models/VerificationApplication.js";

const demoPassword = "DemoCustomer!2026";
const statuses = [
  "Approved",
  "Under Review",
  "Submitted",
  "Rejected",
  "Correction Required",
  "Draft",
  "Approved",
  "Submitted",
  "Under Review",
  "Rejected",
] as const;
const riskScores = [12, 38, 55, 74, 62, 80, 18, 30, 45, 93];
const fictionalNames = [
  "Avery Morgan",
  "Jordan Lee",
  "Taylor Quinn",
  "Riley Brooks",
  "Casey Rowan",
  "Morgan Ellis",
  "Jamie Parker",
  "Alex Sutton",
  "Dakota Reed",
  "Cameron Blake",
];

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  const adminPasswordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  const admin = await User.findOneAndUpdate(
    { email: env.ADMIN_EMAIL.toLowerCase() },
    {
      $set: { name: "Administrator", passwordHash: adminPasswordHash, role: "admin" },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  for (let index = 0; index < fictionalNames.length; index += 1) {
    const email = `customer${String(index + 1).padStart(2, "0")}@example.com`;
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: fictionalNames[index],
          passwordHash,
          role: "user",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const applicationId = `KYC-DEMO-${String(index + 1).padStart(4, "0")}`;
    const application = await VerificationApplication.findOneAndUpdate(
      { applicationId },
      {
        $setOnInsert: {
          userId: user._id,
          applicationId,
          personalInformation: {
            fullName: fictionalNames[index],
            dateOfBirth: "1990-01-15",
            email,
            phone: "+1-555-0100",
            country: "Exampleland",
            city: "Sample City",
            address: `${index + 10} Demo Avenue`,
          },
          identityInformation: {
            documentType: "passport",
            documentReference: `DEMO-${String(index + 1).padStart(6, "0")}`,
            nationality: "Exampleland",
          },
          status: statuses[index],
          riskScore: riskScores[index],
          riskCategory:
            riskScores[index] <= 30
              ? "Low Risk"
              : riskScores[index] <= 60
                ? "Medium Risk"
                : "High Risk",
          riskReasons: ["Synthetic demonstration record; no identity verification performed."],
          submittedAt:
            statuses[index] === "Draft"
              ? undefined
              : new Date(Date.now() - index * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (["Approved", "Rejected", "Correction Required"].includes(statuses[index])) {
      await Review.updateOne(
        { applicationId: application._id, action: statuses[index] === "Correction Required" ? "Correction Requested" : statuses[index] },
        {
          $setOnInsert: {
            applicationId: application._id,
            adminId: admin._id,
            action: statuses[index] === "Correction Required" ? "Correction Requested" : statuses[index],
            comments: "Seeded synthetic demo review.",
            previousStatus: "Under Review",
            newStatus: statuses[index],
          },
        },
        { upsert: true },
      );
    }
  }

  console.log(`Seeded demo administrator and ${fictionalNames.length} fictional customers.`);
  console.log(`Admin login: ${env.ADMIN_EMAIL}`);
  console.log(`Customer login: customer01@example.com / ${demoPassword}`);
  await mongoose.disconnect();
}

seed().catch(async (error: unknown) => {
  console.error("Demo data seed failed", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
