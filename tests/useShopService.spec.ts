import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShopService } from '@/services/useShopService'
import { httpsCallable } from 'firebase/functions'
import { useJobAccess } from '@/composables/useJobAccess'

vi.mock('@/firebase', () => ({ functions: {} }))

const canAccessJob = vi.fn()
vi.mock('@/composables/useJobAccess', () => ({ useJobAccess: () => ({ canAccessJob }) }))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}))

const httpsCallableMock = httpsCallable as unknown as ReturnType<typeof vi.fn>

describe('useShopService', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    canAccessJob.mockReturnValue(true)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy?.mockRestore()
    consoleErrorSpy = null
  })

  it('sends shop order email when authorized', async () => {
    const sendFn = vi.fn().mockResolvedValue({ data: { success: true, message: 'sent' } })
    httpsCallableMock.mockReturnValue(sendFn)
    const request = { jobId: 'job-1', shopOrderId: 'order-1', recipients: ['a@example.com'] }

    const { sendShopOrderEmail, isLoading, error } = useShopService()
    const result = await sendShopOrderEmail(request)

    expect(result).toEqual({ success: true, message: 'sent' })
    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'sendShopOrderEmail')
    expect(sendFn).toHaveBeenCalledWith(request)
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('rejects when user cannot access job', async () => {
    canAccessJob.mockReturnValue(false)
    const sendFn = vi.fn()
    httpsCallableMock.mockReturnValue(sendFn)
    const request = { jobId: 'job-1', shopOrderId: 'order-1', recipients: [] }

    const { sendShopOrderEmail, isLoading, error } = useShopService()

    await expect(sendShopOrderEmail(request)).rejects.toThrow('You do not have access to this job')
    expect(error.value).toBe('You do not have access to this job')
    expect(isLoading.value).toBe(false)
    expect(sendFn).not.toHaveBeenCalled()
  })

  it('surfaces errors from callable', async () => {
    const sendFn = vi.fn().mockRejectedValue(new Error('boom'))
    httpsCallableMock.mockReturnValue(sendFn)
    const request = { jobId: 'job-1', shopOrderId: 'order-1', recipients: ['a@example.com'] }

    const { sendShopOrderEmail, error, isLoading } = useShopService()

    await expect(sendShopOrderEmail(request)).rejects.toThrow('boom')
    expect(error.value).toBe('boom')
    expect(isLoading.value).toBe(false)
  })
})
