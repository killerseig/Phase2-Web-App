import { ROLES, type Role } from '@/constants/app'

export type JobAccessSnapshot = {
  user: unknown
  active: boolean
  role: Role | null
  assignedJobIds?: string[] | null
}

export const canAccessJobForSnapshot = (
  snapshot: JobAccessSnapshot,
  jobId: string
): boolean => {
  if (!jobId) return false
  if (!snapshot.user || snapshot.active === false || !snapshot.role || snapshot.role === ROLES.NONE) {
    return false
  }
  if (snapshot.role === ROLES.FOREMAN) {
    return (snapshot.assignedJobIds ?? []).includes(jobId)
  }
  return true
}
