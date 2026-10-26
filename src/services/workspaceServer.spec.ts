import { afterEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  configured: true,
  synthetic: false,
  functions: { name: 'existing-functions-client' },
  callable: vi.fn(),
  invoke: vi.fn(),
}))
vi.mock('@/testing/e2eRuntime', () => ({ isE2EActive: () => fake.synthetic }))
vi.mock('@/services/firebaseConfig', () => ({
  get hasConfiguredFirebase() { return fake.configured },
}))
vi.mock('@/firebase', () => ({ requireFirebaseServices: () => ({ functions: fake.functions }) }))
vi.mock('firebase/functions', () => ({ httpsCallable: fake.callable }))
import { isWorkspaceServerEnabled } from './workspaceServer'
import { isFormServerEnabled } from './forms'
import { sharedDashboardCommand } from './sharedDashboards'

afterEach(() => {
  fake.configured = true
  fake.synthetic = false
  delete window.__PHASE2_FORM_SERVER__
  vi.clearAllMocks()
})

describe('shared workspace service availability', () => {
  it.each([true, false])('uses Firebase configuration outside synthetic fixtures: %s', configured => {
    fake.configured = configured
    window.__PHASE2_FORM_SERVER__ = !configured
    expect(isWorkspaceServerEnabled()).toBe(configured)
    expect(isFormServerEnabled()).toBe(configured)
  })

  it.each([undefined, false, true])('retains the explicit synthetic server opt-in: %s', enabled => {
    fake.synthetic = true
    window.__PHASE2_FORM_SERVER__ = enabled
    expect(isWorkspaceServerEnabled()).toBe(enabled === true)
    expect(isFormServerEnabled()).toBe(enabled === true)
  })

  it('blocks unavailable dashboards before creating a callable', async () => {
    fake.configured = false
    await expect(sharedDashboardCommand('load', { scope: 'personal' })).rejects.toThrow()
    expect(fake.callable).not.toHaveBeenCalled()
  })

  it('keeps the dashboard endpoint, authenticated client and action payload unchanged', async () => {
    fake.callable.mockReturnValue(fake.invoke)
    fake.invoke.mockResolvedValue({ data: { version: 7, widgets: [] } })
    const data = { scope: 'role', role: 'foreman', version: 6, widgets: [] }
    await expect(sharedDashboardCommand('save-template', data)).resolves.toEqual({ version: 7, widgets: [] })
    expect(fake.callable).toHaveBeenCalledWith(fake.functions, 'sharedDashboardWorkspace')
    expect(fake.invoke).toHaveBeenCalledWith({ ...data, action: 'save-template' })
  })
})
