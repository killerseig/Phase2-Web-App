/**
 * Firestore Service
 * Reusable queries and data fetching functions
 */

import * as admin from 'firebase-admin'
import { COLLECTIONS, DEFAULTS } from './constants'

// Lazy initialize db on first use
let db: admin.firestore.Firestore | null = null

function getDb(): admin.firestore.Firestore {
  if (!db) {
    db = admin.firestore()
  }
  return db
}

export interface JobDetails {
  id: string
  name: string
  number: string
}

export interface EmailSettings {
  timecardSubmitRecipients?: string[]
  shopOrderSubmitRecipients?: string[]
  dailyLogSubmitRecipients?: string[]
}

export interface UserProfile {
  uid: string
  email: string
  firstName: string
  lastName: string
  displayName?: string
  role: string
  active: boolean
}

/**
 * Get job details by ID
 */
export async function getJobDetails(jobId: string): Promise<JobDetails | null> {
  const jobSnap = await getDb().collection(COLLECTIONS.JOBS).doc(jobId).get()
  if (!jobSnap.exists) return null
  
  const data = jobSnap.data()
  return {
    id: jobSnap.id,
    name: data?.name || DEFAULTS.JOB_NAME,
    number: data?.number || '',
  }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userSnap = await getDb().collection(COLLECTIONS.USERS).doc(uid).get()
  if (!userSnap.exists) return null
  
  const data = userSnap.data()
  return {
    uid: userSnap.id,
    email: data?.email || '',
    firstName: data?.firstName || '',
    lastName: data?.lastName || '',
    displayName: data?.displayName,
    role: data?.role || 'none',
    active: data?.active ?? true,
  }
}

/**
 * Get formatted user display name (firstName lastName or displayName)
 */
export async function getUserDisplayName(uid: string, fallback?: string): Promise<string> {
  const user = await getUserProfile(uid)
  if (!user) return fallback || DEFAULTS.USER_NAME
  
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`
  }
  return user.displayName || user.email || fallback || DEFAULTS.USER_NAME
}

/**
 * Verify that a user is an admin
 * Throws error if not an admin
 */
export async function verifyAdminRole(uid: string): Promise<void> {
  const user = await getUserProfile(uid)
  if (!user) {
    throw new Error('Your user profile not found')
  }
  if (user.role !== 'admin') {
    throw new Error('Only admins can perform this action')
  }
}

/**
 * Get daily log by ID
 */
export async function getDailyLog(jobId: string, dailyLogId: string): Promise<any> {
  const logSnap = await getDb()
    .collection('jobs')
    .doc(jobId)
    .collection('dailyLogs')
    .doc(dailyLogId)
    .get()
  if (!logSnap.exists) return null
  return {
    id: logSnap.id,
    ...logSnap.data(),
  }
}

/**
 * Get timecard by path
 */
export async function getTimecard(jobId: string, weekStart: string, timecardId: string): Promise<any> {
  const db = getDb()

  // Phase 3 timecards live directly under jobs/{jobId}/timecards
  const directRef = db
    .collection(COLLECTIONS.JOBS)
    .doc(jobId)
    .collection('timecards')
    .doc(timecardId)
  const directSnap = await directRef.get()
  if (directSnap.exists) {
    return {
      id: directSnap.id,
      ...directSnap.data(),
    }
  }

  // Fallback for legacy Phase 2 structure jobs/{jobId}/weeks/{weekStart}/timecards
  const legacyRef = db
    .collection(COLLECTIONS.JOBS)
    .doc(jobId)
    .collection(COLLECTIONS.WEEKS)
    .doc(weekStart)
    .collection(COLLECTIONS.TIMECARDS)
    .doc(timecardId)
  const legacySnap = await legacyRef.get()
  if (!legacySnap.exists) return null

  return {
    id: legacySnap.id,
    ...legacySnap.data(),
  }
}

/**
 * Get shop order by ID
 */
export async function getShopOrder(shopOrderId: string): Promise<any> {
  const orderSnap = await getDb().collection(COLLECTIONS.SHOP_ORDERS).doc(shopOrderId).get()
  if (!orderSnap.exists) return null
  return {
    id: orderSnap.id,
    ...orderSnap.data(),
  }
}

/**
 * Get global email settings
 */
export async function getEmailSettings(): Promise<EmailSettings> {
  const settingsSnap = await getDb().collection('settings').doc('email').get()
  if (!settingsSnap.exists) return { timecardSubmitRecipients: [], shopOrderSubmitRecipients: [] }
  const data = settingsSnap.data() || {}
  return {
    timecardSubmitRecipients: Array.isArray(data.timecardSubmitRecipients) ? data.timecardSubmitRecipients : [],
    shopOrderSubmitRecipients: Array.isArray(data.shopOrderSubmitRecipients) ? data.shopOrderSubmitRecipients : [],
    dailyLogSubmitRecipients: Array.isArray(data.dailyLogSubmitRecipients) ? data.dailyLogSubmitRecipients : [],
  }
}
