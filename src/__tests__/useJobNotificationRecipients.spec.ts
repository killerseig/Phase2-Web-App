import { computed, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobNotificationRecipients } from '@/features/jobs/useJobNotificationRecipients'
import { createEmptyNotificationRecipients, createRecipientInputState } from '@/features/jobs/jobViewHelpers'
import {
  updateGlobalNotificationRecipients,
  updateJobNotificationRecipients,
} from '@/services/jobs'
import type { JobRecord, NotificationModuleKey, NotificationRecipients } from '@/types/domain'

vi.mock('@/services/jobs', () => ({
  updateGlobalNotificationRecipients: vi.fn(),
  updateJobNotificationRecipients: vi.fn(),
}))

const updateGlobalNotificationRecipientsMock = vi.mocked(updateGlobalNotificationRecipients)
const updateJobNotificationRecipientsMock = vi.mocked(updateJobNotificationRecipients)

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
    notificationRecipients: createEmptyNotificationRecipients(),
    productionBurden: 0.33,
    startDate: '2026-06-01',
    type: 'general',
    ...overrides,
  }
}

function mountNotificationRecipients(options: {
  selectedJob?: JobRecord | null
} = {}) {
  const createError = ref('')
  const createInfo = ref('')
  const detailError = ref('')
  const detailInfo = ref('')
  const createNotificationRecipients = reactive<NotificationRecipients>(createEmptyNotificationRecipients())
  const detailNotificationRecipients = reactive<NotificationRecipients>(createEmptyNotificationRecipients())
  const globalNotificationRecipients = ref<NotificationRecipients>(createEmptyNotificationRecipients())
  const createRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())
  const detailRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())
  const globalRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())
  const selectedJob = ref<JobRecord | null>(options.selectedJob ?? makeJob())

  const recipients = useJobNotificationRecipients({
    createError,
    createInfo,
    createNotificationRecipients,
    createRecipientInputs,
    detailError,
    detailInfo,
    detailNotificationRecipients,
    detailRecipientInputs,
    globalNotificationRecipients,
    globalRecipientInputs,
    selectedJob: computed(() => selectedJob.value),
  })

  return {
    createError,
    createInfo,
    createNotificationRecipients,
    createRecipientInputs,
    detailError,
    detailInfo,
    detailNotificationRecipients,
    detailRecipientInputs,
    globalNotificationRecipients,
    globalRecipientInputs,
    recipients,
    selectedJob,
  }
}

describe('useJobNotificationRecipients', () => {
  beforeEach(() => {
    updateGlobalNotificationRecipientsMock.mockReset()
    updateJobNotificationRecipientsMock.mockReset()
    updateGlobalNotificationRecipientsMock.mockResolvedValue(undefined)
    updateJobNotificationRecipientsMock.mockResolvedValue(undefined)
  })

  it('validates empty, invalid, and duplicate create recipients without persisting', async () => {
    const {
      createError,
      createInfo,
      createNotificationRecipients,
      createRecipientInputs,
      recipients,
    } = mountNotificationRecipients()

    await recipients.addRecipientToTarget('create', 'dailyLogs')
    expect(createError.value).toBe('Enter a Daily Logs email first.')

    createRecipientInputs.dailyLogs = 'not-an-email'
    await recipients.addRecipientToTarget('create', 'dailyLogs')
    expect(createError.value).toBe('Enter a valid email address.')

    createNotificationRecipients.dailyLogs.push('daily@example.com')
    createRecipientInputs.dailyLogs = 'DAILY@example.com'
    await recipients.addRecipientToTarget('create', 'dailyLogs')

    expect(createInfo.value).toBe('That recipient is already on the list.')
    expect(createRecipientInputs.dailyLogs).toBe('')
    expect(createNotificationRecipients.dailyLogs).toEqual(['daily@example.com'])
    expect(updateJobNotificationRecipientsMock).not.toHaveBeenCalled()
    expect(updateGlobalNotificationRecipientsMock).not.toHaveBeenCalled()
  })

  it('adds and removes create recipients locally', async () => {
    const {
      createInfo,
      createNotificationRecipients,
      createRecipientInputs,
      recipients,
    } = mountNotificationRecipients()
    createRecipientInputs.shopOrders = ' SHOP@Example.COM '

    await recipients.addRecipientToTarget('create', 'shopOrders')

    expect(createNotificationRecipients.shopOrders).toEqual(['shop@example.com'])
    expect(createRecipientInputs.shopOrders).toBe('')
    expect(createInfo.value).toBe('Recipient added.')

    await recipients.removeRecipientFromTarget('create', 'shopOrders', 'shop@example.com')

    expect(createNotificationRecipients.shopOrders).toEqual([])
    expect(createInfo.value).toBe('Recipient removed.')
    expect(recipients.recipientSaving.value).toBe(false)
    expect(updateJobNotificationRecipientsMock).not.toHaveBeenCalled()
  })

  it('persists selected-job recipients and updates local detail state after the service succeeds', async () => {
    const {
      detailInfo,
      detailNotificationRecipients,
      detailRecipientInputs,
      recipients,
    } = mountNotificationRecipients({ selectedJob: makeJob({ id: 'job-alpha' }) })
    detailNotificationRecipients.timecards.push('existing@example.com')
    detailRecipientInputs.timecards = ' NEW@Example.com '

    await recipients.addRecipientToTarget('job', 'timecards')

    expect(updateJobNotificationRecipientsMock).toHaveBeenCalledWith(
      'job-alpha',
      'timecards',
      ['existing@example.com', 'new@example.com'],
    )
    expect(detailNotificationRecipients.timecards).toEqual(['existing@example.com', 'new@example.com'])
    expect(detailRecipientInputs.timecards).toBe('')
    expect(detailInfo.value).toBe('Recipient added.')
    expect(recipients.recipientSaving.value).toBe(false)

    await recipients.removeRecipientFromTarget('job', 'timecards', 'existing@example.com')

    expect(updateJobNotificationRecipientsMock).toHaveBeenLastCalledWith(
      'job-alpha',
      'timecards',
      ['new@example.com'],
    )
    expect(detailNotificationRecipients.timecards).toEqual(['new@example.com'])
    expect(detailInfo.value).toBe('Recipient removed.')
  })

  it('persists all-jobs recipient defaults and replaces only the edited module list', async () => {
    const {
      detailInfo,
      globalNotificationRecipients,
      globalRecipientInputs,
      recipients,
    } = mountNotificationRecipients()
    globalNotificationRecipients.value = {
      dailyLogs: ['daily@example.com'],
      timecards: ['time@example.com'],
      shopOrders: ['shop@example.com'],
    }
    globalRecipientInputs.dailyLogs = ' default@EXAMPLE.com '

    await recipients.addRecipientToTarget('all', 'dailyLogs')

    expect(updateGlobalNotificationRecipientsMock).toHaveBeenCalledWith(
      'dailyLogs',
      ['daily@example.com', 'default@example.com'],
    )
    expect(globalNotificationRecipients.value).toEqual({
      dailyLogs: ['daily@example.com', 'default@example.com'],
      timecards: ['time@example.com'],
      shopOrders: ['shop@example.com'],
    })
    expect(globalRecipientInputs.dailyLogs).toBe('')
    expect(detailInfo.value).toBe('Recipient added.')

    await recipients.removeRecipientFromTarget('all', 'dailyLogs', 'daily@example.com')

    expect(updateGlobalNotificationRecipientsMock).toHaveBeenLastCalledWith(
      'dailyLogs',
      ['default@example.com'],
    )
    expect(globalNotificationRecipients.value.dailyLogs).toEqual(['default@example.com'])
    expect(detailInfo.value).toBe('Recipient removed.')
  })

  it('keeps pending input and local recipients unchanged when selected-job persistence fails', async () => {
    updateJobNotificationRecipientsMock.mockRejectedValueOnce(new Error('No write access'))
    const {
      detailError,
      detailInfo,
      detailNotificationRecipients,
      detailRecipientInputs,
      recipients,
    } = mountNotificationRecipients({ selectedJob: makeJob({ id: 'job-alpha' }) })
    detailNotificationRecipients.shopOrders.push('existing@example.com')
    detailRecipientInputs.shopOrders = 'new@example.com'

    await recipients.addRecipientToTarget('job', 'shopOrders')

    expect(updateJobNotificationRecipientsMock).toHaveBeenCalledWith(
      'job-alpha',
      'shopOrders',
      ['existing@example.com', 'new@example.com'],
    )
    expect(detailNotificationRecipients.shopOrders).toEqual(['existing@example.com'])
    expect(detailRecipientInputs.shopOrders).toBe('new@example.com')
    expect(detailInfo.value).toBe('')
    expect(detailError.value).toBe('No write access')
    expect(recipients.recipientSaving.value).toBe(false)
  })
})
