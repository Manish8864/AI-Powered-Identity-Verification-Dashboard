import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { User } from "../models/User.js";

export const profileRouter = Router();
const uploadDirectory = path.resolve(env.UPLOAD_DIR);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      void mkdir(uploadDirectory, { recursive: true })
        .then(() => callback(null, uploadDirectory))
        .catch((error: unknown) => callback(error as Error, uploadDirectory));
    },
    filename: (request: AuthenticatedRequest, file, callback) => {
      const extension = file.mimetype === "image/png" ? ".png" : ".jpg";
      callback(null, `profile-${request.auth?.userId}-${randomBytes(24).toString("hex")}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const valid =
      (file.mimetype === "image/jpeg" && [".jpg", ".jpeg"].includes(extension)) ||
      (file.mimetype === "image/png" && extension === ".png");
    if (!valid) {
      callback(new HttpError(400, "Profile photos must be JPEG or PNG images."));
      return;
    }
    callback(null, true);
  },
});

profileRouter.put(
  "/photo",
  upload.single("file"),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    if (!request.file) {
      throw new HttpError(400, "A profile photo is required");
    }
    let previousPhoto: string | undefined;
    try {
      const mimeType = await validateImageSignature(request.file.path, request.file.mimetype);
      const user = await User.findById(request.auth?.userId).select("+profilePhotoName");
      if (!user) {
        throw new HttpError(404, "Account not found");
      }
      previousPhoto = user.profilePhotoName ?? undefined;
      user.profilePhotoName = request.file.filename;
      user.profilePhotoMimeType = mimeType;
      await user.save();
    } catch (error) {
      await unlink(request.file.path).catch((cleanupError: NodeJS.ErrnoException) => {
        if (cleanupError.code !== "ENOENT") {
          console.error("Profile photo cleanup failed", cleanupError);
        }
      });
      throw error;
    }
    if (previousPhoto) {
      await unlink(path.join(uploadDirectory, previousPhoto)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          console.error("Previous profile photo cleanup failed", error);
        }
      });
    }
    response.json({ message: "Profile photo updated" });
  }),
);

profileRouter.get(
  "/photo",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const user = await User.findById(request.auth?.userId)
      .select("+profilePhotoName profilePhotoMimeType");
    if (!user?.profilePhotoName || !user.profilePhotoMimeType) {
      throw new HttpError(404, "Profile photo not found");
    }
    const safePath = path.resolve(uploadDirectory, user.profilePhotoName);
    if (path.dirname(safePath) !== uploadDirectory) {
      throw new HttpError(404, "Profile photo not found");
    }
    response.setHeader("Content-Type", user.profilePhotoMimeType);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Disposition", "inline");
    createReadStream(safePath)
      .on("error", (error) => {
        console.error("Profile photo read failed", error);
        if (!response.headersSent) {
          response.status(404).json({ error: "Profile photo is unavailable" });
        } else {
          response.destroy(error);
        }
      })
      .pipe(response);
  }),
);

async function validateImageSignature(filePath: string, mimeType: string): Promise<"image/jpeg" | "image/png"> {
  const buffer = await readFile(filePath);
  if (
    mimeType === "image/png" &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (
    mimeType === "image/jpeg" &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  throw new HttpError(400, "The image content does not match JPEG or PNG format");
}
