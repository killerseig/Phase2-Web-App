import type { UserRole } from './constants'

export type SharedDashboardScope = 'job' | 'role'
export type SharedDashboardWidgetType =
  | 'workflows'
  | 'text'
  | 'jobs'
  | 'dates'
  | 'notes'
  | 'documents'
  | 'resources'
  | 'form'
export interface SharedDashboardWidget {
  id: string
  type: SharedDashboardWidgetType
  span: 4 | 6 | 8 | 12
  title: string
  text: string
  textStyle?: {
    size: number
    color: string
    weight: number
    align: 'left' | 'center' | 'right'
    lineHeight: number
  }
  form?: { templateId: string; version: number; presentation: 'inline' | 'launcher' }
}
export const sharedWidgetLabels: Record<SharedDashboardWidgetType, string> = {
  workflows: 'Job tools',
  text: 'Text',
  jobs: 'Assigned jobs',
  dates: 'Calendar',
  notes: 'Notes',
  documents: 'Documents',
  resources: 'Role resources',
  form: 'Forms',
}
export function sharedWidgetTypes(scope: SharedDashboardScope): SharedDashboardWidgetType[] {
  void scope
  return ['workflows', 'jobs', 'text', 'dates', 'notes', 'documents', 'resources', 'form']
}
export function defaultSharedWidgets(scope: SharedDashboardScope): SharedDashboardWidget[] {
  const types: SharedDashboardWidgetType[] =
    scope === 'job' ? ['text', 'workflows', 'dates', 'notes'] : ['text', 'jobs', 'dates', 'notes']
  return types.map((type, i) => ({
    id: type,
    type,
    span: i < 2 ? 12 : 6,
    title:
      type === 'text' ? (scope === 'job' ? 'Current job' : 'Welcome') : sharedWidgetLabels[type],
    text:
      type === 'text'
        ? scope === 'job'
          ? '{{ job.code }} · {{ job.name }}'
          : '{{ user.name }}\n{{ user.role }}'
        : '',
  }))
}
export function sharedDashboardKey(scope: SharedDashboardScope, role: UserRole) {
  return scope === 'job' ? 'all-jobs' : 'role-' + role
}
export function validateSharedWidgets(
  value: unknown,
  scope: SharedDashboardScope,
): SharedDashboardWidget[] {
  if (!Array.isArray(value) || !value.length || value.length > 12)
    throw Error('Use between one and twelve widgets.')
  const ids = new Set<string>(),
    types = new Set<string>()
  const widgets = value.map((entry): SharedDashboardWidget => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
      ids.has(entry.id) ||
      !sharedWidgetTypes(scope).includes(entry.type) ||
      ![4, 6, 8, 12].includes(entry.span) ||
      typeof entry.title !== 'string' ||
      entry.title.trim().length > 100 ||
      typeof entry.text !== 'string' ||
      entry.text.length > 8000 ||
      Object.keys(entry).some(
        (key) => !['id', 'type', 'span', 'title', 'text', 'form', 'textStyle'].includes(key),
      )
    )
      throw Error('Invalid dashboard widget.')
    if (!['notes', 'text', 'form'].includes(entry.type) && types.has(entry.type))
      throw Error('Add each tool only once.')
    ids.add(entry.id)
    types.add(entry.type)
    const widget: SharedDashboardWidget = {
      id: entry.id,
      type: entry.type,
      span: entry.span,
      title: entry.title.trim(),
      text: entry.text,
    }
    if (entry.textStyle !== undefined) {
      const style = entry.textStyle
      if (
        entry.type !== 'text' ||
        !style ||
        typeof style !== 'object' ||
        Object.keys(style).some(
          (key) => !['size', 'color', 'weight', 'align', 'lineHeight'].includes(key),
        ) ||
        !Number.isFinite(style.size) ||
        style.size < 12 ||
        style.size > 96 ||
        typeof style.color !== 'string' ||
        !/^#[a-f0-9]{6}$/i.test(style.color) ||
        ![400, 500, 600, 700].includes(style.weight) ||
        !['left', 'center', 'right'].includes(style.align) ||
        !Number.isFinite(style.lineHeight) ||
        style.lineHeight < 1 ||
        style.lineHeight > 2.5
      )
        throw Error('Invalid text styling.')
      widget.textStyle = {
        size: style.size,
        color: style.color,
        weight: style.weight,
        align: style.align,
        lineHeight: style.lineHeight,
      }
    }
    if (entry.type === 'form') {
      const form = entry.form
      if (
        !form ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(form.templateId) ||
        !Number.isSafeInteger(form.version) ||
        form.version < 1 ||
        !['inline', 'launcher'].includes(form.presentation) ||
        Object.keys(form).some((key) => !['templateId', 'version', 'presentation'].includes(key))
      )
        throw Error('Choose an issued employee form.')
      widget.form = {
        templateId: form.templateId,
        version: form.version,
        presentation: form.presentation,
      }
    } else if (entry.form !== undefined)
      throw Error('Only employee-form widgets can select a form.')
    return widget
  })
  const required = scope === 'job' ? 'workflows' : 'jobs'
  if (!types.has(required))
    throw Error(
      scope === 'job'
        ? 'Keep Job tools available for every job.'
        : 'Keep My jobs available on each role home.',
    )
  return widgets
}
export interface SharedCalendarEntry {
  id: string
  title: string
  date: string
}
export function validateSharedCalendar(value: unknown): SharedCalendarEntry[] {
  if (!Array.isArray(value) || value.length > 100) throw Error('Use at most 100 calendar dates.')
  const ids = new Set<string>()
  return value
    .map((entry) => {
      if (
        !entry ||
        typeof entry.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
        ids.has(entry.id) ||
        typeof entry.title !== 'string' ||
        !entry.title.trim() ||
        entry.title.trim().length > 200 ||
        typeof entry.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
        Object.keys(entry).some((key) => !['id', 'title', 'date'].includes(key))
      )
        throw Error('Use a title and valid calendar date.')
      const parsed = new Date(entry.date + 'T00:00:00Z')
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== entry.date)
        throw Error('Use a valid calendar date.')
      ids.add(entry.id)
      return { id: entry.id, title: entry.title.trim(), date: entry.date }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
