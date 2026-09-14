import { createHash } from 'node:crypto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let handleResendUserInviteByAdmin: typeof import('../../functions/src/userFunctions').handleResendUserInviteByAdmin
let handleSendUserPasswordResetByAdmin: typeof import('../../functions/src/userFunctions').handleSendUserPasswordResetByAdmin
let sendUserInvite: typeof import('../../functions/src/userFunctions').sendUserInvite

beforeAll(async () => {
  vi.doMock('../../functions/src/runtime', () => ({
    auth: {},
    db: {},
    storageBucket: {
      file: vi.fn(),
    },
  }))

  const userFunctions = await import('../../functions/src/userFunctions')
  handleResendUserInviteByAdmin = userFunctions.handleResendUserInviteByAdmin
  handleSendUserPasswordResetByAdmin = userFunctions.handleSendUserPasswordResetByAdmin
  sendUserInvite = userFunctions.sendUserInvite
}, 30_000)

function makeDependencies(overrides: Record<string, unknown> = {}) {
  return {
    verifyAdminRole: vi.fn(async () => undefined),
    isEmailEnabled: vi.fn(() => true),
    getUserProfile: vi.fn(async () => ({
      email: 'cj.blanchard@phase2co.com',
      firstName: 'CJ',
      lastName: 'Blanchard',
    })),
    getAuthUser: vi.fn(async () => ({
      email: 'cj.blanchard@phase2co.com',
      displayName: null,
    })),
    sendInvite: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('admin user account email handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authorizes the admin and resends the selected user a fresh invite', async () => {
    const dependencies = makeDependencies()

    await expect(
      handleResendUserInviteByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: { uid: 'user-cj' },
        },
        dependencies,
      ),
    ).resolves.toEqual({
      success: true,
      email: 'cj.blanchard@phase2co.com',
      message: 'Invite email sent to cj.blanchard@phase2co.com.',
    })

    expect(dependencies.verifyAdminRole).toHaveBeenCalledWith('admin-1')
    expect(dependencies.sendInvite).toHaveBeenCalledWith({
      uid: 'user-cj',
      email: 'cj.blanchard@phase2co.com',
      firstName: 'CJ',
      sentByUid: 'admin-1',
    })
    expect(dependencies.sendPasswordReset).not.toHaveBeenCalled()
  })

  it('authorizes the admin and sends the selected user the existing password reset email', async () => {
    const dependencies = makeDependencies()

    await expect(
      handleSendUserPasswordResetByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: { uid: 'user-cj' },
        },
        dependencies,
      ),
    ).resolves.toEqual({
      success: true,
      email: 'cj.blanchard@phase2co.com',
      message: 'Password reset email sent to cj.blanchard@phase2co.com.',
    })

    expect(dependencies.verifyAdminRole).toHaveBeenCalledWith('admin-1')
    expect(dependencies.sendPasswordReset).toHaveBeenCalledWith({
      email: 'cj.blanchard@phase2co.com',
      displayName: 'CJ Blanchard',
    })
    expect(dependencies.sendInvite).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated, unauthorized, and malformed requests before sending', async () => {
    const unauthenticated = makeDependencies()
    await expect(
      handleResendUserInviteByAdmin(
        {
          data: { uid: 'user-cj' },
        },
        unauthenticated,
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(unauthenticated.verifyAdminRole).not.toHaveBeenCalled()
    expect(unauthenticated.sendInvite).not.toHaveBeenCalled()

    const malformed = makeDependencies()
    await expect(
      handleSendUserPasswordResetByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: {},
        },
        malformed,
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(malformed.verifyAdminRole).not.toHaveBeenCalled()

    const denied = new Error('Admins only')
    Object.assign(denied, { code: 'permission-denied' })
    const unauthorized = makeDependencies({
      verifyAdminRole: vi.fn(async () => {
        throw denied
      }),
    })
    await expect(
      handleResendUserInviteByAdmin(
        {
          auth: { uid: 'foreman-1' },
          data: { uid: 'user-cj' },
        },
        unauthorized,
      ),
    ).rejects.toBe(denied)
    expect(unauthorized.getUserProfile).not.toHaveBeenCalled()
    expect(unauthorized.sendInvite).not.toHaveBeenCalled()
  })

  it('does not report success when email is disabled or the Authentication account has no email', async () => {
    const disabled = makeDependencies({
      isEmailEnabled: vi.fn(() => false),
    })
    await expect(
      handleResendUserInviteByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: { uid: 'user-cj' },
        },
        disabled,
      ),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Email sending is disabled.',
    })
    expect(disabled.getUserProfile).not.toHaveBeenCalled()
    expect(disabled.sendInvite).not.toHaveBeenCalled()

    const noEmail = makeDependencies({
      getUserProfile: vi.fn(async () => ({ firstName: 'No', lastName: 'Email' })),
      getAuthUser: vi.fn(async () => ({ email: null, displayName: null })),
    })
    await expect(
      handleSendUserPasswordResetByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: { uid: 'user-no-email' },
        },
        noEmail,
      ),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: "This user's Authentication account does not have an email address.",
    })
    expect(noEmail.sendPasswordReset).not.toHaveBeenCalled()
  })

  it('rejects mismatched profile and Authentication emails instead of choosing one silently', async () => {
    const mismatched = makeDependencies({
      getUserProfile: vi.fn(async () => ({
        email: 'profile@example.com',
        firstName: 'Email',
        lastName: 'Mismatch',
      })),
      getAuthUser: vi.fn(async () => ({
        email: 'auth@example.com',
        displayName: null,
      })),
    })

    await expect(
      handleResendUserInviteByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: { uid: 'user-mismatch' },
        },
        mismatched,
      ),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message:
        "This user's profile email does not match their Authentication email. Update the account before sending email.",
    })
    expect(mismatched.sendInvite).not.toHaveBeenCalled()
  })

  it('returns distinct delivery failures for invite and password reset actions', async () => {
    const inviteFailure = makeDependencies({
      sendInvite: vi.fn(async () => {
        throw new Error('Graph invite failure')
      }),
    })
    await expect(
      handleResendUserInviteByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: { uid: 'user-cj' },
        },
        inviteFailure,
      ),
    ).rejects.toMatchObject({
      code: 'internal',
      message: 'Failed to resend invite email.',
    })

    const resetFailure = makeDependencies({
      sendPasswordReset: vi.fn(async () => {
        throw new Error('Graph reset failure')
      }),
    })
    await expect(
      handleSendUserPasswordResetByAdmin(
        {
          auth: { uid: 'admin-1' },
          data: { uid: 'user-cj' },
        },
        resetFailure,
      ),
    ).rejects.toMatchObject({
      code: 'internal',
      message: 'Failed to send password reset email.',
    })
  })
})

type SendUserInviteDependencies = NonNullable<Parameters<typeof sendUserInvite>[1]>

function makeInviteStateHarness(
  initialState: Record<string, unknown>,
  deliverEmail: SendUserInviteDependencies['deliverEmail'] = vi.fn(async () => undefined),
) {
  const deletedField = Symbol('deleted-field')
  let deliverySequence = 0
  let tokenSequence = 0
  let state = { ...initialState }
  const stateStore: SendUserInviteDependencies['stateStore'] = {
    async transact(_uid, transition) {
      const next = transition({ ...state })
      if (next.update) {
        for (const [field, value] of Object.entries(next.update)) {
          if (value === deletedField) {
            delete state[field]
          } else {
            state[field] = value
          }
        }
      }
      return next.result
    },
  }
  const dependencies: SendUserInviteDependencies = {
    createDeliveryId: () => {
      deliverySequence += 1
      return `delivery-${deliverySequence}`
    },
    createTokenRecord: () => ({
      setupToken: `new-setup-token${tokenSequence++ ? `-${tokenSequence}` : ''}`,
      setupTokenExpiry: new Date('2026-09-15T12:00:00.000Z'),
    }),
    deleteField: () => deletedField,
    deliverEmail,
    now: () => new Date('2026-09-08T12:00:00.000Z'),
    serverTimestamp: () => 'server-timestamp',
    stateStore,
  }

  return {
    dependencies,
    getState: () => ({ ...state }),
    replaceState: (nextState: Record<string, unknown>) => {
      state = { ...nextState }
    },
  }
}

describe('individual invite state lifecycle', () => {
  it('restores the prior token and invite metadata when delivery fails', async () => {
    const originalState = {
      setupTokenHash: 'previous-token',
      setupTokenExpiry: 'previous-expiry',
      inviteStatus: 'sent',
      inviteSentAt: 'previous-sent-at',
      inviteSentByUid: 'admin-previous',
    }
    const deliveryError = new Error('Graph delivery failed')
    const harness = makeInviteStateHarness(
      originalState,
      vi.fn(async () => {
        throw deliveryError
      }),
    )

    await expect(
      sendUserInvite(
        {
          uid: 'user-cj',
          email: 'cj.blanchard@phase2co.com',
          firstName: 'CJ',
          sentByUid: 'admin-current',
        },
        harness.dependencies,
      ),
    ).rejects.toBe(deliveryError)

    expect(harness.getState()).toEqual(originalState)
  })

  it('does not let an older failed resend roll back a newer invite token', async () => {
    const newerState = {
      setupTokenHash: 'newer-token',
      setupTokenExpiry: 'newer-expiry',
      inviteStatus: 'sent',
      inviteSentAt: 'newer-sent-at',
      inviteSentByUid: 'admin-newer',
      inviteDeliveryId: 'delivery-newer',
      inviteDeliveryLeaseExpiresAt: new Date('2026-09-08T12:02:00.000Z'),
    }
    let replaceState: ((nextState: Record<string, unknown>) => void) | null = null
    const deliveryError = new Error('Older delivery failed')
    const deliverEmail = vi.fn(async () => {
      replaceState?.(newerState)
      throw deliveryError
    })
    const harness = makeInviteStateHarness(
      {
        setupTokenHash: 'previous-token',
        inviteStatus: 'sent',
      },
      deliverEmail,
    )
    replaceState = harness.replaceState

    await expect(
      sendUserInvite(
        {
          uid: 'user-cj',
          email: 'cj.blanchard@phase2co.com',
          firstName: 'CJ',
          sentByUid: 'admin-older',
        },
        harness.dependencies,
      ),
    ).rejects.toBe(deliveryError)

    expect(harness.getState()).toEqual(newerState)
  })

  it('keeps completed accounts accepted after a successful resend', async () => {
    const harness = makeInviteStateHarness({
      setupTokenHash: null,
      setupTokenExpiry: null,
      inviteStatus: 'accepted',
      inviteSentAt: 'previous-sent-at',
      inviteSentByUid: 'admin-previous',
      inviteAcceptedAt: 'accepted-at',
    })

    await sendUserInvite(
      {
        uid: 'user-cj',
        email: 'cj.blanchard@phase2co.com',
        firstName: 'CJ',
        sentByUid: 'admin-current',
      },
      harness.dependencies,
    )

    expect(harness.getState()).toMatchObject({
      setupTokenHash: createHash('sha256').update('new-setup-token').digest('hex'),
      inviteStatus: 'accepted',
      inviteSentAt: 'server-timestamp',
      inviteSentByUid: 'admin-current',
      inviteAcceptedAt: 'accepted-at',
    })
    expect(harness.getState()).not.toHaveProperty('inviteDeliveryId')
    expect(harness.getState()).not.toHaveProperty('inviteDeliveryLeaseExpiresAt')
  })

  it('rejects an overlapping send while the current delivery lease is active', async () => {
    let finishFirstDelivery!: () => void
    const deliverEmail = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        finishFirstDelivery = resolve
      })
    })
    const harness = makeInviteStateHarness(
      {
        setupTokenHash: 'previous-token',
        inviteStatus: 'sent',
      },
      deliverEmail,
    )

    const firstSend = sendUserInvite(
      {
        uid: 'user-cj',
        email: 'cj.blanchard@phase2co.com',
        firstName: 'CJ',
        sentByUid: 'admin-first',
      },
      harness.dependencies,
    )
    await vi.waitFor(() => expect(deliverEmail).toHaveBeenCalledTimes(1))

    await expect(
      sendUserInvite(
        {
          uid: 'user-cj',
          email: 'cj.blanchard@phase2co.com',
          firstName: 'CJ',
          sentByUid: 'admin-second',
        },
        harness.dependencies,
      ),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'An invite email is already being sent for this user. Wait a moment and try again.',
    })
    expect(deliverEmail).toHaveBeenCalledTimes(1)

    finishFirstDelivery()
    await expect(firstSend).resolves.toBeUndefined()
    expect(harness.getState()).not.toHaveProperty('inviteDeliveryId')
    expect(harness.getState()).not.toHaveProperty('inviteDeliveryLeaseExpiresAt')
  })

  it('reports failure instead of success when a completed delivery loses ownership', async () => {
    const newerState = {
      setupTokenHash: 'newer-token',
      setupTokenExpiry: 'newer-expiry',
      inviteStatus: 'sent',
      inviteSentAt: 'newer-sent-at',
      inviteSentByUid: 'admin-newer',
      inviteDeliveryId: 'delivery-newer',
      inviteDeliveryLeaseExpiresAt: new Date('2026-09-08T12:02:00.000Z'),
    }
    let replaceState: ((nextState: Record<string, unknown>) => void) | null = null
    const deliverEmail = vi.fn(async () => {
      replaceState?.(newerState)
    })
    const harness = makeInviteStateHarness(
      {
        setupTokenHash: 'previous-token',
        inviteStatus: 'sent',
      },
      deliverEmail,
    )
    replaceState = harness.replaceState

    await expect(
      sendUserInvite(
        {
          uid: 'user-cj',
          email: 'cj.blanchard@phase2co.com',
          firstName: 'CJ',
          sentByUid: 'admin-older',
        },
        harness.dependencies,
      ),
    ).rejects.toMatchObject({
      code: 'aborted',
      message: 'This invite email was superseded before it could be finalized. Send a new invite.',
    })
    expect(harness.getState()).toEqual(newerState)
  })
})
