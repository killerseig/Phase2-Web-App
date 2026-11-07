import type { UserRole } from './constants'

export type SharedDashboardScope = 'personal' | 'job' | 'role'
export type SharedDashboardWidgetType =
  | 'announcements'
  | 'announcement-drafts'
  | 'tasks'
  | 'job-info'
  | 'workflows'
  | 'text'
  | 'jobs'
  | 'dates'
  | 'notes'
  | 'documents'
  | 'resources'
  | 'form'
  | 'container'
export interface DashboardPlacement {
  x: number
  y: number
  w: number
  h: number
}
/** Independent published window in authored canvas pixels; never widget geometry. */
export interface DashboardPublishedFrame {
  x: number
  y: number
  width: number
  height: number
}
export interface DashboardViewport {
  mode: 'responsive' | 'fixed' | 'scale'
  width: number
  height: number
  frame: 'auto' | 'custom'
  fit: 'contain' | 'width'
  align: 'start' | 'center' | 'end'
  verticalAlign: 'start' | 'center' | 'end'
  pan: 'overflow' | 'free' | 'locked'
  zoom: number
  start: { x: number; y: number }
  publishedFrame?: DashboardPublishedFrame
  grid: {
    x: number
    y: number
    visible: boolean
    snap: boolean
    linked: boolean
    majorEvery: number
  }
}
export function defaultDashboardViewport(): DashboardViewport {
  return {
    mode: 'responsive',
    width: 1100,
    height: 720,
    frame: 'auto',
    fit: 'contain',
    align: 'center',
    verticalAlign: 'start',
    pan: 'overflow',
    zoom: 1,
    start: { x: 0, y: 0 },
    grid: { x: 1, y: 1, visible: true, snap: true, linked: false, majorEvery: 4 },
  }
}
export function validateDashboardViewport(value: unknown): DashboardViewport {
  const v = value as DashboardViewport
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.keys(v).some(
      (k) =>
        ![
          'mode',
          'width',
          'height',
          'frame',
          'fit',
          'align',
          'verticalAlign',
          'pan',
          'zoom',
          'start',
          'publishedFrame',
          'grid',
        ].includes(k),
    ) ||
    !['responsive', 'fixed', 'scale'].includes(v.mode) ||
    !['auto', 'custom'].includes(v.frame) ||
    !['contain', 'width'].includes(v.fit) ||
    !['start', 'center', 'end'].includes(v.align) ||
    !['start', 'center', 'end'].includes(v.verticalAlign) ||
    !['overflow', 'free', 'locked'].includes(v.pan) ||
    !Number.isFinite(v.width) ||
    v.width < 320 ||
    v.width > 3840 ||
    !Number.isFinite(v.height) ||
    v.height < 240 ||
    v.height > 4000 ||
    !Number.isFinite(v.zoom) ||
    v.zoom < 0.25 ||
    v.zoom > 2 ||
    (v.publishedFrame !== undefined &&
      (!v.publishedFrame ||
        typeof v.publishedFrame !== 'object' ||
        Array.isArray(v.publishedFrame) ||
        Object.keys(v.publishedFrame).length !== 4 ||
        Object.keys(v.publishedFrame).some((k) => !['x', 'y', 'width', 'height'].includes(k)) ||
        ![v.publishedFrame.x, v.publishedFrame.y].every(
          (n) => Number.isFinite(n) && Math.abs(n) <= 10000,
        ) ||
        !Number.isFinite(v.publishedFrame.width) ||
        v.publishedFrame.width < 320 ||
        v.publishedFrame.width > 3840 ||
        !Number.isFinite(v.publishedFrame.height) ||
        v.publishedFrame.height < 240 ||
        v.publishedFrame.height > 4000)) ||
    !v.grid ||
    typeof v.grid !== 'object' ||
    Array.isArray(v.grid) ||
    Object.keys(v.grid).some(
      (k) => !['x', 'y', 'visible', 'snap', 'linked', 'majorEvery'].includes(k),
    ) ||
    ![v.grid.x, v.grid.y].every((n) => Number.isFinite(n) && n >= 0.125 && n <= 8) ||
    typeof v.grid.visible !== 'boolean' ||
    typeof v.grid.snap !== 'boolean' ||
    (v.grid.linked !== undefined && typeof v.grid.linked !== 'boolean') ||
    (v.grid.majorEvery !== undefined &&
      (!Number.isInteger(v.grid.majorEvery) || v.grid.majorEvery < 1 || v.grid.majorEvery > 32)) ||
    (v.start !== undefined &&
      (!v.start ||
        typeof v.start !== 'object' ||
        Array.isArray(v.start) ||
        Object.keys(v.start).length !== 2 ||
        Object.keys(v.start).some((k) => !['x', 'y'].includes(k)) ||
        ![v.start.x, v.start.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 10000)))
  )
    throw Error('Invalid dashboard viewport settings.')
  return {
    ...v,
    ...(v.publishedFrame ? { publishedFrame: { ...v.publishedFrame } } : {}),
    start: v.start ? { ...v.start } : { x: 0, y: 0 },
    grid: {
      ...v.grid,
      y: v.grid.linked ? v.grid.x : v.grid.y,
      linked: v.grid.linked ?? false,
      majorEvery: v.grid.majorEvery ?? 4,
    },
  }
}
function validatePlacement(value: unknown): DashboardPlacement {
  const p = value as DashboardPlacement
  if (
    !p ||
    typeof p !== 'object' ||
    Array.isArray(p) ||
    Object.keys(p).length !== 4 ||
    Object.keys(p).some((key) => !['x', 'y', 'w', 'h'].includes(key)) ||
    ![p.x, p.y, p.w, p.h].every(Number.isFinite) ||
    p.x < 0 ||
    p.y < 0 ||
    p.w < 2 ||
    p.w > 24 ||
    p.h < 3 ||
    p.h > 100 ||
    p.x + p.w > 24.001 ||
    p.y + p.h > 1000
  )
    throw Error('Invalid widget placement.')
  return { x: p.x, y: p.y, w: p.w, h: p.h }
}
export interface SharedDashboardWidget {
  id: string
  type: SharedDashboardWidgetType
  span: 4 | 6 | 8 | 12
  placement?: DashboardPlacement
  devices?: { tablet?: DashboardPlacement; phone?: DashboardPlacement }
  positionLocked?: boolean
  sizeLocked?: boolean
  parentId?: string
  region?: string
  container?: {
    kind: 'panel' | 'tabs' | 'collapsible' | 'split'
    labels: string[]
    direction: 'row' | 'column'
    ratio: number
    collapsed: boolean
  }
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
  announcements: 'Announcements',
  'announcement-drafts': 'Announcement drafts',
  tasks: 'My tasks',
  'job-info': 'Job information',
  workflows: 'Job tools',
  text: 'Text',
  jobs: 'Assigned jobs',
  dates: 'Calendar',
  notes: 'Notes',
  documents: 'Documents',
  resources: 'Role resources',
  form: 'Forms',
  container: 'Container',
}
export function sharedWidgetTypes(scope: SharedDashboardScope): SharedDashboardWidgetType[] {
  return [
    ...(scope === 'personal' ? ['tasks' as const, 'announcement-drafts' as const] : []),
    'workflows',
    'job-info',
    'jobs',
    'text',
    'dates',
    'notes',
    'documents',
    'resources',
    'form',
    'announcements',
    'container',
  ]
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
export function sharedDashboardKey(scope: SharedDashboardScope, role: UserRole, uid?: string) {
  if (scope === 'personal') {
    if (!uid) throw Error('Personal layouts require their authenticated owner.')
    return 'personal-' + uid
  }
  return scope === 'job' ? 'all-jobs' : 'role-' + role
}
export function validateSharedWidgets(
  value: unknown,
  scope: SharedDashboardScope,
): SharedDashboardWidget[] {
  if (!Array.isArray(value) || (scope !== 'personal' && !value.length) || value.length > 12)
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
        (key) =>
          ![
            'id',
            'type',
            'span',
            'title',
            'text',
            'form',
            'textStyle',
            'placement',
            'devices',
            'positionLocked',
            'sizeLocked',
            'parentId',
            'region',
            'container',
          ].includes(key),
      )
    )
      throw Error('Invalid dashboard widget.')
    if (!['notes', 'text', 'form', 'container'].includes(entry.type) && types.has(entry.type))
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
    if (entry.placement !== undefined) widget.placement = validatePlacement(entry.placement)
    if (entry.devices !== undefined) {
      if (
        !entry.devices ||
        typeof entry.devices !== 'object' ||
        Array.isArray(entry.devices) ||
        Object.keys(entry.devices).some((k) => !['tablet', 'phone'].includes(k))
      )
        throw Error('Invalid device placement.')
      widget.devices = {}
      for (const device of ['tablet', 'phone'] as const)
        if (entry.devices[device] !== undefined)
          widget.devices[device] = validatePlacement(entry.devices[device])
    }
    for (const key of ['positionLocked', 'sizeLocked'] as const) {
      if (entry[key] !== undefined) {
        if (typeof entry[key] !== 'boolean') throw Error('Invalid widget lock.')
        widget[key] = entry[key]
      }
    }
    if (entry.parentId !== undefined) {
      if (
        typeof entry.parentId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.parentId) ||
        entry.parentId === entry.id
      )
        throw Error('Invalid widget parent.')
      widget.parentId = entry.parentId
    }
    if (entry.region !== undefined) {
      if (!entry.parentId || typeof entry.region !== 'string' || !/^[0-5]$/.test(entry.region))
        throw Error('Invalid container region.')
      widget.region = entry.region
    }
    if (entry.type === 'container') {
      const c = entry.container
      if (
        !c ||
        typeof c !== 'object' ||
        Array.isArray(c) ||
        Object.keys(c).some(
          (k) => !['kind', 'labels', 'direction', 'ratio', 'collapsed'].includes(k),
        ) ||
        !['panel', 'tabs', 'collapsible', 'split'].includes(c.kind) ||
        !['row', 'column'].includes(c.direction) ||
        !Number.isFinite(c.ratio) ||
        c.ratio < 10 ||
        c.ratio > 90 ||
        typeof c.collapsed !== 'boolean' ||
        !Array.isArray(c.labels) ||
        c.labels.length < 1 ||
        c.labels.length > 6 ||
        c.labels.some((v: unknown) => typeof v !== 'string' || !v.trim() || v.length > 60) ||
        new Set(c.labels.map((v: string) => v.trim())).size !== c.labels.length
      )
        throw Error('Invalid container settings.')
      widget.container = {
        kind: c.kind,
        labels: c.labels.map((v: string) => v.trim()),
        direction: c.direction,
        ratio: c.ratio,
        collapsed: c.collapsed,
      }
    } else if (entry.container !== undefined) {
      throw Error('Only containers can have container settings.')
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
  const byId = new Map(widgets.map((w) => [w.id, w]))
  for (const widget of widgets) {
    let current = widget,
      depth = 0
    const visited = new Set([widget.id])
    while (current.parentId) {
      const parent = byId.get(current.parentId)
      if (!parent?.container || visited.has(parent.id) || ++depth > 4)
        throw Error('Invalid container hierarchy.')
      const regions =
        parent.container.kind === 'split'
          ? 2
          : parent.container.kind === 'tabs'
            ? parent.container.labels.length
            : 1
      if (Number(current.region || '0') >= regions) throw Error('Invalid container region.')
      visited.add(parent.id)
      current = parent
    }
  }
  const required = scope === 'job' ? 'workflows' : 'jobs'
  if (scope !== 'personal' && !types.has(required))
    throw Error(
      scope === 'job'
        ? 'Keep Job tools available for every job.'
        : 'Keep My jobs available on each role home.',
    )
  return widgets
}
// Read compatibility only: original records are never overwritten by conversion.
export function upgradeDashboardWidgets(
  value: unknown,
  scope: 'personal' | 'role',
): SharedDashboardWidget[] {
  if (!Array.isArray(value))
    throw Error('The previous layout is invalid; its original record is preserved.')
  const widgets = value.map((entry) => ({
    id: entry.id,
    type: entry.type === 'shortcuts' ? 'jobs' : entry.type,
    span: entry.span,
    title: entry.title,
    text: entry.text,
    ...(entry.form ? { form: entry.form } : {}),
  }))
  if (scope === 'role' && !widgets.some((widget) => widget.type === 'jobs'))
    widgets.push({ id: 'shared-jobs', type: 'jobs', span: 12, title: 'Assigned jobs', text: '' })
  return validateSharedWidgets(widgets, scope)
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

export interface PersonalTask {
  id: string
  title: string
  done: boolean
}
export function validatePersonalTasks(value: unknown): PersonalTask[] {
  if (!Array.isArray(value) || value.length > 100) throw Error('Use at most 100 personal tasks.')
  const ids = new Set<string>()
  return value.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
      ids.has(entry.id) ||
      typeof entry.title !== 'string' ||
      !entry.title.trim() ||
      entry.title.trim().length > 200 ||
      typeof entry.done !== 'boolean' ||
      Object.keys(entry).some((key) => !['id', 'title', 'done'].includes(key))
    )
      throw Error('Use a task title and a valid completion state.')
    ids.add(entry.id)
    return { id: entry.id, title: entry.title.trim(), done: entry.done }
  })
}

export interface AnnouncementDraft {
  id: string
  title: string
  body: string
  audience?: 'everyone' | 'job' | 'people'
  jobId?: string
  recipientIds?: string[]
}
export interface PublishedAnnouncement {
  id: string
  title: string
  body: string
  audience: 'everyone' | 'job' | 'people'
  jobId?: string
  publishedAt: number
}
export function validateAnnouncementDrafts(value: unknown): AnnouncementDraft[] {
  if (!Array.isArray(value) || value.length > 25) throw Error('Use at most 25 announcement drafts.')
  const ids = new Set<string>()
  return value.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
      ids.has(entry.id) ||
      typeof entry.title !== 'string' ||
      !entry.title.trim() ||
      entry.title.trim().length > 200 ||
      typeof entry.body !== 'string' ||
      !entry.body.trim() ||
      entry.body.length > 8000 ||
      Object.keys(entry).some(
        (key) => !['id', 'title', 'body', 'audience', 'jobId', 'recipientIds'].includes(key),
      )
    )
      throw Error('Use a title and message for each announcement draft.')
    if (
      (entry.audience !== undefined && !['everyone', 'job', 'people'].includes(entry.audience)) ||
      (entry.audience === 'job'
        ? typeof entry.jobId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(entry.jobId)
        : entry.jobId !== undefined)
    )
      throw Error('Choose Everyone, an assigned job or specific people.')
    if (
      entry.audience === 'people'
        ? !Array.isArray(entry.recipientIds) ||
          !entry.recipientIds.length ||
          entry.recipientIds.length > 25 ||
          entry.recipientIds.some((id: unknown) => !validAnnouncementRecipientId(id)) ||
          new Set(entry.recipientIds).size !== entry.recipientIds.length
        : entry.recipientIds !== undefined
    )
      throw Error('Choose between one and 25 distinct people.')
    ids.add(entry.id)
    return {
      id: entry.id,
      title: entry.title.trim(),
      body: entry.body.trim(),
      ...(entry.audience ? { audience: entry.audience } : {}),
      ...(entry.audience === 'job' ? { jobId: entry.jobId } : {}),
      ...(entry.audience === 'people' ? { recipientIds: [...entry.recipientIds] } : {}),
    }
  })
}

export function validAnnouncementRecipientId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    // oxlint-disable-next-line no-control-regex -- Reject control characters in document identifiers.
    /^[^\u0000-\u001f/]{1,128}$/.test(value) &&
    value !== '.' &&
    value !== '..'
  )
}
