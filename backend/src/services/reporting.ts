export type AdminReportRange = "3d" | "7d" | "30d" | "90d" | "12m";
export type ReportBucketUnit = "day" | "week" | "month";

export function getReportWindow(range: AdminReportRange, now = new Date()) {
  const end = new Date(now);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let unit: ReportBucketUnit;

  if (range === "12m") {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
    unit = "month";
  } else {
    const days = range === "3d" ? 3 : range === "7d" ? 7 : range === "90d" ? 90 : 30;
    start.setUTCDate(start.getUTCDate() - days + 1);
    unit = range === "90d" ? "week" : "day";
  }

  return { start, end, unit };
}

export function getReportBucketKeys(
  start: Date,
  end: Date,
  unit: ReportBucketUnit,
): string[] {
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  if (unit === "month") {
    cursor.setUTCDate(1);
  } else if (unit === "week") {
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  }

  const keys: string[] = [];
  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    if (unit === "month") {
      keys.push(`${year}-${month}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else {
      keys.push(`${year}-${month}-${String(cursor.getUTCDate()).padStart(2, "0")}`);
      cursor.setUTCDate(cursor.getUTCDate() + (unit === "week" ? 7 : 1));
    }
  }
  return keys;
}
