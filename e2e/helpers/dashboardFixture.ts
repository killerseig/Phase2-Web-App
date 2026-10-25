import type { Page } from '@playwright/test'
import type { SharedDashboardWidget as DashboardWidget } from '../../functions/src/sharedDashboardModel.js'

export async function mockDashboard(page: Page, admin = true) {
  const layouts = new Map<string, { version: number; widgets: DashboardWidget[] }>()
  let failSave = false
  const requests: Record<string, unknown>[] = []
  const contents = new Map<string, { notes: Record<string,string>; events: unknown[]; version: number }>()
  await page.addInitScript(() => { window.__PHASE2_FORM_SERVER__ = true })
  await page.route('**/formTemplates', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    await route.fulfill({ headers, json: { result: { templates: [] } } })
  })
  await page.route(/\/(?:dashboardWorkspace|sharedDashboardWorkspace)$/, async (route) => {
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
    if (data.action === 'save' || data.action === 'save-template') {
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
    const content = contents.get(key) || { notes: {}, events: [], version: 0 }
    if (data.action === 'save-notes') { content.notes[data.widgetId] = data.text; content.version++; contents.set(key, content) }
    if (data.action === 'save-calendar') { content.events = data.events; content.version++; contents.set(key, content) }
    await route.fulfill({ headers, json: { result: {
      ...state, canEdit, role: data.role || (admin ? 'admin' : 'foreman'), allowRoleEditing: false, job: null,
      notes: content.notes, events: content.events, notesVersion: content.version,
      ...(['save-notes','save-calendar'].includes(data.action) ? { version: content.version } : {}),
    } } })
  })
  return {
    layouts,
    requests,
    failSave: () => {
      failSave = true
    },
  }
}
