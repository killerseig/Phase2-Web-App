import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  createEmptyDailyLogPayload,
} from '@/features/dailyLogs/schema'
import { useDailyLogFormHydration } from '@/features/dailyLogs/useDailyLogFormHydration'
import type { DailyLogSiteInfoDisplay } from '@/features/dailyLogs/viewHelpers'
import type {
  DailyLogPayload,
  DailyLogRecord,
  JobRecord,
} from '@/types/domain'

function makePayload(overrides: Partial<DailyLogPayload> = {}): DailyLogPayload {
  return createEmptyDailyLogPayload({
    jobSiteNumbers: '5229',
    foremanOnSite: 'Vince Hintz',
    projectName: 'Lucky 3 Ranch',
    siteForemanAssistant: 'Chris Renn',
    weeklySchedule: 'Original schedule',
    ...overrides,
  })
}

function makeLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  const payload = overrides.payload ?? makePayload()

  return {
    id: 'daily-log-1',
    additionalRecipients: [],
    foremanName: 'Vince Hintz',
    foremanUserId: 'user-1',
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-07-15',
    payload,
    sequenceNumber: 1,
    status: 'draft',
    ...overrides,
  }
}

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    active: true,
    assignedForemanIds: [],
    code: '5229',
    gc: 'Phase 2',
    jobAddress: '100 Main St',
    name: 'Lucky 3 Ranch',
    projectManager: 'Chris Renn',
    type: 'general',
    ...overrides,
  }
}

function makeSiteInfo(overrides: Partial<DailyLogSiteInfoDisplay> = {}): DailyLogSiteInfoDisplay {
  return {
    address: '100 Main St',
    foreman: 'Vince Hintz',
    generalContractor: 'Phase 2',
    jobNumber: '5229',
    projectManager: 'Chris Renn',
    projectName: 'Lucky 3 Ranch',
    ...overrides,
  }
}

function serializePayload(payload: DailyLogPayload) {
  return JSON.stringify(payload)
}

function mountHydration(options: {
  authDisplayName?: string | null
  canEdit?: boolean
  form?: DailyLogPayload
  job?: JobRecord | null
  selectedLog?: DailyLogRecord | null
  siteInfo?: DailyLogSiteInfoDisplay
} = {}) {
  const authDisplayName = ref(options.authDisplayName ?? 'Vince Hintz')
  const canEdit = ref(options.canEdit ?? true)
  const form = ref(options.form ?? createEmptyDailyLogPayload())
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const selectedLog = ref<DailyLogRecord | null>(
    options.selectedLog === undefined ? makeLog() : options.selectedLog,
  )
  const siteInfo = ref(options.siteInfo ?? makeSiteInfo())
  const lastSavedSignature = ref('')
  const clearRecipientInput = vi.fn()
  const hydrateForm = vi.fn((callback: () => void) => {
    callback()
  })
  const setSavedPayloadSnapshot = vi.fn((payload: DailyLogPayload) => {
    lastSavedSignature.value = serializePayload(payload)
  })

  const hydration = useDailyLogFormHydration({
    canEditSelectedLog: computed(() => canEdit.value),
    clearRecipientInput,
    form,
    getAuthDisplayName: () => authDisplayName.value,
    hydrateForm,
    job: computed(() => job.value),
    lastSavedSignature: computed(() => lastSavedSignature.value),
    selectedLog: computed(() => selectedLog.value),
    serializePayload,
    setSavedPayloadSnapshot,
    siteInfo: computed(() => siteInfo.value),
  })

  return {
    authDisplayName,
    canEdit,
    clearRecipientInput,
    form,
    hydrateForm,
    hydration,
    job,
    lastSavedSignature,
    selectedLog,
    setSavedPayloadSnapshot,
    siteInfo,
  }
}

describe('useDailyLogFormHydration', () => {
  it('hydrates the selected log on mount and snapshots the saved payload', () => {
    const selectedLog = makeLog({
      payload: makePayload({
        weeklySchedule: 'Install ceiling grid',
      }),
    })
    const {
      clearRecipientInput,
      form,
      hydrateForm,
      lastSavedSignature,
      setSavedPayloadSnapshot,
    } = mountHydration({ selectedLog })

    expect(form.value.weeklySchedule).toBe('Install ceiling grid')
    expect(form.value).not.toBe(selectedLog.payload)
    expect(clearRecipientInput).toHaveBeenCalledTimes(1)
    expect(hydrateForm).toHaveBeenCalledTimes(1)
    expect(setSavedPayloadSnapshot).toHaveBeenCalledWith(form.value)
    expect(lastSavedSignature.value).toBe(serializePayload(form.value))
  })

  it('resets to an empty form and clears recipients when no log is selected', () => {
    const { clearRecipientInput, form } = mountHydration({
      form: makePayload({ weeklySchedule: 'Stale local text' }),
      selectedLog: null,
    })

    expect(clearRecipientInput).toHaveBeenCalledTimes(1)
    expect(form.value.weeklySchedule).toBe('')
    expect(form.value.projectName).toBe('')
  })

  it('clears recipient input and hydrates when the selected log changes', async () => {
    const {
      clearRecipientInput,
      form,
      hydrateForm,
      selectedLog,
      setSavedPayloadSnapshot,
    } = mountHydration()
    clearRecipientInput.mockClear()
    hydrateForm.mockClear()
    setSavedPayloadSnapshot.mockClear()

    selectedLog.value = makeLog({
      id: 'daily-log-2',
      payload: makePayload({
        weeklySchedule: 'Second daily log schedule',
      }),
      sequenceNumber: 2,
    })
    await nextTick()

    expect(clearRecipientInput).toHaveBeenCalledTimes(1)
    expect(hydrateForm).toHaveBeenCalledTimes(1)
    expect(form.value.weeklySchedule).toBe('Second daily log schedule')
    expect(setSavedPayloadSnapshot).toHaveBeenCalledWith(form.value)
  })

  it('hydrates clean same-log remote updates when the incoming payload changed', async () => {
    const {
      form,
      hydrateForm,
      selectedLog,
      setSavedPayloadSnapshot,
    } = mountHydration()
    hydrateForm.mockClear()
    setSavedPayloadSnapshot.mockClear()

    selectedLog.value = makeLog({
      id: 'daily-log-1',
      payload: makePayload({
        weeklySchedule: 'Remote saved update',
      }),
    })
    await nextTick()

    expect(hydrateForm).toHaveBeenCalledTimes(1)
    expect(form.value.weeklySchedule).toBe('Remote saved update')
    expect(setSavedPayloadSnapshot).toHaveBeenCalledWith(form.value)
  })

  it('does not replace unsaved local edits with same-log remote updates', async () => {
    const {
      form,
      hydrateForm,
      selectedLog,
      setSavedPayloadSnapshot,
    } = mountHydration()
    hydrateForm.mockClear()
    setSavedPayloadSnapshot.mockClear()

    form.value.weeklySchedule = 'User is still typing local words'
    selectedLog.value = makeLog({
      id: 'daily-log-1',
      payload: makePayload({
        weeklySchedule: 'Remote update should wait',
      }),
    })
    await nextTick()

    expect(form.value.weeklySchedule).toBe('User is still typing local words')
    expect(hydrateForm).not.toHaveBeenCalled()
    expect(setSavedPayloadSnapshot).not.toHaveBeenCalled()
  })

  it('does not reset when a same-log remote echo matches the saved snapshot', async () => {
    const {
      form,
      hydrateForm,
      selectedLog,
      setSavedPayloadSnapshot,
    } = mountHydration()
    const savedSchedule = form.value.weeklySchedule
    hydrateForm.mockClear()
    setSavedPayloadSnapshot.mockClear()

    selectedLog.value = makeLog({
      id: 'daily-log-1',
      payload: makePayload({
        weeklySchedule: savedSchedule,
      }),
    })
    await nextTick()

    expect(hydrateForm).not.toHaveBeenCalled()
    expect(setSavedPayloadSnapshot).not.toHaveBeenCalled()
  })

  it('applies latest job and user snapshot fields only while the selected log is editable', async () => {
    const {
      authDisplayName,
      canEdit,
      form,
      job,
      siteInfo,
    } = mountHydration({
      siteInfo: makeSiteInfo({
        foreman: 'Original Foreman',
        jobNumber: '5229',
        projectManager: 'Original PM',
        projectName: 'Original Project',
      }),
    })

    siteInfo.value = makeSiteInfo({
      foreman: 'Updated Foreman',
      jobNumber: '9000',
      projectManager: 'Updated PM',
      projectName: 'Updated Project',
    })
    authDisplayName.value = 'Updated Foreman'
    await nextTick()

    expect(form.value.foremanOnSite).toBe('Updated Foreman')
    expect(form.value.jobSiteNumbers).toBe('9000')
    expect(form.value.projectName).toBe('Updated Project')
    expect(form.value.siteForemanAssistant).toBe('Updated PM')

    canEdit.value = false
    siteInfo.value = makeSiteInfo({
      foreman: 'Read Only Foreman',
      jobNumber: '1111',
      projectManager: 'Read Only PM',
      projectName: 'Read Only Project',
    })
    job.value = makeJob({
      code: '1111',
      name: 'Read Only Project',
      projectManager: 'Read Only PM',
    })
    await nextTick()

    expect(form.value.foremanOnSite).toBe('Updated Foreman')
    expect(form.value.jobSiteNumbers).toBe('9000')
    expect(form.value.projectName).toBe('Updated Project')
    expect(form.value.siteForemanAssistant).toBe('Updated PM')
  })
})
