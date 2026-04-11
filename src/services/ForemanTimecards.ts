import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import type { JobRosterEmployee } from '@/types/models'
import type { TimecardModel } from '@/utils/timecardUtils'
import { normalizeError } from './serviceUtils'

type ForemanWorkspaceResult = {
  rosterEmployees: JobRosterEmployee[]
  timecards: TimecardModel[]
}

type SaveForemanTimecardInput = {
  jobId: string
  timecardId: string
  jobs: TimecardModel['jobs']
  notes: string
  footerJobOrGl: string
  footerAccount: string
  footerOffice: string
  footerAmount: string
}

type SaveForemanTimecardResult = {
  success: boolean
  timecard: TimecardModel
}

type SubmitForemanTimecardsResult = {
  success: boolean
  count: number
  submittedIds: string[]
}

export async function getForemanTimecardWorkspace(
  jobId: string,
  weekEndingDate: string,
): Promise<ForemanWorkspaceResult> {
  const callable = httpsCallable<{ jobId: string; weekEndingDate: string }, ForemanWorkspaceResult>(
    functions,
    'getForemanTimecardWorkspace',
  )

  try {
    const result = await callable({ jobId, weekEndingDate })
    return {
      rosterEmployees: Array.isArray(result.data?.rosterEmployees) ? result.data.rosterEmployees : [],
      timecards: Array.isArray(result.data?.timecards) ? result.data.timecards : [],
    }
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to load timecard workspace'))
  }
}

export async function saveForemanTimecard(input: SaveForemanTimecardInput): Promise<TimecardModel> {
  const callable = httpsCallable<SaveForemanTimecardInput, SaveForemanTimecardResult>(
    functions,
    'saveForemanTimecard',
  )

  try {
    const result = await callable(input)
    return result.data.timecard
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to save timecard'))
  }
}

export async function submitForemanTimecardsForWeek(
  jobId: string,
  weekEndingDate: string,
): Promise<{ count: number; submittedIds: string[] }> {
  const callable = httpsCallable<
    { jobId: string; weekEndingDate: string },
    SubmitForemanTimecardsResult
  >(functions, 'submitForemanTimecardsForWeek')

  try {
    const result = await callable({ jobId, weekEndingDate })
    return {
      count: Number(result.data?.count ?? 0),
      submittedIds: Array.isArray(result.data?.submittedIds) ? result.data.submittedIds : [],
    }
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to submit timecards'))
  }
}
