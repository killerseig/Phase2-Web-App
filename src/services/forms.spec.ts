import { afterEach, describe, expect, it, vi } from 'vitest'
const { callable, invoke, services } = vi.hoisted(() => ({
  callable: vi.fn(),
  invoke: vi.fn(),
  services: { functions: { name: 'existing-authenticated-functions-client' } },
}))
vi.mock('firebase/functions', () => ({ httpsCallable: callable }))
vi.mock('@/firebase', () => ({ requireFirebaseServices: () => services }))
vi.mock('@/testing/e2eRuntime', () => ({ isE2EActive: () => false }))
import { formApi, isFormServerEnabled } from './forms'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
describe('Forms production and local service boundary', () => {
  it('uses the existing Functions client for production server drafts', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_FORM_EMULATORS', undefined)
    invoke.mockResolvedValue({ data: { templates: [] } })
    callable.mockReturnValue(invoke)
    await expect(formApi('formTemplates', { action: 'list' })).resolves.toEqual({ templates: [] })
    expect(callable).toHaveBeenCalledWith(services.functions, 'formTemplates')
    expect(invoke).toHaveBeenCalledWith({ action: 'list' })
  })
  it('blocks ordinary development requests before calling a Firebase service', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_FORM_EMULATORS', undefined)
    await expect(formApi('formTemplates', { action: 'list' })).rejects.toThrow('emulator profile')
    expect(callable).not.toHaveBeenCalled()
  })
  it('retains the explicitly enabled local emulator profile', () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_FORM_EMULATORS', 'true')
    expect(isFormServerEnabled()).toBe(true)
  })
})
