import { describe, expect, it, vi } from 'vitest'

import {
  buildForgotPasswordTarget,
  getAuthEmailQueryPrefill,
  getForgotPasswordValidationMessage,
  getLoginValidationMessage,
  getPasswordCreatedLoginInfo,
  getSetPasswordValidationMessage,
  getWorkspaceRedirectTarget,
  invalidSetupLinkMessage,
  passwordCreatedLoginMessage,
  readSetupLinkParams,
  redirectToWorkspaceIfAllowed,
} from '@/features/auth/authViewHelpers'

describe('auth view helpers', () => {
  it('builds forgot-password route targets from trimmed login email input', () => {
    expect(buildForgotPasswordTarget(' cj@example.com ')).toEqual({
      name: 'forgot-password',
      query: { email: 'cj@example.com' },
    })

    expect(buildForgotPasswordTarget('   ')).toEqual({
      name: 'forgot-password',
      query: undefined,
    })
  })

  it('derives the password-created login message from route query values', () => {
    expect(getPasswordCreatedLoginInfo('1')).toBe(passwordCreatedLoginMessage)
    expect(getPasswordCreatedLoginInfo(['1', '0'])).toBe(passwordCreatedLoginMessage)
    expect(getPasswordCreatedLoginInfo('0')).toBe('')
    expect(getPasswordCreatedLoginInfo(undefined)).toBe('')
  })

  it('reads auth email query prefill from scalar or repeated query values', () => {
    expect(getAuthEmailQueryPrefill({ email: 'cj@example.com' })).toBe('cj@example.com')
    expect(getAuthEmailQueryPrefill({ email: ['cj@example.com', 'other@example.com'] })).toBe(
      'cj@example.com',
    )
    expect(getAuthEmailQueryPrefill({ email: '' })).toBe('')
    expect(getAuthEmailQueryPrefill({})).toBe('')
  })

  it('keeps email deep-link redirects inside the app', () => {
    const dailyLogTarget = '/jobs/job-1/daily-logs?date=2026-06-12&logId=log-1#daily-log-photos'

    expect(getWorkspaceRedirectTarget(dailyLogTarget)).toBe(dailyLogTarget)
    expect(getWorkspaceRedirectTarget([dailyLogTarget, '/jobs'])).toBe(dailyLogTarget)
    expect(getWorkspaceRedirectTarget('https://example.com')).toBe('/jobs')
    expect(getWorkspaceRedirectTarget('//example.com')).toBe('/jobs')
    expect(getWorkspaceRedirectTarget('/login?redirect=/jobs')).toBe('/jobs')
    expect(getWorkspaceRedirectTarget(undefined)).toBe('/jobs')
  })

  it('redirects to the workspace only when the current auth state allows access', async () => {
    const replace = vi.fn<(target: string) => void>()

    await expect(
      redirectToWorkspaceIfAllowed({
        hasWorkspaceAccess: false,
        replace,
      }),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()

    await expect(
      redirectToWorkspaceIfAllowed({
        hasWorkspaceAccess: true,
        replace,
      }),
    ).resolves.toBe(true)

    expect(replace).toHaveBeenCalledWith('/jobs')
  })

  it('supports a custom workspace redirect target', async () => {
    const replace = vi.fn<(target: string) => void>()

    await redirectToWorkspaceIfAllowed({
      hasWorkspaceAccess: true,
      replace,
      workspaceTarget: '/dashboard',
    })

    expect(replace).toHaveBeenCalledWith('/dashboard')
  })

  it('validates login and forgot-password form input', () => {
    expect(getLoginValidationMessage('', 'secret')).toBe('Enter your email and password.')
    expect(getLoginValidationMessage('cj@example.com', '')).toBe('Enter your email and password.')
    expect(getLoginValidationMessage('cj@example.com', 'secret')).toBe('')

    expect(getForgotPasswordValidationMessage('')).toBe('Enter your email first.')
    expect(getForgotPasswordValidationMessage('   ')).toBe('Enter your email first.')
    expect(getForgotPasswordValidationMessage('cj@example.com')).toBe('')
  })

  it('validates password setup fields in the same order as the route form', () => {
    expect(getSetPasswordValidationMessage('', '')).toBe('Password is required.')
    expect(getSetPasswordValidationMessage('short', 'short')).toBe(
      'Password must be between 12 and 128 characters.',
    )
    expect(getSetPasswordValidationMessage('test-password1', 'test-password2')).toBe(
      'Passwords do not match.',
    )
    expect(getSetPasswordValidationMessage('test-password1', 'test-password1')).toBe('')
  })

  it('reads setup-link params from scalar or repeated query values', () => {
    expect(
      readSetupLinkParams({
        setupToken: ['token-a', 'token-b'],
        uid: 'user-a',
      }),
    ).toEqual({
      setupToken: 'token-a',
      uid: 'user-a',
    })

    expect(readSetupLinkParams({})).toEqual({
      setupToken: '',
      uid: '',
    })
    expect(invalidSetupLinkMessage).toContain('Invalid setup link')
  })
})
