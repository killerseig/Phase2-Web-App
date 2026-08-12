import * as admin from 'firebase-admin'

import {
  buildSubmittedEmailClaimUpdate,
  isSubmittedEmailOperationAlreadySent,
  isSubmittedEmailOperationInProgress,
} from './emailStatus'

export type SubmittedEmailOperationClaimStatus = 'claimed' | 'already-sent' | 'in-progress' | 'missing-record'

export const SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE = 'Email already sent successfully'
export const SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE = 'Email send already in progress. Please wait for the current send to finish.'

export function getSubmittedEmailClaimShortCircuitMessage(
  claimStatus: SubmittedEmailOperationClaimStatus,
): string | null {
  if (claimStatus === 'already-sent') return SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE
  if (claimStatus === 'in-progress') return SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE
  return null
}

export async function claimSubmittedEmailOperation(
  db: admin.firestore.Firestore,
  refs: admin.firestore.DocumentReference[],
  operationId: string,
  context: Record<string, unknown>,
): Promise<SubmittedEmailOperationClaimStatus> {
  try {
    return await db.runTransaction(async (transaction) => {
      const snapshots: admin.firestore.DocumentSnapshot[] = []

      for (const ref of refs) {
        snapshots.push(await transaction.get(ref))
      }

      const existingSnapshots = snapshots.filter((snapshot) => snapshot.exists)

      if (existingSnapshots.some((snapshot) => isSubmittedEmailOperationAlreadySent(snapshot.data(), operationId))) {
        return 'already-sent'
      }

      if (existingSnapshots.some((snapshot) => isSubmittedEmailOperationInProgress(snapshot.data(), operationId))) {
        return 'in-progress'
      }

      if (!existingSnapshots.length) {
        console.warn('[claimSubmittedEmailOperation] No matching documents found', context)
        return 'missing-record'
      }

      const payload = buildSubmittedEmailClaimUpdate(operationId, admin.firestore.FieldValue)
      for (const snapshot of existingSnapshots) {
        transaction.update(snapshot.ref, payload)
      }

      return 'claimed'
    })
  } catch (error) {
    console.warn('[claimSubmittedEmailOperation] Failed to claim submitted email operation', {
      ...context,
      operationId,
      error,
    })
    throw error
  }
}
