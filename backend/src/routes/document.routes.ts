import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { Document } from "../models/Document.js";
import { VerificationApplication } from "../models/VerificationApplication.js";
import { documentTypeSchema } from "../validators/schemas.js";

export const documentRouter = Router();
const uploadDirectory = path.resolve(env.UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    void mkdir(uploadDirectory, { recursive: true })
      .then(() => callback(null, uploadDirectory))
      .catch((error: unknown) => callback(error as Error, uploadDirectory));
  },
  filename: (_request, file, callback) => {
    callback(null, `${randomBytes(24).toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const supported =
      (file.mimetype === "application/pdf" && extension === ".pdf") ||
      (file.mimetype === "image/jpeg" && [".jpg", ".jpeg"].includes(extension)) ||
      (file.mimetype === "image/png" && extension === ".png");
    if (!supported) {
      callback(
        new HttpError(
          400,
          "Documents must be PDF, JPEG, or PNG.",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

documentRouter.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    if (!request.file) {
      throw new HttpError(400, "A document file is required");
    }
    const applicationId =
      typeof request.body?.applicationId === "string" ? request.body.applicationId : "";
    const applicationFilter = mongoose.isValidObjectId(applicationId)
      ? { $or: [{ _id: applicationId }, { applicationId }] }
      : { applicationId };
    const application = await VerificationApplication.findOne({
      ...applicationFilter,
      userId: request.auth?.userId,
    });
    if (!application) {
      await unlink(request.file.path);
      throw new HttpError(404, "Application not found");
    }
    if (!["Draft", "Correction Required"].includes(application.status)) {
      await unlink(request.file.path);
      throw new HttpError(409, "Documents can only be uploaded to editable applications");
    }
    try {
      await validateFileSignature(request.file.path, request.file.mimetype);
      const documentType = documentTypeSchema.parse(request.body?.documentType);
      const document = await Document.create({
        userId: request.auth?.userId,
        applicationId: application._id,
        submissionMode: application.submissionMode,
        originalName: path.basename(request.file.originalname).slice(0, 180),
        storedName: request.file.filename,
        mimeType: request.file.mimetype,
        size: request.file.size,
        documentType,
      });
      application.documentIds.push(document._id);
      await application.save();
      response.status(201).json({
        document: {
          id: document.id,
          originalName: document.originalName,
          documentType: document.documentType,
          reviewStatus: document.reviewStatus,
          size: document.size,
          createdAt: document.createdAt,
        },
      });
    } catch (error) {
      try {
        await unlink(request.file.path);
      } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error("Temporary upload cleanup failed", cleanupError);
        }
      }
      throw error;
    }
  }),
);

documentRouter.get(
  "/my",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const items = await Document.find({ userId: request.auth?.userId })
      .select("-storedName")
      .sort({ createdAt: -1 });
    response.json({ items });
  }),
);

documentRouter.get(
  "/:id",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    if (!mongoose.isValidObjectId(request.params.id)) {
      throw new HttpError(404, "Document not found");
    }
    const filter = { _id: request.params.id };
    const document = await Document.findOne(
      request.auth?.role === "admin"
        ? filter
        : { ...filter, userId: request.auth?.userId },
    ).select("+storedName");
    if (!document) {
      throw new HttpError(404, "Document not found");
    }

    const safePath = path.resolve(uploadDirectory, document.storedName);
    if (path.dirname(safePath) !== uploadDirectory) {
      throw new HttpError(404, "Document not found");
    }
    response.setHeader("Content-Type", document.mimeType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.originalName.replace(/["\\\r\n]/g, "_")}"`,
    );
    createReadStream(safePath)
      .on("error", (error) => {
        console.error("Private document read failed", error);
        if (!response.headersSent) {
          response.status(404).json({ error: "Document file is unavailable" });
        } else {
          response.destroy(error);
        }
      })
      .pipe(response);
  }),
);

documentRouter.delete(
  "/:id",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    if (!mongoose.isValidObjectId(request.params.id)) {
      throw new HttpError(404, "Document not found");
    }
    const document = await Document.findOne({
      _id: request.params.id,
      userId: request.auth?.userId,
    }).select("+storedName");
    if (!document) {
      throw new HttpError(404, "Document not found");
    }
    const application = await VerificationApplication.findOne({
      _id: document.applicationId,
      userId: request.auth?.userId,
    });
    if (application && ["Submitted", "Under Review", "Approved"].includes(application.status)) {
      throw new HttpError(409, "Documents cannot be removed after review starts");
    }
    await Promise.all([
      Document.deleteOne({ _id: document._id }),
      VerificationApplication.updateOne(
        { _id: document.applicationId },
        { $pull: { documentIds: document._id } },
      ),
      unlink(path.join(uploadDirectory, document.storedName)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      }),
    ]);
    response.status(204).end();
  }),
);

async function validateFileSignature(filePath: string, mimeType: string) {
  const buffer = await readFile(filePath);
  const valid =
    (mimeType === "application/pdf" && buffer.subarray(0, 5).toString() === "%PDF-") ||
    (mimeType === "image/png" &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === "image/jpeg" &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff);
  if (!valid) {
    throw new HttpError(400, "The file content does not match its allowed demo file type");
  }
}
