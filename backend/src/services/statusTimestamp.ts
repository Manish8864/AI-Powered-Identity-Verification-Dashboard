export function updateStatusWithTimestamp(
  application: { status: string; statusChangedAt?: Date | null },
  nextStatus: string,
  changedAt = new Date(),
) {
  if (application.status === nextStatus) return false;
  application.status = nextStatus;
  application.statusChangedAt = changedAt;
  return true;
}
