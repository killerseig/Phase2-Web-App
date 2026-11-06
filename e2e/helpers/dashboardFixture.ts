import type { Page } from '@playwright/test'
import type { PublishedAnnouncement } from '../../functions/src/sharedDashboardModel.js'
import type { SharedDashboardWidget as DashboardWidget } from '../../functions/src/sharedDashboardModel.js'

export async function mockDashboard(page: Page, admin = true) {
  const layouts = new Map<string, { version: number; widgets: DashboardWidget[] }>()
  let failSave = false
  let failTasks = false
  let failAnnouncements = false
  const announcements: PublishedAnnouncement[] = []
  const publishedDraftIds: string[] = []
  const requests: Record<string, unknown>[] = []
  const contents = new Map<string, { notes: Record<string,string>; events: unknown[]; tasks?: unknown[]; announcementDrafts?: unknown[]; version: number }>()
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
    if (data.action === 'list-announcement-recipients') {
      await route.fulfill({ headers, json: { result: { items: [
        {uid:'admin-e2e', name:'Admin User', email:'admin@example.invalid', role:'admin'},
        {uid:'foreman-e2e', name:'Pat Foreman', email:'pat@example.invalid', role:'foreman'},
        {uid:'other-e2e', name:'Other Coworker', email:'other@example.invalid', role:'project-manager'},
      ].filter(person => (person.name + ' ' + person.email).toLowerCase().includes(String(data.search || '').toLowerCase())), nextCursor:null } } })
      return
    }
    if (data.action === 'list-announcements') {
      await route.fulfill({ headers, json: { result: { items: announcements, limit: 50 } } })
      return
    }
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
    if (data.action === 'save-tasks' && failTasks) {
      failTasks = false
      await route.fulfill({ status: 409, headers, json: { error: { status: 'ABORTED', message: 'This dashboard changed elsewhere. Reload and review before saving.' } } })
      return
    }
    if (data.action === 'save-announcement-drafts' && failAnnouncements) {
      failAnnouncements = false
      await route.fulfill({ status: 409, headers, json: { error: { status: 'ABORTED', message: 'This dashboard changed elsewhere. Reload and review before saving.' } } })
      return
    }
    const content = contents.get(key) || { notes: {}, events: [], version: 0 }
    if (data.action === 'publish-announcement') {
      const draft = contents.get('personal')?.announcementDrafts?.find(item => (item as { id: string }).id === data.draftId) as { id: string; title: string; body: string; audience: 'everyone' | 'job' | 'people'; jobId?: string }
      if (!publishedDraftIds.includes(draft.id)) { announcements.push({ ...draft, publishedAt: Date.now() }); publishedDraftIds.push(draft.id) }
      await route.fulfill({ headers, json: { result: { id: draft.id } } })
      return
    }
    if (data.action === 'save-notes') { content.notes[data.widgetId] = data.text; content.version++; contents.set(key, content) }
    if (data.action === 'save-announcement-drafts') { content.announcementDrafts = structuredClone(data.announcementDrafts); content.version++; contents.set(key, content) }
    if (data.action === 'save-tasks') { content.tasks = structuredClone(data.tasks); content.version++; contents.set(key, content) }
    if (data.action === 'save-calendar') { content.events = data.events; content.version++; contents.set(key, content) }
    await route.fulfill({ headers, json: { result: {
      ...state, canEdit, role: data.role || (admin ? 'admin' : 'foreman'), allowRoleEditing: false, job: null,
      publishedDraftIds, announcementDrafts: content.announcementDrafts || [], tasks: content.tasks || [], notes: content.notes, events: content.events, notesVersion: content.version,
      ...(['save-notes','save-calendar','save-tasks','save-announcement-drafts'].includes(data.action) ? { version: content.version } : {}),
    } } })
  })
  return {
    layouts,
    requests,
    announcements,
    failAnnouncementSave: () => { failAnnouncements = true },
    failTaskSave: () => { failTasks = true },
    failSave: () => {
      failSave = true
    },
  }
}
