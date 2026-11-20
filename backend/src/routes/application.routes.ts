import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { Document } from "../models/Document.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { VerificationApplication } from "../models/VerificationApplication.js";
import { calculateRisk } from "../services/risk.service.js";
import { updateStatusWithTimestamp } from "../services/statusTimestamp.js";
import { applicationInputSchema } from "../validators/schemas.js";

export const applicationRouter = Router();

applicationRouter.post(
  "/",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const input = applicationInputSchema.parse(request.body ?? {});
    const application = await VerificationApplication.create({
      userId: request.auth?.userId,
      applicationId: `KYC-${randomUUID().slice(0, 8).toUpperCase()}`,
      statusChangedAt: new Date(),
      ...input,
    });
    response.status(201).json({ application });
  }),
);

applicationRouter.get(
  "/my",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const items = await VerificationApplication.find({ userId: request.auth?.userId })
      .sort({ updatedAt: -1 })
      .populate("documentIds", "originalName documentType reviewStatus createdAt");
    response.json({ items, total: items.length, page: 1, pages: 1 });
  }),
);

applicationRouter.get(
  "/:id",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const application = await getOwnedApplication(routeParam(request.params.id), request.auth?.userId);
    const documents = await Document.find({
      _id: { $in: application.documentIds },
      userId: request.auth?.userId,
    }).select("-storedName");
    response.json({ application, documents });
  }),
);

applicationRouter.put(
  "/:id",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const application = await getOwnedApplication(routeParam(request.params.id), request.auth?.userId);
    if (!["Draft", "Correction Required"].includes(application.status)) {
      throw new HttpError(409, "Only draft or correction-requested applications can be edited");
    }
    const input = applicationInputSchema.parse(request.body ?? {});
    if (input.submissionMode) {
      application.submissionMode = input.submissionMode;
    }
    if (input.workflow) {
      application.workflow = input.workflow;
    }
    if (input.personalInformation) {
      application.set("personalInformation", {
        ...application.personalInformation,
        ...input.personalInformation,
      });
    }
    if (input.identityInformation) {
      application.set("identityInformation", {
        ...application.identityInformation,
        ...input.identityInformation,
      });
    }
    if (input.businessInformation) {
      application.set("businessInformation", {
        ...application.businessInformation,
        ...input.businessInformation,
      });
    }
    await application.save();
    response.json({ application });
  }),
);

applicationRouter.post(
  "/:id/submit",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const application = await getOwnedApplication(routeParam(request.params.id), request.auth?.userId);
    if (!["Draft", "Correction Required"].includes(application.status)) {
      throw new HttpError(409, "This application has already been submitted for review");
    }
    const documents = await Document.find({ _id: { $in: application.documentIds } })
      .select("documentType")
      .lean();
    const risk = calculateRisk({
      workflow: application.workflow,
      personalInformation: application.personalInformation,
      identityInformation: application.identityInformation,
      businessInformation: application.businessInformation,
      documents,
    });
    updateStatusWithTimestamp(application, "Submitted");
    application.submittedAt = new Date();
    application.riskScore = risk.score;
    application.riskCategory = risk.category;
    application.riskReasons = risk.reasons;
    await application.save();
    const admins = await User.find({ role: "admin" }).select("_id").lean();
    await Notification.insertMany([
      {
        userId: application.userId,
        applicationId: application._id,
        message: `Application ${application.applicationId} was submitted for review.`,
      },
      ...admins.map((admin) => ({
        userId: admin._id,
        applicationId: application._id,
        message: `New application ${application.applicationId} was submitted for review.`,
      })),
    ]);
    response.json({ application, risk });
  }),
);

export async function getOwnedApplication(id: string, userId?: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(404, "Application not found");
  }
  const application = await VerificationApplication.findOne({ _id: id, userId });
  if (!application) {
    throw new HttpError(404, "Application not found");
  }
  return application;
}

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
