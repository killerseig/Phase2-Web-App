import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { adminTemplateCommand } from '@/features/forms/templateCommands'
import { libraryCommand } from '@/features/sds/commands'
import { websiteCommand } from './website'
import { sharedDashboardCommand } from './sharedDashboards'
import type { WebsiteSite } from '@/features/website/types'

const fake = vi.hoisted(() => ({ callable: vi.fn(), invoke: vi.fn(), functions: {} }))
vi.mock('firebase/functions', () => ({ httpsCallable: fake.callable }))
vi.mock('@/firebase', () => ({
  hasFirebaseConfig: true,
  requireFirebaseServices: () => ({ functions: fake.functions }),
}))
vi.mock('@/testing/e2eRuntime', () => ({ isE2EActive: () => false }))
const site: WebsiteSite = { name: 'Synthetic', accent: '#174878', pages: [] }
afterEach(() => {
  vi.clearAllMocks()
})

describe('typed workspace command boundaries retain their wire protocols', () => {
  it('preserves form issue identity/revision and infers its publication result', async () => {
    fake.callable.mockReturnValue(fake.invoke)
    fake.invoke.mockResolvedValue({ data: { id: 'form-1', latestVersion: 2, revision: 8 } })
    const result = await adminTemplateCommand('issue', { id: 'form-1', revision: 7 })
    expectTypeOf(result).toEqualTypeOf<{ id: string; latestVersion: number; revision: number }>()
    expect(fake.callable).toHaveBeenCalledWith(fake.functions, 'formTemplates')
    expect(fake.invoke).toHaveBeenCalledWith({ action: 'issue', id: 'form-1', revision: 7 })
    expect(result.latestVersion).toBe(2)
  })
  it('preserves private file authorization and the existing Library timeout', async () => {
    fake.callable.mockReturnValue(fake.invoke)
    fake.invoke.mockResolvedValue({
      data: { url: 'https://example.invalid/synthetic', revisionId: 'r1' },
    })
    const result = await libraryCommand('openSheet', {
      id: 'file-1',
      jobId: 'job-1',
      download: false,
    })
    expectTypeOf(result.url).toEqualTypeOf<string>()
    expect(fake.callable).toHaveBeenCalledWith(fake.functions, 'sdsWorkspace', { timeout: 120000 })
    expect(fake.invoke).toHaveBeenCalledWith({
      action: 'openSheet',
      id: 'file-1',
      jobId: 'job-1',
      download: false,
    })
  })
  it('preserves Website save payload and infers its revision response', async () => {
    fake.callable.mockReturnValue(fake.invoke)
    fake.invoke.mockResolvedValue({ data: { version: 4 } })
    const result = await websiteCommand('save', { version: 3, site })
    expectTypeOf(result.version).toEqualTypeOf<number>()
    expect(fake.callable).toHaveBeenCalledWith(fake.functions, 'websiteBuilder', { timeout: 90000 })
    expect(fake.invoke).toHaveBeenCalledWith({ action: 'save', version: 3, site })
  })
  it('distinguishes dashboard content responses from template layouts', async () => {
    fake.callable.mockReturnValue(fake.invoke)
    fake.invoke.mockResolvedValue({ data: { version: 2, notes: {}, events: [] } })
    const result = await sharedDashboardCommand('save-calendar', {
      scope: 'personal',
      version: 1,
      events: [],
    })
    expectTypeOf(result).toEqualTypeOf<{
      version: number
      notes: Record<string, string>
      events: import('@/features/dashboard/sharedDashboards').SharedCalendarEntry[]
    }>()
    expect(fake.invoke).toHaveBeenCalledWith({
      action: 'save-calendar',
      scope: 'personal',
      version: 1,
      events: [],
    })
  })
})

// Checked by vue-tsc; never executed and never sends malformed requests.
function rejectedAtCompileTime() {
  // @ts-expect-error Form saves require an optimistic revision.
  void adminTemplateCommand('save', {
    id: 'form-1',
    definition: { title: '', description: '', fields: [], recipients: [] },
  })
  // @ts-expect-error Unknown authoring actions cannot reach the callable.
  void adminTemplateCommand('submit', { id: 'form-1' })
  // @ts-expect-error Library uploads cannot omit their library version.
  void libraryCommand('saveSheet', { name: 'File' })
  // @ts-expect-error Website save requires a site, not just a version.
  void websiteCommand('save', { version: 3 })
  // @ts-expect-error Website mutations cannot invent new actions.
  void websiteCommand('deleteEverything', {})
  // @ts-expect-error Dashboard owner identity comes from authentication.
  void sharedDashboardCommand('load', { scope: 'personal', ownerId: 'another-user' })
  // @ts-expect-error Calendar saves require calendar entries.
  void sharedDashboardCommand('save-calendar', { scope: 'personal', version: 1 })
}
void rejectedAtCompileTime
