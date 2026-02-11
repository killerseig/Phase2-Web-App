/**
 * Centralized Document Types
 * Shared interfaces for all Firestore documents
 */

import type { Timestamp } from 'firebase/firestore'

/**
 * Document Status - Shared across all workflow documents
 */
export type DocumentStatus = 'draft' | 'submitted' | 'approved'

/**
 * Submittable Document Status - For documents without approval workflow
 */
export type SubmittableStatus = 'draft' | 'submitted'

/**
 * Audit Metadata - Track who created/updated documents
 */
export interface AuditMetadata {
  createdAt: Timestamp | any // any for backwards compat with serverTimestamp
  updatedAt: Timestamp | any
}

/**
 * User-Tracked Document - Includes who created/updated
 */
export interface UserTrackedDocument extends AuditMetadata {
  uid: string // Creator/Owner UID
}

// Attachments (used by daily logs and other modules)
export interface Attachment {
  name: string
  url: string
  path: string
  type?: 'photo' | 'ptp' | 'other'
  createdAt?: Timestamp | any
}

// Manpower line item for daily logs
export interface ManpowerLine {
  trade: string
  count: number
  areas: string
  addedByUserId?: string
}

/**
 * Submittable Document - Draft/Submitted workflow
 */
export interface SubmittableDocument extends UserTrackedDocument {
  status: SubmittableStatus
  submittedAt?: Timestamp | any
}

/**
 * Approvable Document - Draft/Submitted/Approved workflow
 */
export interface ApprovableDocument extends UserTrackedDocument {
  status: DocumentStatus
  submittedAt?: Timestamp | any
  approvedAt?: Timestamp | any
}

/**
 * Helper to normalize a Firestore doc with defaults
 */
export function normalizeDoc<T extends Record<string, any>>(
  id: string,
  data: any,
  defaults: Partial<T> = {}
): T & { id: string } {
  return {
    id,
    ...defaults,
    ...data,
  } as T & { id: string }
}
