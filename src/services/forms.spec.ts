import { afterEach, describe, expect, it, vi } from 'vitest'
const { callable, invoke, services, config } = vi.hoisted(() => ({
  callable: vi.fn(),
  invoke: vi.fn(),
  services: { functions: { name: 'existing-authenticated-functions-client' } },
  config: { configured: true },
}))
vi.mock('firebase/functions', () => ({ httpsCallable: callable }))
vi.mock('@/firebase', () => ({ requireFirebaseServices: () => services }))
vi.mock('@/testing/e2eRuntime', () => ({ isE2EActive: () => false }))
vi.mock('@/services/firebaseConfig', () => ({ get hasConfiguredFirebase() { return config.configured } }))
import { formApi, isFormServerEnabled, isFormEmulatorEnabled } from './forms'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  config.configured = true
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
  it('uses the configured Firebase client in ordinary npm run dev', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_FORM_EMULATORS', undefined)
    invoke.mockResolvedValue({data:{templates:[]}})
    callable.mockReturnValue(invoke)
    expect(isFormServerEnabled()).toBe(true)
    expect(isFormEmulatorEnabled()).toBe(false)
    await expect(formApi('formTemplates', {action:'list'})).resolves.toEqual({templates:[]})
    expect(callable).toHaveBeenCalledWith(services.functions,'formTemplates')
  })
  it('blocks missing configuration before calling a Firebase service', async () => {
    config.configured = false
    await expect(formApi('formTemplates', {action:'list'})).rejects.toThrow('Configure Firebase')
    expect(callable).not.toHaveBeenCalled()
  })
  it('retains the explicitly enabled local emulator profile', () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_FORM_EMULATORS', 'true')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID','demo-phase2-security')
    expect(isFormServerEnabled()).toBe(true)
    expect(isFormEmulatorEnabled()).toBe(true)
  })
})
