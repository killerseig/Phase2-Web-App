import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashIntegrationSecret } from './apiScopePolicy'
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
  formRun: vi.fn(),
  storageFile: vi.fn(),
}))
vi.mock('./runtime', () => ({
  db: {
    doc: () => ({ get: mocks.get }),
    collection: () => ({ doc: () => ({ create: mocks.audit }) }),
    runTransaction: mocks.transaction,
  },
  storageBucket: { file: mocks.storageFile },
}))
vi.mock('./formFunctions', () => ({ formTemplates: { run: mocks.formRun } }))
vi.mock('firebase-functions/v2/https', () => ({
  onRequest: (_options: unknown, handler: unknown) => handler,
}))
import { scopedIntegrationApi } from './integrationApi'
const secret = 'a'.repeat(43)
async function invoke(authorization: string, operation = 'forms.draft.create') {
  const response = {
    set: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }
  await (scopedIntegrationApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
    {
      method: 'POST',
      get: () => authorization,
      body: { requestId: '12345678-1234-1234-1234-123456789012', operation, payload: {} },
    },
    response,
  )
  return response
}
describe('scoped integration HTTP denial boundaries', () => {
  beforeEach(() => vi.resetAllMocks())
  it('rejects missing bearer credentials before database or mutation calls', async () => {
    const response = await invoke('')
    expect(response.status).toHaveBeenCalledWith(401)
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.formRun).not.toHaveBeenCalled()
  })
  it('rejects publication even for a correctly hashed draft integration credential', async () => {
    mocks.get.mockResolvedValue({
      exists: true,
      data: () => ({
        secretHash: hashIntegrationSecret(secret),
        scopes: ['forms:draft:write'],
        createdAt: 0,
        expiresAt: Date.now() + 10000,
        formIds: [],
        sdsFolderIds: [],
        actorUid: 'admin-a',
      }),
    })
    const response = await invoke(`Bearer key-a.${secret}`, 'forms.publish')
    expect(response.status).toHaveBeenCalledWith(403)
    expect(mocks.formRun).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.storageFile).not.toHaveBeenCalled()
  })
  it('revokes automation capability when the existing actor is no longer active Admin', async () => {
    mocks.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          secretHash: hashIntegrationSecret(secret),
          scopes: ['forms:draft:write'],
          createdAt: 0,
          expiresAt: Date.now() + 10000,
          formIds: [],
          sdsFolderIds: [],
          actorUid: 'admin-a',
        }),
      })
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: 'admin', active: false }) })
    const response = await invoke(`Bearer key-a.${secret}`)
    expect(response.status).toHaveBeenCalledWith(403)
    expect(mocks.formRun).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
