import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { Document } from "../models/Document.js";
import { Notification } from "../models/Notification.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { VerificationApplication } from "../models/VerificationApplication.js";
import { getScreeningInput, simulateScreening } from "../services/screening.service.js";
import { getPagination, paginationResult } from "../utils/pagination.js";
import { getReportBucketKeys, getReportWindow, type AdminReportRange, type ReportBucketUnit } from "../services/reporting.js";
import { updateStatusWithTimestamp } from "../services/statusTimestamp.js";
import {
  reviewNoteSchema,
  screeningCheckCodeSchema,
  screeningDecisionSchema,
  screeningProviderSchema,
  statusChangeSchema,
} from "../validators/schemas.js";

export const adminRouter = Router();

adminRouter.get(
  "/dashboard",
  asyncHandler(async (_request, response) => {
    const [
      totalCustomers,
      verifiedCustomers,
      pendingReviews,
      rejectedApplications,
      correctionRequests,
      highRiskApplications,
      recent,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      VerificationApplication.distinct("userId", { status: "Approved" }).then(
        (users) => users.length,
      ),
      VerificationApplication.countDocuments({
        status: { $in: ["Submitted", "Under Review"] },
      }),
      VerificationApplication.countDocuments({ status: "Rejected" }),
      VerificationApplication.countDocuments({ status: "Correction Required" }),
      VerificationApplication.countDocuments({ riskCategory: "High Risk" }),
      VerificationApplication.find({
        submittedAt: { $exists: true, $ne: null },
        adminViewedAt: { $exists: false },
      })
        .sort({ submittedAt: -1, createdAt: -1 })
        .populate("userId", "name email")
        .lean(),
    ]);

    response.json({
      stats: {
        totalCustomers,
        verifiedCustomers,
        pendingReviews,
        rejectedApplications,
        correctionRequests,
        highRiskApplications,
      },
      recentApplications: recent.map((application) => {
        const applicant = application.userId as unknown as {
          name?: string;
          email?: string;
        } | null;
        return {
          id: application._id,
          applicationId: application.applicationId,
          fullName: application.workflow === "business"
            ? application.businessInformation?.legalName ?? applicant?.name ?? "Unknown business"
            : application.personalInformation?.fullName ?? applicant?.name ?? "Unknown customer",
          email: applicant?.email ?? "",
          workflow: application.workflow,
          businessInformation: application.workflow === "business"
            ? { legalName: application.businessInformation?.legalName }
            : undefined,
          status: application.status,
          riskScore: application.riskScore,
          submittedAt: application.submittedAt,
          statusChangedAt: application.statusChangedAt,
          updatedAt: application.updatedAt,
        };
      }),
    });
  }),
);

adminRouter.get(
  "/reports",
  asyncHandler(async (request, response) => {
    const requestedRange = request.query.range;
    const range: AdminReportRange =
      requestedRange === "3d" ||
      requestedRange === "7d" ||
      requestedRange === "90d" ||
      requestedRange === "12m"
        ? requestedRange
        : "30d";
    const { start, end, unit } = getReportWindow(range);
    const applicationMatch = { submittedAt: { $gte: start, $lte: end } };
    const [applicationReport, registrationRows, newCustomers] = await Promise.all([
      VerificationApplication.aggregate([
        { $match: applicationMatch },
        {
          $facet: {
            trends: [
              {
                $group: {
                  _id: reportBucketExpression("$submittedAt", unit),
                  submitted: { $sum: 1 },
                  approved: {
                    $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ],
            outcomes: [
              { $group: { _id: "$status", value: { $sum: 1 } } },
            ],
            risks: [
              { $group: { _id: "$riskCategory", value: { $sum: 1 } } },
            ],
            summary: [
              {
                $group: {
                  _id: null,
                  applicationsSubmitted: { $sum: 1 },
                  approved: {
                    $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
                  },
                  rejected: {
                    $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] },
                  },
                  awaitingReview: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["Submitted", "Under Review"]] },
                        1,
                        0,
                      ],
                    },
                  },
                  totalRiskScore: { $sum: { $ifNull: ["$riskScore", 0] } },
                },
              },
            ],
          },
        },
      ]).then(([result]) => result),
      User.aggregate([
        { $match: { role: "user", createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: reportBucketExpression("$createdAt", unit),
            customers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({ role: "user", createdAt: { $gte: start, $lte: end } }),
    ]);

    const trendByBucket = new Map<string, { submitted: number; approved: number }>(
      (applicationReport?.trends ?? []).map((item: {
        _id: string;
        submitted: number;
        approved: number;
      }) => [item._id, item] as const),
    );
    const registrationByBucket = new Map(
      registrationRows.map((item: { _id: string; customers: number }) => [
        item._id,
        item.customers,
      ]),
    );
    const trendBuckets = getReportBucketKeys(start, end, unit);
    const summary = applicationReport?.summary?.[0];
    const applicationsSubmitted = summary?.applicationsSubmitted ?? 0;
    const statuses = ["Submitted", "Under Review", "Approved", "Rejected", "Correction Required"];
    const riskCategories = ["Low Risk", "Medium Risk", "High Risk"];
    const outcomesByStatus = new Map(
      (applicationReport?.outcomes ?? []).map((item: { _id: string; value: number }) => [
        item._id,
        item.value,
      ]),
    );
    const risksByCategory = new Map(
      (applicationReport?.risks ?? []).map((item: { _id: string; value: number }) => [
        item._id,
        item.value,
      ]),
    );

    response.json({
      range,
      period: { start, end },
      summary: {
        applicationsSubmitted,
        newCustomers,
        approved: summary?.approved ?? 0,
        rejected: summary?.rejected ?? 0,
        awaitingReview: summary?.awaitingReview ?? 0,
        averageRiskScore: applicationsSubmitted
          ? Math.round((summary.totalRiskScore / applicationsSubmitted) * 10) / 10
          : 0,
      },
      trends: trendBuckets.map((key) => {
        const bucket = trendByBucket.get(key);
        return unit === "month"
          ? { month: key, submitted: bucket?.submitted ?? 0, approved: bucket?.approved ?? 0 }
          : { date: key, submitted: bucket?.submitted ?? 0, approved: bucket?.approved ?? 0 };
      }),
      outcomes: statuses.map((name) => ({ name, value: outcomesByStatus.get(name) ?? 0 })),
      registrations: trendBuckets.map((key) => {
        const customers = registrationByBucket.get(key) ?? 0;
        return unit === "month" ? { month: key, customers } : { date: key, customers };
      }),
      riskDistribution: riskCategories.map((name) => ({
        name,
        value: risksByCategory.get(name) ?? 0,
      })),
    });
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = getPagination(
      request.query as Record<string, unknown>,
    );
    const search = safeSearch(request.query.search);
    const filter: Record<string, unknown> = { role: "user" };
    if (search) filter.$or = [{ name: search }, { email: search }];
    const [result] = await User.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: VerificationApplication.collection.name,
          let: { customerId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$customerId"] } } },
            { $sort: { updatedAt: -1, createdAt: -1 } },
            { $limit: 1 },
            { $project: { personalInformation: 1, identityInformation: 1 } },
          ],
          as: "latestApplication",
        },
      },
      {
        $unwind: {
          path: "$latestApplication",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $facet: {
          items: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                id: "$_id",
                name: 1,
                email: 1,
                createdAt: 1,
                latestApplication: {
                  $cond: [
                    { $ifNull: ["$latestApplication._id", false] },
                    {
                      personalInformation: "$latestApplication.personalInformation",
                      identityInformation: "$latestApplication.identityInformation",
                    },
                    null,
                  ],
                },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);
    const items = result?.items ?? [];
    const total = result?.total?.[0]?.count ?? 0;
    response.json({ items, ...paginationResult(total, page, limit) });
  }),
);

adminRouter.get(
  "/applications",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = getPagination(
      request.query as Record<string, unknown>,
    );
    const search = safeSearch(request.query.search);
    const filter: Record<string, unknown> = {};
    if (typeof request.query.statuses === "string") {
      const statuses = request.query.statuses.split(",").map((status) => status.trim()).filter(Boolean);
      if (statuses.length) filter.status = { $in: statuses };
    } else if (typeof request.query.status === "string") {
      filter.status = request.query.status;
    }
    if (typeof request.query.riskCategory === "string") {
      filter.riskCategory = request.query.riskCategory;
    }
    if (search) {
      const matchingUsers = await User.find({
        role: "user",
        $or: [{ name: search }, { email: search }],
      }).distinct("_id");
      filter.$or = [
        { applicationId: search },
        { "personalInformation.fullName": search },
        { "personalInformation.email": search },
        { "businessInformation.legalName": search },
        { "businessInformation.registrationNumber": search },
        { userId: { $in: matchingUsers } },
      ];
    }

    const [items, total] = await Promise.all([
      VerificationApplication.find(filter)
        .populate("userId", "name email")
        .sort({ submittedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VerificationApplication.countDocuments(filter),
    ]);
    response.json({ items, ...paginationResult(total, page, limit) });
  }),
);

adminRouter.get(
  "/applications/:id",
  asyncHandler(async (request, response) => {
    const application = await findApplication(routeParam(request.params.id));
    const [documents, reviews] = await Promise.all([
      Document.find({ applicationId: application._id }).select("-storedName"),
      Review.find({ applicationId: application._id })
        .populate("adminId", "name email")
        .sort({ createdAt: -1 }),
    ]);
    response.json({ application, documents, reviews });
  }),
);

adminRouter.patch(
  "/applications/:id/seen",
  asyncHandler(async (request, response) => {
    const application = await findApplication(routeParam(request.params.id));
    if (!application.adminViewedAt) {
      application.adminViewedAt = new Date();
      await application.save({ timestamps: false });
    }
    response.json({ application });
  }),
);

adminRouter.patch(
  "/applications/:id/status",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const { status, comments } = statusChangeSchema.parse(request.body);
    const application = await findApplication(routeParam(request.params.id));
    const previousStatus = application.status;
    updateStatusWithTimestamp(application, status);
    await application.save();

    const action =
      status === "Under Review"
        ? "Review Started"
        : status === "Approved"
          ? "Approved"
          : status === "Rejected"
            ? "Rejected"
            : "Correction Requested";
    const [review] = await Promise.all([
      Review.create({
        applicationId: application._id,
        adminId: request.auth?.userId,
        action,
        comments,
        previousStatus,
        newStatus: status,
      }),
      Notification.create({
        userId: application.userId,
        applicationId: application._id,
        message: `Your application ${application.applicationId} is now ${status.toLowerCase()}.${comments ? ` Review note: ${comments}` : ""}`,
      }),
    ]);
    response.json({ application, review });
  }),
);

adminRouter.post(
  "/applications/:id/screening",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const provider = screeningProviderSchema.parse(request.body?.provider);
    const application = await findApplication(routeParam(request.params.id));
    if (!["Submitted", "Under Review"].includes(application.status)) {
      throw new HttpError(409, "Screening runs are available for submitted applications under review");
    }
    const documents = await Document.find({ applicationId: application._id })
      .select("documentType")
      .lean();
    const result = simulateScreening(provider, getScreeningInput(application, documents));
    application.screeningRuns.push(result);
    await application.save();
    const run = application.screeningRuns[application.screeningRuns.length - 1];
    await Review.create({
      applicationId: application._id,
      adminId: request.auth?.userId,
      action: "Screening Run",
      comments: `${provider} simulator returned ${result.outcome}. No live identity, sanctions, registry, or legal-activity sources were queried.`,
      previousStatus: application.status,
      newStatus: application.status,
    });
    response.status(201).json({ screeningRun: run });
  }),
);

adminRouter.patch(
  "/applications/:id/screening/:runId/:checkCode",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const { decision, comments } = screeningDecisionSchema.parse(request.body);
    const checkCode = screeningCheckCodeSchema.parse(routeParam(request.params.checkCode));
    const application = await findApplication(routeParam(request.params.id));
    const run = application.screeningRuns.id(routeParam(request.params.runId));
    const check = run?.checks.find((item) => item.code === checkCode);
    if (!run || !check) {
      throw new HttpError(404, "Screening check not found");
    }
    if (decision === "accepted" && ["not-connected", "inconclusive"].includes(check.status)) {
      throw new HttpError(409, "A check without a completed data result cannot be accepted");
    }
    check.reviewerDecision = decision;
    check.reviewerNote = comments;
    const reviewerUserId = request.auth?.userId;
    if (!reviewerUserId || !mongoose.isValidObjectId(reviewerUserId)) {
      throw new HttpError(401, "Administrator authentication is required");
    }
    check.reviewerId = new mongoose.Types.ObjectId(reviewerUserId);
    check.reviewedAt = new Date();
    await application.save();
    await Review.create({
      applicationId: application._id,
      adminId: request.auth?.userId,
      action: "Check Decision",
      comments: `${check.label}: ${decision}${comments ? ` — ${comments}` : ""}`,
      previousStatus: application.status,
      newStatus: application.status,
    });
    response.json({ screeningRun: run });
  }),
);

adminRouter.post(
  "/applications/:id/review",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const { comments } = reviewNoteSchema.parse(request.body);
    const application = await findApplication(routeParam(request.params.id));
    const review = await Review.create({
      applicationId: application._id,
      adminId: request.auth?.userId,
      action: "Note Added",
      comments,
      previousStatus: application.status,
      newStatus: application.status,
    });
    response.status(201).json({ review });
  }),
);

adminRouter.get(
  "/reviews",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = getPagination(
      request.query as Record<string, unknown>,
    );
    const filter: Record<string, unknown> = {};
    if (typeof request.query.action === "string" && request.query.action) {
      filter.action = request.query.action;
    }
    if (request.query.range === "7d" || request.query.range === "30d" || request.query.range === "90d") {
      const days = Number(request.query.range.slice(0, -1));
      filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    const search = safeSearch(request.query.search);
    if (search) {
      const [admins, customers] = await Promise.all([
        User.find({
          role: "admin",
          $or: [{ name: search }, { email: search }],
        }).distinct("_id"),
        User.find({
          role: "user",
          $or: [{ name: search }, { email: search }],
        }).distinct("_id"),
      ]);
      const applications = await VerificationApplication.find({
        $or: [
          { applicationId: search },
          { "personalInformation.fullName": search },
          { "personalInformation.email": search },
          { "businessInformation.legalName": search },
          { "businessInformation.registrationNumber": search },
          { userId: { $in: customers } },
        ],
      }).distinct("_id");
      filter.$or = [
        { comments: search },
        { applicationId: { $in: applications } },
        { adminId: { $in: admins } },
      ];
    }
    const [items, total] = await Promise.all([
      Review.find(filter)
        .populate("adminId", "name email")
        .populate({
          path: "applicationId",
          select: "applicationId status personalInformation businessInformation userId",
          populate: { path: "userId", select: "name email" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);
    response.json({ items, ...paginationResult(total, page, limit) });
  }),
);

adminRouter.get(
  "/risk",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = getPagination(
      request.query as Record<string, unknown>,
    );
    const filter: Record<string, unknown> = { riskCategory: "High Risk" };
    if (typeof request.query.statuses === "string") {
      const statuses = request.query.statuses.split(",").map((status) => status.trim()).filter(Boolean);
      if (statuses.length) filter.status = { $in: statuses };
    } else if (typeof request.query.status === "string") {
      filter.status = request.query.status;
    }
    const search = safeSearch(request.query.search);
    if (search) {
      const matchingUsers = await User.find({
        role: "user",
        $or: [{ name: search }, { email: search }],
      }).distinct("_id");
      filter.$or = [
        { applicationId: search },
        { "personalInformation.fullName": search },
        { "personalInformation.email": search },
        { userId: { $in: matchingUsers } },
      ];
    }
    const [items, total] = await Promise.all([
      VerificationApplication.find(filter)
        .populate("userId", "name email")
        .sort({ riskScore: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      VerificationApplication.countDocuments(filter),
    ]);
    response.json({ items, ...paginationResult(total, page, limit) });
  }),
);

async function findApplication(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(404, "Application not found");
  }
  const application = await VerificationApplication.findById(id).populate(
    "userId",
    "name email",
  );
  if (!application) throw new HttpError(404, "Application not found");
  return application;
}

function safeSearch(value: unknown): RegExp | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const escaped = value.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

function reportBucketExpression(field: "$submittedAt" | "$createdAt", unit: ReportBucketUnit) {
  return {
    $dateToString: {
      format: unit === "month" ? "%Y-%m" : "%Y-%m-%d",
      date: {
        $dateTrunc: {
          date: field,
          unit,
          ...(unit === "week" ? { startOfWeek: "monday" } : {}),
          timezone: "UTC",
        },
      },
      timezone: "UTC",
    },
  };
}

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
