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
  createdAt: Timestamp | unknown // unknown for backwards compat with serverTimestamp
  updatedAt: Timestamp | unknown
}

/**
 * User-Tracked Document - Includes who created/updated
 */
export interface UserTrackedDocument extends AuditMetadata {
  uid: string // Creator/Owner UID
}

// Attachments (used by daily logs and other modules)
export type AttachmentType = 'photo' | 'ptp' | 'qc' | 'other'

export interface Attachment {
  name: string
  url: string
  path: string
  type?: AttachmentType
  createdAt?: Timestamp | unknown
}

// Manpower line item for daily logs
export interface ManpowerLine {
  trade: string
  count: number
  areas: string
  addedByUserId?: string
}

export interface IndoorClimateReading {
  area: string
  high: string
  low: string
  humidity: string
}

/**
 * Submittable Document - Draft/Submitted workflow
 */
export interface SubmittableDocument extends UserTrackedDocument {
  status: SubmittableStatus
  submittedAt?: Timestamp | unknown
}

/**
 * Approvable Document - Draft/Submitted/Approved workflow
 */
export interface ApprovableDocument extends UserTrackedDocument {
  status: DocumentStatus
  submittedAt?: Timestamp | unknown
  approvedAt?: Timestamp | unknown
}

/**
 * Helper to normalize a Firestore doc with defaults
 */
export function normalizeDoc<T extends Record<string, unknown>>(
  id: string,
  data: unknown,
  defaults: Partial<T> = {}
): T & { id: string } {
  const safeData = (data && typeof data === 'object' ? data : {}) as Partial<T>
  return {
    id,
    ...defaults,
    ...safeData,
  } as T & { id: string }
}

