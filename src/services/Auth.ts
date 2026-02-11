import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

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
  const callable = httpsCallable<InviteUserRequest, InviteUserResponse>(
    functions,
    'inviteUser'
  )
  const result = await callable(data)
  return result.data
}
