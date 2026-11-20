import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { Notification } from "../models/Notification.js";

export const notificationRouter = Router();

notificationRouter.get(
  "/",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const items = await Notification.find({ userId: request.auth?.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unreadCount = items.filter((item) => !item.readAt).length;
    response.json({ items, unreadCount });
  }),
);

notificationRouter.patch(
  "/:id/read",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    if (!mongoose.isValidObjectId(request.params.id)) {
      throw new HttpError(404, "Notification not found");
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: request.params.id, userId: request.auth?.userId },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) {
      throw new HttpError(404, "Notification not found");
    }
    response.json({ notification });
  }),
);

notificationRouter.patch(
  "/read-all",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const result = await Notification.updateMany(
      { userId: request.auth?.userId, readAt: null },
      { $set: { readAt: new Date() } },
    );
    response.json({ modifiedCount: result.modifiedCount });
  }),
);
