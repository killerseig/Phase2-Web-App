import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from './runtime'
import { buildCurrentFunctionUser, type CurrentFunctionUser } from './roleAccess'
import { VALID_ROLES, type UserRole } from './constants'
import { targetFunctionRoleCanOpenJobDashboard } from './targetJobAccess'
import { isFunctionShopJob } from './jobIdentity'
import {
  defaultSharedWidgets,
  sharedDashboardKey,
  validateSharedWidgets,
  validateSharedCalendar,
  type SharedDashboardScope,
} from './sharedDashboardModel'

const denied = (message = 'You do not have access to this dashboard.') =>
  new HttpsError('permission-denied', message)
function identifier(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw new HttpsError('invalid-argument', 'Choose a valid job.')
  return value
}
function checkVersion(expected: unknown, actual: number) {
  if (!Number.isSafeInteger(expected) || expected !== actual)
    throw new HttpsError(
      'aborted',
      'This dashboard changed elsewhere. Reload and review before saving.',
    )
}
function canReadJob(user: CurrentFunctionUser, id: string, job: Record<string, unknown>) {
  const assigned = new Set(user.assignedJobIds)
  if (Array.isArray(job.assignedForemanIds) && job.assignedForemanIds.includes(user.uid))
    assigned.add(id)
  return targetFunctionRoleCanOpenJobDashboard({
    role: user.role,
    jobId: id,
    assignedJobIds: [...assigned],
    isShopJob: isFunctionShopJob(job),
  })
}
function jobData(id: string, job: Record<string, unknown>) {
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  return {
    id,
    name: text(job.name),
    code: text(job.code),
    gc: text(job.gc),
    jobAddress: text(job.jobAddress),
    startDate: text(job.startDate),
    finishDate: text(job.finishDate),
    active: job.active !== false,
  }
}

// Separate additive surfaces; never reads or writes the existing dashboardPersonal/dashboardRoles layouts.
export const sharedDashboardWorkspace = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to use dashboards.')
  const data = request.data || {}
  if (
    !['load', 'save-template', 'save-notes', 'save-calendar'].includes(data.action) ||
    !['job', 'role'].includes(data.scope) ||
    data.uid !== undefined ||
    data.ownerId !== undefined
  )
    throw new HttpsError('invalid-argument', 'Choose a shared job or role dashboard.')
  const scope = data.scope as SharedDashboardScope
  if (scope === 'role' && data.jobId !== undefined)
    throw new HttpsError(
      'invalid-argument',
      'Role home uses the signed-in person, not a supplied job context.',
    )
  return db.runTransaction(async (tx) => {
    const profile = await tx.get(db.doc('users/' + request.auth!.uid))
    const user = buildCurrentFunctionUser(request.auth!.uid, profile.data() || {})
    if (!profile.exists || !user.active || user.role === 'none') throw denied()
    const role = (data.role ?? user.role) as UserRole
    if (
      scope === 'role' &&
      (!VALID_ROLES.includes(role) ||
        role === 'none' ||
        (user.role !== 'admin' && role !== user.role))
    )
      throw denied()
    if (scope === 'job' && data.role !== undefined)
      throw new HttpsError(
        'invalid-argument',
        'The job template is shared by all jobs, not by role.',
      )
    if (
      ['save-notes', 'save-calendar'].includes(data.action) &&
      scope === 'job' &&
      user.role !== 'admin'
    )
      throw denied(
        'Only Admin can edit job notes and calendar dates until job-content permissions are agreed.',
      )
    if (
      data.allowRoleEditing !== undefined &&
      (scope !== 'role' || user.role !== 'admin' || typeof data.allowRoleEditing !== 'boolean')
    )
      throw denied('Only Admin can change role dashboard editing permission.')
    let job: Record<string, unknown> | undefined,
      jobId = ''
    if (scope === 'job' && data.jobId) {
      jobId = identifier(data.jobId)
      const snapshot = await tx.get(db.doc('jobs/' + jobId))
      if (!snapshot.exists || !canReadJob(user, jobId, snapshot.data()!)) throw denied()
      job = snapshot.data()!
    } else if (
      scope === 'job' &&
      (user.role !== 'admin' || ['save-notes', 'save-calendar'].includes(data.action))
    )
      throw denied('Choose a job you can access.')
    const templateRef = db.doc('sharedDashboardTemplates/' + sharedDashboardKey(scope, role))
    const template = await tx.get(templateRef),
      version = Number(template.data()?.version || 0)
    const allowRoleEditing = template.data()?.allowRoleEditing === true
    const canEdit =
      user.role === 'admin' || (scope === 'role' && role === user.role && allowRoleEditing)
    if (data.action === 'save-template' && !canEdit)
      throw denied('This role cannot edit its shared dashboard.')
    let widgets = template.data()?.widgets || defaultSharedWidgets(scope)
    const notesRef =
      scope === 'role'
        ? db.doc('sharedDashboardUserData/' + user.uid)
        : jobId
          ? db.doc('sharedDashboardJobData/' + jobId)
          : undefined
    const notes = notesRef ? await tx.get(notesRef) : undefined
    const content = notes?.data() || {}
    const prefix = scope === 'role' ? role + ':' : ''
    const visibleNotes = Object.fromEntries(
      Object.entries(content.notes || {})
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.slice(prefix.length), value]),
    )
    const events = scope === 'role' ? content.calendars?.[role] || [] : content.events || []
    if (data.action === 'save-template') {
      checkVersion(data.version, version)
      try {
        widgets = validateSharedWidgets(data.widgets, scope)
      } catch (error) {
        throw new HttpsError(
          'invalid-argument',
          error instanceof Error ? error.message : 'Invalid template.',
        )
      }
      for (const widget of widgets.filter((w: { type: string }) => w.type === 'form')) {
        if (!['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role))
          throw denied('Employee forms are available only to authorized respondent roles.')
        const [form, issued] = await tx.getAll(
          db.doc('formTemplates/' + widget.form.templateId),
          db.doc('formTemplates/' + widget.form.templateId + '/versions/v' + widget.form.version),
        )
        if (!form.exists || form.data()?.archived || !issued.exists)
          throw new HttpsError('failed-precondition', 'Choose an available issued form version.')
        if (widget.form.presentation === 'inline' && (issued.data()?.fields?.length || 0) > 8)
          throw new HttpsError(
            'invalid-argument',
            'Use a full-page launcher for forms with more than eight fields.',
          )
      }
      tx.set(templateRef, {
        version: version + 1,
        widgets,
        allowRoleEditing: scope === 'role' ? (data.allowRoleEditing ?? allowRoleEditing) : false,
        updatedBy: user.uid,
        updatedAt: Date.now(),
      })
    }
    if (data.action === 'save-notes') {
      checkVersion(data.version, Number(notes?.data()?.version || 0))
      const widget = widgets.find(
        (w: { id: string; type: string }) => w.id === data.widgetId && w.type === 'notes',
      )
      if (!widget || typeof data.text !== 'string' || data.text.length > 8000)
        throw new HttpsError(
          'invalid-argument',
          'Choose a Notes widget and use at most 8,000 characters.',
        )
      const values = { ...content.notes, [prefix + widget.id]: data.text }
      tx.set(notesRef!, {
        ...content,
        version: Number(content.version || 0) + 1,
        notes: values,
        updatedBy: user.uid,
        updatedAt: Date.now(),
      })
      return {
        version: Number(content.version || 0) + 1,
        notes: { ...visibleNotes, [widget.id]: data.text },
        events,
      }
    }
    if (data.action === 'save-calendar') {
      checkVersion(data.version, Number(content.version || 0))
      if (!widgets.some((w: { type: string }) => w.type === 'dates'))
        throw new HttpsError('failed-precondition', 'Add a Calendar widget first.')
      let entries
      try {
        entries = validateSharedCalendar(data.events)
      } catch (error) {
        throw new HttpsError(
          'invalid-argument',
          error instanceof Error ? error.message : 'Invalid calendar date.',
        )
      }
      tx.set(notesRef!, {
        ...content,
        version: Number(content.version || 0) + 1,
        ...(scope === 'role'
          ? { calendars: { ...content.calendars, [role]: entries } }
          : { events: entries }),
        updatedBy: user.uid,
        updatedAt: Date.now(),
      })
      return { version: Number(content.version || 0) + 1, notes: visibleNotes, events: entries }
    }
    return {
      scope,
      role: scope === 'role' ? role : user.role,
      widgets,
      version: version + (data.action === 'save-template' ? 1 : 0),
      canEdit,
      allowRoleEditing: scope === 'role' ? (data.allowRoleEditing ?? allowRoleEditing) : false,
      job: job ? jobData(jobId, job) : null,
      notes: visibleNotes,
      events,
      notesVersion: Number(content.version || 0),
    }
  })
})
