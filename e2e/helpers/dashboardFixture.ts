import type { Page } from '@playwright/test'
import type { DashboardWidget } from '../../src/features/dashboard/widgets.js'

export async function mockDashboard(page: Page, admin = true) {
  const layouts = new Map<string, { version: number; widgets: DashboardWidget[] }>()
  let failSave = false
  const requests: Record<string, unknown>[] = []
  await page.route('**/dashboardWorkspace', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    requests.push(data)
    const key = data.scope === 'role' ? `role-${data.role}` : 'personal'
    const state = layouts.get(key) || {
      version: 0,
      widgets: [
        {
          id: 'documents',
          type: 'documents' as const,
          span: 12 as const,
          title: 'Documents',
          text: '',
        },
      ],
    }
    const canEdit = data.scope === 'personal' || admin
    if (data.action === 'save') {
      if (failSave || !canEdit) {
        await route.fulfill({
          status: failSave ? 409 : 403,
          headers,
          json: {
            error: {
              status: failSave ? 'ABORTED' : 'PERMISSION_DENIED',
              message: failSave
                ? 'This dashboard changed elsewhere. Reload and review before saving.'
                : 'Only admins can edit shared role layouts.',
            },
          },
        })
        return
      }
      state.version++
      state.widgets = structuredClone(data.widgets)
      layouts.set(key, state)
    }
    await route.fulfill({ headers, json: { result: { ...state, canEdit } } })
  })
  return {
    layouts,
    requests,
    failSave: () => {
      failSave = true
    },
  }
}
