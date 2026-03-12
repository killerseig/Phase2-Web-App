import { auth } from '../firebase'
import { useAuthStore } from '@/stores/auth'
import { canAccessJobForSnapshot } from '@/utils/accessControl'

export const requireUser = () => {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

export const assertJobAccess = (jobId: string) => {
  const sanitizedId = Array.isArray(jobId) ? jobId[0] : jobId
  if (!sanitizedId) throw new Error('Missing jobId')
  const authStore = useAuthStore()
  if (
    !canAccessJobForSnapshot(
      {
        user: authStore.user,
        active: authStore.active,
        role: authStore.role,
        assignedJobIds: authStore.assignedJobIds,
      },
      String(sanitizedId)
    )
  ) {
    throw new Error('You do not have access to this job')
  }
}
