export function targetUserIsAssignedToJob(
  jobId: string,
  assignedJobIds?: readonly string[] | null,
): boolean {
  return Boolean(jobId) && (assignedJobIds ?? []).includes(jobId)
}
