import { describe, expect, it } from "vitest";
import { getReportBucketKeys, getReportWindow } from "./reporting.js";

describe("admin report windows", () => {
  const now = new Date("2026-03-15T12:30:00.000Z");

  it.each([
    ["3d", "2026-03-13T00:00:00.000Z", 3],
    ["7d", "2026-03-09T00:00:00.000Z", 7],
  ] as const)("covers the selected %s calendar days", (range, expectedStart, bucketCount) => {
    const { start, end, unit } = getReportWindow(range, now);
    const buckets = getReportBucketKeys(start, end, unit);

    expect(start.toISOString()).toBe(expectedStart);
    expect(buckets).toHaveLength(bucketCount);
  });

  it("uses 30 UTC calendar days and includes empty daily buckets", () => {
    const { start, end, unit } = getReportWindow("30d", now);
    const buckets = getReportBucketKeys(start, end, unit);

    expect(start.toISOString()).toBe("2026-02-14T00:00:00.000Z");
    expect(buckets).toHaveLength(30);
    expect(buckets[0]).toBe("2026-02-14");
    expect(buckets[buckets.length - 1]).toBe("2026-03-15");
  });

  it("groups the 90-day window into Monday-starting weeks", () => {
    const { start, end, unit } = getReportWindow("90d", now);
    const buckets = getReportBucketKeys(start, end, unit);

    expect(unit).toBe("week");
    expect(buckets[0]).toBe("2025-12-15");
    expect(buckets).toHaveLength(13);
    expect(buckets.every((key) => new Date(`${key}T00:00:00.000Z`).getUTCDay() === 1)).toBe(true);
  });

  it("covers the current and previous eleven calendar months", () => {
    const { start, end, unit } = getReportWindow("12m", now);
    const buckets = getReportBucketKeys(start, end, unit);

    expect(start.toISOString()).toBe("2025-04-01T00:00:00.000Z");
    expect(buckets).toHaveLength(12);
    expect(buckets[11]).toBe("2026-03");
  });
});
