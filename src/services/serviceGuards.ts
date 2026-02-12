import { auth } from '../firebase'
import { useJobAccess } from '@/composables/useJobAccess'

export const requireUser = () => {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

export const assertJobAccess = (jobId: string) => {
  const sanitizedId = Array.isArray(jobId) ? jobId[0] : jobId
  if (!sanitizedId) throw new Error('Missing jobId')
  const jobAccess = useJobAccess()
  if (!jobAccess.canAccessJob(String(sanitizedId))) {
    throw new Error('You do not have access to this job')
  }
}
