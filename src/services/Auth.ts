import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { normalizeError } from './serviceUtils'

const assertInvitePayload = (data: InviteUserRequest) => {
  if (!data.email || !data.email.includes('@')) {
    throw new Error('A valid email is required to invite a user')
  }
}

export interface InviteUserRequest {
  email: string
  displayName?: string
  role?: string
}

export interface InviteUserResponse {
  uid: string
  email: string
  message: string
}

/**
 * Call the inviteUser Cloud Function to provision a new user account.
 */
export async function inviteUser(data: InviteUserRequest): Promise<InviteUserResponse> {
  assertInvitePayload(data)
  const callable = httpsCallable<InviteUserRequest, InviteUserResponse>(functions, 'inviteUser')
  try {
    const result = await callable(data)
    return result.data
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to invite user'))
  }
}
