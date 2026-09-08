import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  httpsCallable: vi.fn(),
  functions: { name: 'functions' },
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: mocks.httpsCallable,
}))

vi.mock('@/firebase', () => ({
  requireFirebaseServices: () => ({ functions: mocks.functions }),
}))

vi.mock('@/testing/e2eRuntime', () => ({
  createE2EUser: vi.fn(),
  deleteE2EUser: vi.fn(),
  isE2EActive: vi.fn(() => false),
  resendE2EUserInvite: vi.fn(),
  sendE2EPendingUserInvites: vi.fn(),
  sendE2EUserPasswordReset: vi.fn(),
  subscribeE2EUsers: vi.fn(),
  updateE2EUser: vi.fn(),
}))

import { resendUserInviteByAdmin, sendUserPasswordResetByAdmin } from '@/services/users'

describe('admin user email services', () => {
  beforeEach(() => {
    mocks.callable.mockReset()
    mocks.httpsCallable.mockReset()
    mocks.httpsCallable.mockReturnValue(mocks.callable)
  })

  it('calls the individual resend-invite function with only the selected user ID', async () => {
    const result = {
      success: true,
      email: 'cj@example.com',
      message: 'Invite email sent to cj@example.com.',
    }
    mocks.callable.mockResolvedValueOnce({ data: result })

    await expect(resendUserInviteByAdmin('user-cj')).resolves.toEqual(result)

    expect(mocks.httpsCallable).toHaveBeenCalledWith(mocks.functions, 'resendUserInviteByAdmin')
    expect(mocks.callable).toHaveBeenCalledWith({ uid: 'user-cj' })
  })

  it('calls the admin password-reset function with only the selected user ID', async () => {
    const result = {
      success: true,
      email: 'cj@example.com',
      message: 'Password reset email sent to cj@example.com.',
    }
    mocks.callable.mockResolvedValueOnce({ data: result })

    await expect(sendUserPasswordResetByAdmin('user-cj')).resolves.toEqual(result)

    expect(mocks.httpsCallable).toHaveBeenCalledWith(
      mocks.functions,
      'sendUserPasswordResetByAdmin',
    )
    expect(mocks.callable).toHaveBeenCalledWith({ uid: 'user-cj' })
  })

  it('keeps invite and password-reset service errors distinct', async () => {
    mocks.callable.mockRejectedValueOnce(null)
    await expect(resendUserInviteByAdmin('user-cj')).rejects.toThrow(
      'Failed to resend invite email.',
    )

    mocks.callable.mockRejectedValueOnce(null)
    await expect(sendUserPasswordResetByAdmin('user-cj')).rejects.toThrow(
      'Failed to send password reset email.',
    )
  })
})
