import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useJobConfirmDialogs } from '@/features/jobs/useJobConfirmDialogs'
import type { JobRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: ['foreman-1'],
    code: '100',
    finishDate: '2026-06-30',
    gc: 'Phase 2',
    id: 'job-100',
    jobAddress: '100 Main St',
    name: 'Alpha Job',
    notificationRecipients: {
      dailyLogs: [],
      shopOrders: [],
      timecards: [],
    },
    productionBurden: 0.33,
    startDate: '2026-06-01',
    type: 'general',
    ...overrides,
  }
}

function mountConfirmDialogs(options: {
  archiveBusy?: boolean
  deleteBusy?: boolean
  selectedJob?: JobRecord | null
} = {}) {
  const archiveBusy = ref(options.archiveBusy ?? false)
  const deleteBusy = ref(options.deleteBusy ?? false)
  const selectedJob = ref<JobRecord | null>(
    options.selectedJob === undefined ? makeJob() : options.selectedJob,
  )

  const dialogs = useJobConfirmDialogs({
    archiveBusy,
    deleteBusy,
    selectedJob: computed(() => selectedJob.value),
  })

  return {
    archiveBusy,
    deleteBusy,
    dialogs,
    selectedJob,
  }
}

describe('useJobConfirmDialogs', () => {
  it('does not open archive or delete confirmations without a selected job', () => {
    const { dialogs } = mountConfirmDialogs({ selectedJob: null })

    dialogs.requestToggleArchive()
    dialogs.requestDeleteJob()

    expect(dialogs.archiveConfirmOpen.value).toBe(false)
    expect(dialogs.deleteConfirmOpen.value).toBe(false)
    expect(dialogs.archiveJobConfirmTitle.value).toBe('Update job?')
    expect(dialogs.archiveJobConfirmMessage.value).toBe('')
    expect(dialogs.deleteJobConfirmMessage.value).toBe('')
  })

  it('opens archive confirmation with active-job copy and closes when not busy', () => {
    const { dialogs } = mountConfirmDialogs({
      selectedJob: makeJob({ active: true, name: 'Lucky 3 Ranch' }),
    })

    dialogs.requestToggleArchive()

    expect(dialogs.archiveConfirmOpen.value).toBe(true)
    expect(dialogs.archiveJobConfirmTitle.value).toBe('Archive job?')
    expect(dialogs.archiveJobConfirmLabel.value).toBe('Archive Job')
    expect(dialogs.archiveJobConfirmMessage.value).toBe('Archive Lucky 3 Ranch?')

    dialogs.handleArchiveConfirmOpenUpdate(false)

    expect(dialogs.archiveConfirmOpen.value).toBe(false)
  })

  it('uses restore copy for inactive selected jobs', () => {
    const { dialogs } = mountConfirmDialogs({
      selectedJob: makeJob({ active: false, name: 'Archived Job' }),
    })

    dialogs.requestToggleArchive()

    expect(dialogs.archiveConfirmOpen.value).toBe(true)
    expect(dialogs.archiveJobConfirmTitle.value).toBe('Restore job?')
    expect(dialogs.archiveJobConfirmLabel.value).toBe('Restore Job')
    expect(dialogs.archiveJobConfirmMessage.value).toBe('Restore Archived Job?')
  })

  it('keeps archive confirmation open while archive work is busy', () => {
    const { archiveBusy, dialogs } = mountConfirmDialogs({ archiveBusy: true })

    dialogs.requestToggleArchive()
    dialogs.handleArchiveConfirmOpenUpdate(false)

    expect(dialogs.archiveConfirmOpen.value).toBe(true)

    archiveBusy.value = false
    dialogs.handleArchiveConfirmOpenUpdate(false)

    expect(dialogs.archiveConfirmOpen.value).toBe(false)
  })

  it('opens delete confirmation with selected-job copy and respects delete busy state', () => {
    const { deleteBusy, dialogs } = mountConfirmDialogs({
      deleteBusy: true,
      selectedJob: makeJob({ name: 'Delete Me' }),
    })

    dialogs.requestDeleteJob()

    expect(dialogs.deleteConfirmOpen.value).toBe(true)
    expect(dialogs.deleteJobConfirmMessage.value).toBe(
      'Delete Delete Me? This removes the job record and clears its field-user assignments.',
    )

    dialogs.handleDeleteConfirmOpenUpdate(false)
    expect(dialogs.deleteConfirmOpen.value).toBe(true)

    deleteBusy.value = false
    dialogs.handleDeleteConfirmOpenUpdate(false)

    expect(dialogs.deleteConfirmOpen.value).toBe(false)
  })

  it('manual close helpers close the corresponding dialogs independently', () => {
    const { dialogs } = mountConfirmDialogs()

    dialogs.requestToggleArchive()
    dialogs.requestDeleteJob()

    dialogs.closeArchiveConfirm()

    expect(dialogs.archiveConfirmOpen.value).toBe(false)
    expect(dialogs.deleteConfirmOpen.value).toBe(true)

    dialogs.closeDeleteConfirm()

    expect(dialogs.deleteConfirmOpen.value).toBe(false)
  })
})
