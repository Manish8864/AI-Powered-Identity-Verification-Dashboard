import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { Document } from "../models/Document.js";
import { VerificationApplication } from "../models/VerificationApplication.js";
import { calculateRisk } from "../services/risk.service.js";

export const riskRouter = Router();

riskRouter.get(
  "/my",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const applications = await VerificationApplication.find({
      userId: request.auth?.userId,
      submittedAt: { $exists: true },
    }).sort({ submittedAt: -1 });
    response.json({
      items: await Promise.all(
        applications.map(async (application) => {
          const documents = await Document.find({
            _id: { $in: application.documentIds },
          }).select("documentType");
          return {
            applicationId: application.applicationId,
            workflow: application.workflow,
            businessName: application.businessInformation?.legalName,
            status: application.status,
            submittedAt: application.submittedAt,
            ...calculateRisk({
              workflow: application.workflow,
              personalInformation: application.personalInformation,
              identityInformation: application.identityInformation,
              businessInformation: application.businessInformation,
              documents,
            }),
          };
        }),
      ),
    });
  }),
);

riskRouter.get(
  "/:applicationId",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const application = await VerificationApplication.findOne({
      applicationId: request.params.applicationId,
      userId: request.auth?.userId,
    });
    if (!application) {
      throw new HttpError(404, "Application not found");
    }
    if (!application.submittedAt) {
      throw new HttpError(409, "Risk assessment is available after submission");
    }
    const documents = await Document.find({
      _id: { $in: application.documentIds },
    }).select("documentType");
    response.json({
      applicationId: application.applicationId,
      workflow: application.workflow,
      businessName: application.businessInformation?.legalName,
      status: application.status,
      submittedAt: application.submittedAt,
      ...calculateRisk({
        workflow: application.workflow,
        personalInformation: application.personalInformation,
        identityInformation: application.identityInformation,
        businessInformation: application.businessInformation,
        documents,
      }),
    });
  }),
);
