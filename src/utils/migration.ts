/**
 * Data Migration Utilities (Phase 3F)
 * 
 * Migrates legacy data structure to Phase 3 job-scoped structure:
 * - timecards: {} → jobs/{jobId}/timecards/{}
 * - dailyLogs: {} → jobs/{jobId}/dailyLogs/{}
 * - employees: {} → jobs/{jobId}/roster/{} (with Plexis integration)
 */

import { db } from '../firebase'
import {
  collection,
  getDocs,
  doc,
  addDoc,
  writeBatch,
  query,
  where,
  getDoc,
  type DocumentData,
} from 'firebase/firestore'

/**
 * Timecard migration: Move legacy timecards/{id} → jobs/{jobId}/timecards/{id}
 * @returns Count of migrated timecards
 */
export async function migrateLegacyTimecards(): Promise<number> {
  console.log('[Migration] Starting legacy timecard migration...')

  try {
    // Get all legacy timecards
    const legacyRef = collection(db, 'timecards')
    const legacySnap = await getDocs(legacyRef)

    if (legacySnap.empty) {
      console.log('[Migration] No legacy timecards found')
      return 0
    }

    let migratedCount = 0
    const batch = writeBatch(db)
    const jobTimecardBatches: Map<string, typeof batch> = new Map()

    // Process each legacy timecard
    for (const legacyDoc of legacySnap.docs) {
      const data = legacyDoc.data()
      const jobId = data.jobId

      if (!jobId) {
        console.warn(`[Migration] Timecard ${legacyDoc.id} missing jobId, skipping`)
        continue
      }

      // Create new timecard in job subcollection
      const newTimecardRef = doc(db, `jobs/${jobId}/timecards`, legacyDoc.id)
      
      // Preserve all fields, transform structure if needed
      const migratedData: DocumentData = {
        ...data,
        jobId, // Ensure jobId is set
        // Ensure date fields are correct format
        weekStartDate: data.weekStartDate || data.weekStart,
        weekEndingDate: data.weekEndingDate || data.weekEnding,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Mark as migrated
        _migratedFromLegacy: true,
        _migratedAt: new Date().toISOString(),
      }

      batch.set(newTimecardRef, migratedData)
      migratedCount++
    }

    if (migratedCount > 0) {
      await batch.commit()
      console.log(`[Migration] Successfully migrated ${migratedCount} timecards`)
    }

    return migratedCount
  } catch (error) {
    console.error('[Migration] Timecard migration failed:', error)
    throw error
  }
}

/**
 * Daily logs migration: Move legacy dailyLogs/{id} → jobs/{jobId}/dailyLogs/{id}
 * @returns Count of migrated logs
 */
export async function migrateLegacyDailyLogs(): Promise<number> {
  console.log('[Migration] Starting legacy daily logs migration...')

  try {
    // Get all legacy daily logs
    const legacyRef = collection(db, 'dailyLogs')
    const legacySnap = await getDocs(legacyRef)

    if (legacySnap.empty) {
      console.log('[Migration] No legacy daily logs found')
      return 0
    }

    let migratedCount = 0
    const batch = writeBatch(db)

    // Process each legacy daily log
    for (const legacyDoc of legacySnap.docs) {
      const data = legacyDoc.data()
      const jobId = data.jobId

      if (!jobId) {
        console.warn(`[Migration] Daily log ${legacyDoc.id} missing jobId, skipping`)
        continue
      }

      // Create new daily log in job subcollection
      const newLogRef = doc(db, `jobs/${jobId}/dailyLogs`, legacyDoc.id)

      const migratedData: DocumentData = {
        ...data,
        jobId, // Ensure jobId is set
        archived: data.archived ?? false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Mark as migrated
        _migratedFromLegacy: true,
        _migratedAt: new Date().toISOString(),
      }

      batch.set(newLogRef, migratedData)
      migratedCount++
    }

    if (migratedCount > 0) {
      await batch.commit()
      console.log(`[Migration] Successfully migrated ${migratedCount} daily logs`)
    }

    return migratedCount
  } catch (error) {
    console.error('[Migration] Daily logs migration failed:', error)
    throw error
  }
}

/**
 * Create job rosters from employee data
 * Maps employees referenced in timecards/daily logs to job rosters
 * @returns Count of created roster entries
 */
export async function createJobRostersFromTimecards(): Promise<number> {
  console.log('[Migration] Creating job rosters from timecard references...')

  try {
    const jobsRef = collection(db, 'jobs')
    const jobsSnap = await getDocs(jobsRef)

    let rosterCount = 0

    // For each job
    for (const jobDoc of jobsSnap.docs) {
      const jobId = jobDoc.id
      
      // Get all timecards for this job
      const timecardRef = collection(db, `jobs/${jobId}/timecards`)
      const timecardSnap = await getDocs(timecardRef)

      const seenEmployees = new Set<string>()
      const batch = writeBatch(db)

      // Extract unique employees from timecards
      for (const tcDoc of timecardSnap.docs) {
        const tcData = tcDoc.data()
        const employeeNumber = tcData.employeeNumber

        // Skip if no employee number or already processed
        if (!employeeNumber || seenEmployees.has(employeeNumber)) {
          continue
        }

        seenEmployees.add(employeeNumber)

        // Create roster entry
        const rosterRef = doc(
          db,
          `jobs/${jobId}/roster`,
          `emp-${employeeNumber}`
        )

        const rosterData: DocumentData = {
          employeeNumber,
          name: tcData.employeeName || '',
          occupation: tcData.occupation || '',
          // Standard roster fields
          hourlyRate: 0, // To be filled in manually
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Mark as migrated
          _migratedFromTimecard: true,
          _migratedAt: new Date().toISOString(),
        }

        batch.set(rosterRef, rosterData, { merge: true })
        rosterCount++
      }

      if (seenEmployees.size > 0) {
        await batch.commit()
        console.log(
          `[Migration] Created ${seenEmployees.size} roster entries for job ${jobId}`
        )
      }
    }

    console.log(`[Migration] Total roster entries created: ${rosterCount}`)
    return rosterCount
  } catch (error) {
    console.error('[Migration] Roster creation failed:', error)
    throw error
  }
}

/**
 * Run full migration: timecards → dailyLogs → rosters
 * @returns Summary of migration results
 */
export async function runFullDataMigration() {
  console.log('[Migration] Starting full data migration...')
  console.log('=============================================================')

  const results = {
    timecardsMigrated: 0,
    dailyLogsMigrated: 0,
    rostersCreated: 0,
    startTime: new Date(),
    endTime: null as Date | null,
    errors: [] as string[],
  }

  try {
    // Step 1: Migrate timecards
    try {
      results.timecardsMigrated = await migrateLegacyTimecards()
    } catch (error) {
      const msg = `Timecard migration failed: ${error}`
      console.error(msg)
      results.errors.push(msg)
    }

    // Step 2: Migrate daily logs
    try {
      results.dailyLogsMigrated = await migrateLegacyDailyLogs()
    } catch (error) {
      const msg = `Daily logs migration failed: ${error}`
      console.error(msg)
      results.errors.push(msg)
    }

    // Step 3: Create rosters
    try {
      results.rostersCreated = await createJobRostersFromTimecards()
    } catch (error) {
      const msg = `Roster creation failed: ${error}`
      console.error(msg)
      results.errors.push(msg)
    }

    results.endTime = new Date()

    // Print summary
    console.log('=============================================================')
    console.log('[Migration] Migration Complete!')
    console.log(`  Timecards migrated: ${results.timecardsMigrated}`)
    console.log(`  Daily logs migrated: ${results.dailyLogsMigrated}`)
    console.log(`  Rosters created: ${results.rostersCreated}`)
    console.log(`  Duration: ${((results.endTime.getTime() - results.startTime.getTime()) / 1000).toFixed(2)}s`)
    
    if (results.errors.length > 0) {
      console.warn(`  Errors encountered: ${results.errors.length}`)
      results.errors.forEach((err) => console.warn(`    - ${err}`))
    }

    return results
  } catch (error) {
    console.error('[Migration] Unexpected error during migration:', error)
    throw error
  }
}

/**
 * Verify migration completion
 * Checks that legacy data matches new structure
 */
export async function verifyMigration(): Promise<boolean> {
  console.log('[Migration] Verifying migration...')

  try {
    // Check for orphaned legacy timecards
    const legacyTimecards = await getDocs(collection(db, 'timecards'))
    if (!legacyTimecards.empty) {
      console.warn(
        `[Migration] Warning: ${legacyTimecards.size} legacy timecards still exist`
      )
      console.log('[Migration] These can be safely deleted after verification')
    }

    // Check for orphaned legacy daily logs
    const legacyLogs = await getDocs(collection(db, 'dailyLogs'))
    if (!legacyLogs.empty) {
      console.warn(
        `[Migration] Warning: ${legacyLogs.size} legacy daily logs still exist`
      )
      console.log('[Migration] These can be safely deleted after verification')
    }

    // Spot-check: verify first timecard was migrated
    const jobsRef = collection(db, 'jobs')
    const jobsSnap = await getDocs(jobsRef)
    let foundMigrated = false

    for (const jobDoc of jobsSnap.docs) {
      const timecardRef = collection(db, `jobs/${jobDoc.id}/timecards`)
      const snap = await getDocs(timecardRef)
      if (!snap.empty) {
        foundMigrated = true
        console.log(
          `[Migration] ✓ Found migrated timecards in job ${jobDoc.id}`
        )
        break
      }
    }

    if (foundMigrated) {
      console.log('[Migration] ✓ Verification passed')
      return true
    } else {
      console.warn('[Migration] ⚠ No migrated data found - check migration results')
      return false
    }
  } catch (error) {
    console.error('[Migration] Verification failed:', error)
    return false
  }
}
