import { describe, expect, it } from "vitest";
import { updateStatusWithTimestamp } from "./statusTimestamp.js";

describe("updateStatusWithTimestamp", () => {
  it("records the date when an application's status changes", () => {
    const changedAt = new Date("2026-11-18T10:00:00.000Z");
    const application = { status: "Submitted", statusChangedAt: new Date("2026-11-17T10:00:00.000Z") };

    expect(updateStatusWithTimestamp(application, "Approved", changedAt)).toBe(true);
    expect(application.status).toBe("Approved");
    expect(application.statusChangedAt).toBe(changedAt);
  });

  it("does not change the date when the status stays the same", () => {
    const changedAt = new Date("2026-11-17T10:00:00.000Z");
    const application = { status: "Approved", statusChangedAt: changedAt };

    expect(updateStatusWithTimestamp(application, "Approved", new Date("2026-11-18T10:00:00.000Z"))).toBe(false);
    expect(application.statusChangedAt).toBe(changedAt);
  });
});
