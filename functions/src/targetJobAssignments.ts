export function targetFunctionUserIsAssignedToJob(
  jobId: string,
  assignedJobIds?: readonly string[] | null,
): boolean {
  return Boolean(jobId) && (assignedJobIds ?? []).includes(jobId)
}
