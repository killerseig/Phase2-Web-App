<script setup lang="ts">
import { jobsManagementRoute } from '@/features/jobs/jobsRouteIntent'
import { canEditJobSetup } from '@/auth/capabilities'
import AppLoadingRegion from '@/components/common/AppLoadingRegion.vue'

import AppButton from '@/components/common/AppButton.vue'
import AppButtonLink from '@/components/common/AppButtonLink.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import BuilderPanelResize from '@/components/builder/BuilderPanelResize.vue'
import BuilderPanelSwitcher from '@/components/builder/BuilderPanelSwitcher.vue'
import { canSubmitForm } from '../../functions/src/formAccess'
import SharedDashboardCanvas from '@/components/dashboard/SharedDashboardCanvas.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { sharedDashboardCommand } from '@/services/sharedDashboards'
import { dashboardError } from '@/services/dashboard'
import { formApi, type ServerFormTemplate } from '@/services/forms'
import { CURRENT_EDITABLE_USER_ROLE_KEYS, CURRENT_ROLE_LABELS } from '@/auth/roles'
import { getRoleDashboardJobShortcuts } from '@/features/dashboard/roleDashboardJobShortcuts'
import {
  sharedWidgetLabels,
  sharedWidgetTypes,
  newSharedWidget,
  defaultDashboardViewport,
  type DashboardViewport,
  type SharedDashboardWidget,
  type SharedDashboardLayout,
  type SharedDashboardScope,
} from '@/features/dashboard/sharedDashboards'
import { placeWidget, fallbackPlacements } from '@/features/dashboard/widgetPlacement'
import {
  validateSharedWidgets,
  validateDashboardViewport,
} from '../../functions/src/sharedDashboardModel'
import {
  resizeEdges,
  translate,
  arrange,
  bounds,
  descendants,
  rootSelection,
  locked as geometryLocked,
  copyConfiguration,
  type Direction,
  type Arrangement,
} from '@/features/dashboard/editorGeometry'
import { useWidgetDrag, type WidgetDrop } from '@/features/dashboard/useWidgetDrag'
import { startCamera, panCamera, alignmentOffset } from '@/features/dashboard/viewportGeometry'
import type { RawRoleKey } from '@/types/domain'
import { dashboardTextVariables, resolveDashboardText } from '@/features/dashboard/sharedText'
import type { SharedCalendarEntry } from '@/features/dashboard/sharedDashboards'
import '@/styles/shared-dashboards.css'
const auth = useAuthStore(),
  jobsStore = useJobsStore(),
  route = useRoute(),
  router = useRouter()
const scope = computed<SharedDashboardScope>(() =>
  route.name === 'personal-workspace'
    ? 'personal'
    : route.name === 'shared-job-home'
      ? 'job'
      : 'role',
)
const jobId = computed(() => (typeof route.params.jobId === 'string' ? route.params.jobId : ''))
const role = ref<RawRoleKey>(auth.rawRole),
  layout = ref<SharedDashboardLayout>(),
  widgets = ref<SharedDashboardWidget[]>([])
const loading = ref(true),
  busy = ref(false),
  editing = ref(false),
  error = ref(''),
  message = ref(''),
  selected = ref(''),
  allowRoleEditing = ref(false)
const saved = ref(''),
  paletteWidth = ref(240),
  inspectorWidth = ref(300),
  device = ref<'desktop' | 'tablet' | 'phone'>('desktop'),
  fit = ref(true),
  zoom = ref(1)
const viewportSettings = ref<DashboardViewport>(defaultDashboardViewport())
const selection = ref<string[]>([])
const selectedIds = computed(() =>
  selection.value.includes(selected.value)
    ? selection.value.filter((id) => widgets.value.some((w) => w.id === id))
    : selected.value
      ? [selected.value]
      : [],
)
const selectedRoots = computed(() => rootSelection(widgets.value, selectedIds.value))
const clipboard = ref<SharedDashboardWidget[]>([])
watch([() => auth.currentUser?.uid, () => auth.rawRole, () => auth.hasWorkspaceAccess], () => {
  clipboard.value = []
  selection.value = []
})
const root = ref<HTMLElement>(),
  viewport = ref<HTMLElement>(),
  content = ref<HTMLElement>(),
  viewportWidth = ref(1100),
  viewportHeight = ref(720),
  contentHeight = ref(700)
const confirm = ref<InstanceType<typeof BuilderConfirmDialog>>(),
  canvas = ref<InstanceType<typeof SharedDashboardCanvas>>()
const loadingRegion = ref<InstanceType<typeof AppLoadingRegion>>()
const contentLoading = computed(() => loading.value || loadingRegion.value?.covered === true)
const forms = ref<ServerFormTemplate[]>([]),
  formsError = ref(''),
  formsLoading = ref(false)
let formsGeneration = 0
const activePane = ref<'outline' | 'preview' | 'inspector'>('preview')
const isAdmin = computed(() => auth.rawRole === 'admin'),
  canEdit = computed(() => auth.hasWorkspaceAccess && !!layout.value?.canEdit)
const snapshot = () =>
  JSON.stringify({
    widgets: widgets.value,
    allowRoleEditing: allowRoleEditing.value,
    viewport: viewportSettings.value,
  })
const dirty = computed(() => !!saved.value && snapshot() !== saved.value)
const requiredType = computed(() =>
  scope.value === 'personal' ? undefined : scope.value === 'job' ? 'workflows' : 'jobs',
)
const selectedWidget = computed(() => widgets.value.find((widget) => widget.id === selected.value))
const assigned = computed(() => [
  ...auth.assignedJobIds,
  ...jobsStore.jobs
    .filter((job) => job.assignedForemanIds?.includes(auth.currentUser?.uid || ''))
    .map((job) => job.id),
])
const visibleJobs = computed(() => {
  const byId = new Map(jobsStore.jobs.map((job) => [job.id, job]))
  return getRoleDashboardJobShortcuts({
    rawRole: auth.rawRole,
    assignedJobIds: assigned.value,
    jobs: jobsStore.jobs,
  }).map((shortcut) => byId.get(shortcut.id)!)
})
const editableJobIds = computed(() =>
  visibleJobs.value
    .filter((job) =>
      canEditJobSetup({
        rawRole: auth.rawRole,
        assignedJobIds: assigned.value,
        jobId: job.id,
      }),
    )
    .map((job) => job.id),
)
const palette = computed(() =>
  sharedWidgetTypes(scope.value).filter(
    (type) =>
      (type !== 'announcement-drafts' || isAdmin.value) &&
      (type !== 'form' ||
        (['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(auth.rawRole) &&
          ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role.value))),
  ),
)
const widgetSearch = ref('')
const widgetDescriptions: Record<SharedDashboardWidget['type'], string> = {
  announcements: 'Read updates for everyone and your assigned jobs.',
  'announcement-drafts': 'Prepare and publish updates. Admin only.',
  tasks: 'Keep a private personal task list.',
  workflows: 'Open the tools for a job.',
  'job-info': 'View a job address, contractor and project dates.',
  jobs: 'Find the jobs you can access.',
  form: 'Launch or fill an issued employee form.',
  documents: 'Browse authorized folders and documents.',
  resources: 'Open resources available to your role.',
  text: 'Add text and contextual variables.',
  notes: 'Keep notes separate for each dashboard scope.',
  dates: 'Show job dates and calendar entries.',
  container: 'Group widgets in a panel, tabs, collapsible section or split view.',
}
const paletteGroups = computed(() =>
  [
    { title: 'Work tools', types: ['workflows', 'job-info', 'jobs', 'form'] },
    { title: 'Files & resources', types: ['documents', 'resources'] },
    {
      title: 'Content & planning',
      types: [
        'text',
        'notes',
        'dates',
        'tasks',
        'announcement-drafts',
        'announcements',
        'container',
      ],
    },
  ]
    .map((group) => ({
      ...group,
      types: group.types.filter(
        (type): type is SharedDashboardWidget['type'] =>
          palette.value.includes(type as SharedDashboardWidget['type']) &&
          `${sharedWidgetLabels[type as SharedDashboardWidget['type']]} ${widgetDescriptions[type as SharedDashboardWidget['type']]}`
            .toLowerCase()
            .includes(widgetSearch.value.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.types.length),
)
const editorAnnouncement = ref('')
function announcePosition(widget: SharedDashboardWidget, action: string) {
  editorAnnouncement.value =
    action +
    ' ' +
    (widget.title || sharedWidgetLabels[widget.type]) +
    '. Position ' +
    (widgets.value.findIndex((entry) => entry.id === widget.id) + 1) +
    ' of ' +
    widgets.value.length +
    '.'
}
const selectedIndex = computed(() =>
  widgets.value.findIndex((widget) => widget.id === selected.value),
)
const repeatable = (type: SharedDashboardWidget['type']) =>
  ['notes', 'text', 'form', 'container'].includes(type)
function selectWidget(id: string, event?: MouseEvent | PointerEvent) {
  if (event && (event.shiftKey || event.ctrlKey || event.metaKey)) {
    const current = selectedIds.value
    selection.value = current.includes(id) ? current.filter((key) => key !== id) : [...current, id]
    selected.value = selection.value.at(-1) || ''
  } else {
    selected.value = id
    selection.value = id ? [id] : []
  }
}
const settingsHeading = ref<HTMLElement>()
function focusSettings() {
  void nextTick(() => settingsHeading.value?.focus())
}
function editWidget(id: string) {
  if (!editing.value || busy.value || !canEdit.value) return
  selectWidget(id)
  activePane.value = 'inspector'
  focusSettings()
}
async function revealWidget(id: string) {
  selectWidget(id)
  activePane.value = 'preview'
  editorCamera.value = { x: 0, y: 0 }
  await nextTick()
  const element = [...(root.value?.querySelectorAll<HTMLElement>('[data-widget-id]') || [])].find(
    (el) => el.dataset.widgetId === id,
  )
  element?.scrollIntoView({ block: 'center', inline: 'nearest' })
  element?.focus({ preventScroll: true })
}
function parentRegions(id: string) {
  const c = widgets.value.find((w) => w.id === id)?.container
  return c?.kind === 'tabs'
    ? c.labels
    : c?.kind === 'split'
      ? ['First region', 'Second region']
      : ['Content']
}
function resetDevicePlacement() {
  if (device.value === 'desktop' || !selectedWidget.value || busy.value || !canEdit.value) return
  if (
    geometryLocked(widgets.value, selectedWidget.value, 'positionLocked') ||
    geometryLocked(widgets.value, selectedWidget.value, 'sizeLocked')
  )
    return
  const current = device.value
  widgets.value = widgets.value.map((w) => {
    if (w.id !== selected.value) return w
    const devices = { ...w.devices }
    delete devices[current]
    return { ...w, devices }
  })
}
function navigateWidgets(event: KeyboardEvent) {
  if (busy.value) return
  if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault()
    move(event.key === 'ArrowUp' ? -1 : 1, true)
    return
  }
  const rows = [
    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
  ]
  const from = rows.indexOf(event.target as HTMLButtonElement)
  if (from < 0) return
  const next =
    event.key === 'ArrowDown'
      ? Math.min(from + 1, rows.length - 1)
      : event.key === 'ArrowUp'
        ? Math.max(0, from - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? rows.length - 1
            : -1
  if (next < 0) return
  event.preventDefault()
  selected.value = widgets.value[next]!.id
  rows[next]?.focus()
}
const textContext = computed(() => ({
  job: layout.value?.job ? { ...layout.value.job } : null,
  user: { name: auth.displayName, role: CURRENT_ROLE_LABELS[auth.rawRole] },
}))
const textInput = ref<HTMLTextAreaElement>()
const textResult = computed(() =>
  resolveDashboardText(selectedWidget.value?.text || '', textContext.value),
)
function insertVariable(key: string) {
  const widget = selectedWidget.value
  if (widget?.type !== 'text') return
  const input = textInput.value,
    start = input?.selectionStart ?? widget.text.length,
    end = input?.selectionEnd ?? start,
    token = '{{ ' + key + ' }}'
  widget.text = widget.text.slice(0, start) + token + widget.text.slice(end)
  void nextTick(() => {
    input?.focus()
    input?.setSelectionRange(start + token.length, start + token.length)
  })
}
function defaultTextColor() {
  const color = root.value ? getComputedStyle(root.value).getPropertyValue('--text').trim() : ''
  return /^#[\da-f]{6}$/i.test(color) ? color : '#e5e5e5'
}
function setTextStyle(key: string, value: string | number) {
  const widget = selectedWidget.value
  if (widget?.type !== 'text') return
  widget.textStyle = {
    size: 24,
    color: defaultTextColor(),
    weight: 400,
    align: 'left',
    lineHeight: 1.5,
    ...widget.textStyle,
    [key]: value,
  }
}
const pageTitle = computed(() =>
  scope.value === 'personal'
    ? 'Personal dashboard'
    : scope.value === 'role'
      ? `${CURRENT_ROLE_LABELS[role.value]} home`
      : 'Job home',
)
const previewWidth = computed(() =>
  device.value === 'phone'
    ? 390
    : device.value === 'tablet'
      ? 820
      : Number.isFinite(viewportSettings.value.width) && viewportSettings.value.width >= 320
        ? viewportSettings.value.width
        : 1100,
)
const previewScale = computed(() =>
  fit.value
    ? Math.min(1, Math.max(0.15, (viewportWidth.value - 24) / previewWidth.value))
    : zoom.value,
)
let generation = 0,
  observer: ResizeObserver | undefined,
  restoring = false
const undo = ref<string[]>([]),
  redo = ref<string[]>([])
watch(
  snapshot,
  (value, previous) => {
    if (!editing.value || restoring) return
    undo.value.push(previous)
    if (undo.value.length > 100) undo.value.shift()
    redo.value = []
  },
  { flush: 'sync' },
)
function restore(value: string) {
  restoring = true
  try {
    const state = JSON.parse(value)
    widgets.value = state.widgets
    allowRoleEditing.value = state.allowRoleEditing
    // History includes in-progress number fields. Validate when saving, not when
    // restoring a draft (a temporarily empty input must remain undoable).
    viewportSettings.value = state.viewport || defaultDashboardViewport()
  } finally {
    restoring = false
  }
  selected.value = widgets.value.some((w) => w.id === selected.value)
    ? selected.value
    : widgets.value[0]?.id || ''
}
function undoChange() {
  const value = undo.value.pop()
  if (value) {
    redo.value.push(snapshot())
    restore(value)
  }
}
function redoChange() {
  const value = redo.value.pop()
  if (value) {
    undo.value.push(snapshot())
    restore(value)
  }
}
type Payload =
  | { kind: 'new'; type: SharedDashboardWidget['type'] }
  | { kind: 'move' | 'resize'; id: string; direction?: Direction }
let dragOrigins: ReturnType<typeof measuredPlacements> = [],
  dragIds: string[] = [],
  dragParent = '',
  dragRegion = '0'
function startTransform(
  event: PointerEvent,
  id: string,
  kind: 'move' | 'resize',
  direction: Direction = 'se',
) {
  const widget = widgets.value.find((w) => w.id === id)
  if (
    !widget ||
    geometryLocked(widgets.value, widget, kind === 'move' ? 'positionLocked' : 'sizeLocked')
  )
    return
  if (
    kind === 'resize' &&
    geometryLocked(widgets.value, widget, 'positionLocked') &&
    /[nw]/.test(direction)
  )
    return
  if (!selectedIds.value.includes(id)) selectWidget(id)
  dragParent = widget.parentId || ''
  dragRegion = widget.region || '0'
  dragOrigins = measuredPlacements()
  dragIds = selectedRoots.value
    .filter(
      (w) =>
        (w.parentId || '') === dragParent &&
        (w.region || '0') === dragRegion &&
        !geometryLocked(widgets.value, w, kind === 'move' ? 'positionLocked' : 'sizeLocked'),
    )
    .map((w) => w.id)
  drag.start(
    event,
    { kind, id, direction },
    kind === 'move' ? 'Move selection' : 'Resize selection',
  )
}
const drag = useWidgetDrag<Payload>({
  root,
  freePosition: true,
  lockToOriginSurface: true,
  disabled: () => !editing.value || busy.value || !canEdit.value,
  drop,
})
const { dragging, point, label, target: dropTarget } = drag
function canAdd(type: SharedDashboardWidget['type']) {
  return (
    widgets.value.length < 12 && (repeatable(type) || !widgets.value.some((w) => w.type === type))
  )
}
const snapToGrid = computed({
  get: () => viewportSettings.value.grid.snap,
  set: (value) => {
    viewportSettings.value.grid.snap = value
  },
})
const gridVisible = computed({
  get: () => viewportSettings.value.grid.visible,
  set: (value) => {
    viewportSettings.value.grid.visible = value
  },
})
const gridPreset = computed(() => {
  const g = viewportSettings.value.grid
  return g.x === g.y && [0.25, 1, 2].includes(g.x) ? String(g.x) : 'custom'
})
const interactionGrid = computed(() => ({
  ...viewportSettings.value.grid,
  x:
    Number.isFinite(viewportSettings.value.grid.x) && viewportSettings.value.grid.x >= 0.125
      ? viewportSettings.value.grid.x
      : 1,
  y:
    Number.isFinite(viewportSettings.value.grid.y) && viewportSettings.value.grid.y >= 0.125
      ? viewportSettings.value.grid.y
      : 1,
}))
function setGridPreset(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (value) viewportSettings.value.grid = { ...viewportSettings.value.grid, x: value, y: value }
}
function setGridSpacing(axis: 'x' | 'y', event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (!Number.isFinite(value) || value < 0.125 || value > 8) return
  const grid = viewportSettings.value.grid
  viewportSettings.value.grid = {
    ...grid,
    [axis]: value,
    ...(grid.linked ? { x: value, y: value } : {}),
  }
}
const gridLinked = computed({
  get: () => viewportSettings.value.grid.linked,
  set: (value: boolean) => {
    const grid = viewportSettings.value.grid
    viewportSettings.value.grid = { ...grid, linked: value, y: value ? grid.x : grid.y }
  },
})
function surfaceFor(parent = '', region = '0') {
  return [...(root.value?.querySelectorAll<HTMLElement>('[data-widget-surface]') || [])].find(
    (el) =>
      el.dataset.widgetSurface === (parent || 'shared-dashboard') &&
      (el.dataset.region || '0') === region,
  )
}
function readPlacement(widget: SharedDashboardWidget) {
  return device.value === 'desktop'
    ? widget.placement
    : widget.devices?.[device.value] || widget.placement
}
function withPlacement(
  widget: SharedDashboardWidget,
  placement: NonNullable<SharedDashboardWidget['placement']>,
) {
  return device.value === 'desktop'
    ? { ...widget, placement }
    : { ...widget, devices: { ...widget.devices, [device.value]: placement } }
}
function transformPreview(payload: Payload, destination: WidgetDrop) {
  const result: Record<string, NonNullable<SharedDashboardWidget['placement']>> = {}
  if (!destination.position) return result
  const parent =
    payload.kind === 'new'
      ? destination.surface === 'shared-dashboard'
        ? ''
        : destination.surface
      : dragParent
  const surface = surfaceFor(parent, payload.kind === 'new' ? destination.region : dragRegion)
  if (
    !surface ||
    destination.surface !== (parent || 'shared-dashboard') ||
    (payload.kind !== 'new' && (destination.region || '0') !== dragRegion)
  )
    return result
  const x = (destination.position.x / surface.offsetWidth) * 24,
    y = destination.position.y / 32
  const grid = interactionGrid.value
  if (payload.kind === 'new') {
    result.new = translate([{ x: 0, y: 0, w: 12, h: 10 }], x - 6, y - 5, grid)[0]!
    return result
  }
  const primary = dragOrigins[widgets.value.findIndex((w) => w.id === payload.id)]
  if (!primary) return result
  const ids = dragIds.filter((id) => widgets.value.some((w) => w.id === id))
  const original = ids.map((id) => dragOrigins[widgets.value.findIndex((w) => w.id === id)]!)
  if (!original.length) return result
  if (payload.kind === 'move') {
    translate(original, x - primary.x, y - primary.y, grid).forEach((p, i) => {
      result[ids[i]!] = p
    })
  } else if (original.length === 1)
    result[ids[0]!] = resizeEdges(
      primary,
      x - primary.x,
      y - primary.y,
      payload.direction || 'se',
      grid,
      !!widgets.value.find((w) => w.id === payload.id)?.positionLocked,
    )
  else {
    const box = bounds(original),
      changed = resizeEdges(
        box,
        x - primary.x,
        y - primary.y,
        payload.direction || 'se',
        grid,
        false,
        1000,
      )
    original.forEach((p, i) => {
      const widget = widgets.value.find((w) => w.id === ids[i])!
      if (geometryLocked(widgets.value, widget, 'positionLocked')) return
      result[widget.id] = placeWidget(
        changed.x + ((p.x - box.x) * changed.w) / box.w,
        changed.y + ((p.y - box.y) * changed.h) / box.h,
        (p.w * changed.w) / box.w,
        (p.h * changed.h) / box.h,
        false,
      )
    })
  }
  return result
}
const placementPreviews = computed(() =>
  dragging.value && drag.payload.value && dropTarget.value
    ? transformPreview(drag.payload.value, dropTarget.value)
    : {},
)
const placementPreview = computed(
  () =>
    placementPreviews.value.new ||
    (drag.payload.value?.kind !== 'new' && drag.payload.value
      ? placementPreviews.value[drag.payload.value.id]
      : undefined),
)
function measuredPlacements() {
  const fallback = fallbackPlacements(widgets.value)
  return widgets.value.map((widget, index) => {
    const placement = readPlacement(widget)
    if (placement) return { ...placement }
    const surface = surfaceFor(widget.parentId, widget.region)
    const bounds = surface?.getBoundingClientRect()
    const scale = surface && bounds ? bounds.width / surface.offsetWidth : 1
    const element =
      surface &&
      [...surface.querySelectorAll<HTMLElement>('[data-widget-id]')].find(
        (el) => el.dataset.widgetId === widget.id,
      )
    const rect = element?.getBoundingClientRect()
    return rect && bounds
      ? placeWidget(
          ((rect.left - bounds.left) / bounds.width) * 24,
          (rect.top - bounds.top) / scale / 32,
          (rect.width / bounds.width) * 24,
          Math.ceil(rect.height / scale / 32),
          false,
        )
      : fallback[index]!
  })
}
function updatePlacement(key: 'x' | 'y' | 'w' | 'h', event: Event, requested?: number) {
  const value = requested ?? (event.target as HTMLInputElement).valueAsNumber
  if (!Number.isFinite(value) || !selectedWidget.value || busy.value || !canEdit.value) return
  if (
    geometryLocked(
      widgets.value,
      selectedWidget.value,
      key === 'x' || key === 'y' ? 'positionLocked' : 'sizeLocked',
    )
  )
    return
  const positions = measuredPlacements()
  widgets.value = widgets.value.map((widget, index) => {
    const p = { ...positions[index]! }
    if (widget.id === selected.value) p[key] = value
    if (geometryLocked(widgets.value, widget, 'positionLocked')) {
      p.w = Math.min(p.w, 24 - p.x)
      p.h = Math.min(p.h, 1000 - p.y)
    }
    return device.value === 'desktop' || widget.id === selected.value
      ? withPlacement(widget, placeWidget(p.x, p.y, p.w, p.h, false))
      : widget
  })
}
function drop(payload: Payload, destination: WidgetDrop) {
  if (!editing.value || busy.value || !canEdit.value) return
  if (destination.position) {
    const changes = transformPreview(payload, destination)
    if (!Object.keys(changes).length) return
    const positions = payload.kind === 'new' ? measuredPlacements() : dragOrigins
    const next = widgets.value.map((widget, index) =>
      device.value === 'desktop' || changes[widget.id]
        ? withPlacement(widget, changes[widget.id] || positions[index]!)
        : widget,
    )
    let widget = payload.kind !== 'new' ? next.find((w) => w.id === payload.id) : undefined
    if (payload.kind === 'new') {
      if (!canAdd(payload.type)) return
      widget = { ...newSharedWidget(payload.type), placement: changes.new! }
      if (destination.surface !== 'shared-dashboard') {
        widget.parentId = destination.surface
        widget.region = destination.region || '0'
      }
      next.push(widget)
    }
    if (!widget) return
    widgets.value = next
    selected.value = widget.id
    announcePosition(
      widget,
      payload.kind === 'new' ? 'Added' : payload.kind === 'resize' ? 'Resized' : 'Moved',
    )
    if (payload.kind === 'new') {
      activePane.value = 'inspector'
      focusSettings()
    }
    return
  }
  const at =
    destination.beforeId === null
      ? widgets.value.length
      : widgets.value.findIndex((w) => w.id === destination.beforeId)
  if (at < 0) return
  if (payload.kind === 'new') {
    if (!canAdd(payload.type)) return
    const widget = newSharedWidget(payload.type)
    widget.title = sharedWidgetLabels[payload.type]
    if (widgets.value.some((w) => w.placement)) {
      const bottom = Math.max(0, ...measuredPlacements().map((p) => p.y + p.h))
      widget.placement = placeWidget(0, bottom + 1, widget.span * 2, 10)
    }
    widgets.value.splice(at, 0, widget)
    selected.value = widget.id
    announcePosition(widget, 'Added')
    activePane.value = 'inspector'
    focusSettings()
  } else {
    const from = widgets.value.findIndex((w) => w.id === payload.id)
    if (from < 0 || from === at) return
    const reordered = [...widgets.value]
    const [w] = reordered.splice(from, 1)
    reordered.splice(at > from ? at - 1 : at, 0, w!)
    widgets.value = reordered
    selected.value = w!.id
    announcePosition(w!, 'Moved')
  }
}
function add(type: SharedDashboardWidget['type']) {
  drop(
    { kind: 'new', type },
    { beforeId: null, overId: null, edge: 'after', surface: 'shared-dashboard' },
  )
}
function move(direction: number, focusList = false) {
  if (!editing.value || busy.value || !canEdit.value) return
  const from = widgets.value.findIndex((w) => w.id === selected.value),
    to = from + direction
  if (from < 0 || to < 0 || to >= widgets.value.length) return
  const reordered = [...widgets.value]
  const [w] = reordered.splice(from, 1)
  reordered.splice(to, 0, w!)
  widgets.value = reordered
  announcePosition(w!, 'Moved')
  if (focusList)
    void nextTick(() =>
      root.value
        ?.querySelector<HTMLButtonElement>('.shared-widget-list button[aria-pressed="true"]')
        ?.focus(),
    )
}
function duplicateWidget() {
  const widget = selectedWidget.value
  if (
    !editing.value ||
    busy.value ||
    !canEdit.value ||
    !widget ||
    !repeatable(widget.type) ||
    !palette.value.includes(widget.type) ||
    !canAdd(widget.type)
  )
    return
  if (widget.container) {
    const copies = copyConfiguration(widgets.value, [widget.id])
    if (applyLayout([...widgets.value, ...copies])) editWidget(copies.find((w) => !w.parentId)!.id)
    return
  }
  const copy: SharedDashboardWidget = JSON.parse(JSON.stringify(widget))
  copy.id = crypto.randomUUID()
  if (copy.type === 'notes') copy.text = ''
  if (copy.placement) {
    const p = copy.placement
    copy.placement = placeWidget(p.x + 1, p.y + 1, p.w, p.h, false)
  }
  copy.title = `${widget.title || sharedWidgetLabels[widget.type]} copy`.slice(0, 100)
  widgets.value.splice(selectedIndex.value + 1, 0, copy)
  editWidget(copy.id)
}
function captureDashboardContext() {
  const request = generation,
    owner = auth.currentUser?.uid,
    rawRole = auth.rawRole,
    access = auth.hasWorkspaceAccess,
    currentScope = scope.value,
    currentJob = jobId.value
  return () =>
    request === generation &&
    owner === auth.currentUser?.uid &&
    rawRole === auth.rawRole &&
    access === auth.hasWorkspaceAccess &&
    currentScope === scope.value &&
    currentJob === jobId.value
}
function applyLayout(next: SharedDashboardWidget[]) {
  if (!editing.value || busy.value || !canEdit.value) return false
  try {
    widgets.value = validateSharedWidgets(next, scope.value)
    error.value = ''
    return true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'This layout change is unavailable.'
    return false
  }
}
function copySelection() {
  clipboard.value = JSON.parse(
    JSON.stringify(
      descendants(
        widgets.value,
        selectedRoots.value.map((w) => w.id),
      ),
    ),
  )
  message.value = 'Widget settings copied. Saved private content is not copied.'
}
function pasteSelection() {
  if (!clipboard.value.length || clipboard.value.some((w) => !palette.value.includes(w.type)))
    return
  const copied = copyConfiguration(
    clipboard.value,
    clipboard.value
      .filter((w) => !clipboard.value.some((p) => p.id === w.parentId))
      .map((w) => w.id),
  )
  if (applyLayout([...widgets.value, ...copied])) {
    selection.value = copied.filter((w) => !w.parentId).map((w) => w.id)
    selected.value = selection.value.at(-1) || ''
  }
}
function arrangeSelection(operation: Arrangement) {
  const size = operation === 'width' || operation === 'height'
  const entries = selectedRoots.value.filter(
    (w) => !geometryLocked(widgets.value, w, size ? 'sizeLocked' : 'positionLocked'),
  )
  if (
    entries.length < 2 ||
    new Set(entries.map((w) => (w.parentId || '') + ':' + (w.region || '0'))).size > 1
  )
    return
  const positions = measuredPlacements(),
    indices = entries.map((w) => widgets.value.indexOf(w))
  const result = arrange(
    indices.map((i) => positions[i]!),
    operation,
    positions[selectedIndex.value]!,
  )
  if (size)
    entries.forEach((w, i) => {
      if (geometryLocked(widgets.value, w, 'positionLocked')) {
        const original = positions[indices[i]!]!,
          changed = result[i]!
        result[i] = {
          ...changed,
          x: original.x,
          y: original.y,
          w: Math.min(changed.w, 24 - original.x),
          h: Math.min(changed.h, 1000 - original.y),
        }
      }
    })
  widgets.value = widgets.value.map((w, i) =>
    device.value === 'desktop' || indices.includes(i)
      ? withPlacement(w, indices.includes(i) ? result[indices.indexOf(i)]! : positions[i]!)
      : w,
  )
}
function setLock(key: 'positionLocked' | 'sizeLocked', value: boolean) {
  if (!editing.value || busy.value || !canEdit.value) return
  widgets.value = widgets.value.map((w) =>
    selectedIds.value.includes(w.id) ? { ...w, [key]: value } : w,
  )
}
function groupSelection() {
  const entries = selectedRoots.value
  if (
    entries.length < 2 ||
    widgets.value.length >= 12 ||
    entries.some((w) => geometryLocked(widgets.value, w, 'positionLocked')) ||
    new Set(entries.map((w) => (w.parentId || '') + ':' + (w.region || '0'))).size > 1
  )
    return
  const positions = measuredPlacements(),
    groupBounds = bounds(entries.map((w) => positions[widgets.value.indexOf(w)]!))
  const container: SharedDashboardWidget = {
    ...newSharedWidget('container'),
    title: 'Group',
    placement: placeWidget(
      groupBounds.x,
      groupBounds.y,
      groupBounds.w,
      Math.min(100, groupBounds.h + 2),
      false,
    ),
    ...(entries[0]!.parentId
      ? { parentId: entries[0]!.parentId, region: entries[0]!.region || '0' }
      : {}),
  }
  const deviceBounds: Partial<Record<'tablet' | 'phone', typeof groupBounds>> = {}
  for (const name of ['tablet', 'phone'] as const)
    if (entries.some((w) => w.devices?.[name])) {
      const box = bounds(
        entries.map((w) => w.devices?.[name] || positions[widgets.value.indexOf(w)]!),
      )
      deviceBounds[name] = box
      container.devices = {
        ...container.devices,
        [name]: placeWidget(box.x, box.y, box.w, Math.min(100, box.h + 2), false),
      }
    }
  const relative = (p: typeof groupBounds, b: typeof groupBounds) =>
    placeWidget(((p.x - b.x) / b.w) * 24, p.y - b.y, (p.w / b.w) * 24, p.h, false)
  const next = widgets.value.map((w, i) => {
    if (!entries.includes(w)) return { ...w, placement: positions[i]! }
    const child = {
      ...w,
      parentId: container.id,
      region: '0',
      placement: relative(positions[i]!, groupBounds),
      devices: { ...w.devices },
    }
    for (const name of ['tablet', 'phone'] as const)
      if (deviceBounds[name])
        child.devices[name] = relative(w.devices?.[name] || positions[i]!, deviceBounds[name]!)
    return child
  })
  if (applyLayout([...next, container])) selectWidget(container.id)
}
function ungroupSelection() {
  const container = selectedWidget.value
  if (!container?.container || geometryLocked(widgets.value, container, 'positionLocked')) return
  const position = measuredPlacements()[selectedIndex.value]!
  const parentSurface = surfaceFor(container.parentId, container.region),
    parentRect = parentSurface?.getBoundingClientRect()
  const parentScale = parentSurface && parentRect ? parentRect.width / parentSurface.offsetWidth : 1
  function detached(
    p: NonNullable<SharedDashboardWidget['placement']>,
    parent: typeof position,
    region: string,
  ) {
    const split = container!.container!.kind === 'split',
      horizontal = container!.container!.direction === 'row'
    const fraction = container!.container!.ratio / 100,
      second = region === '1'
    const regionWidth =
      split && horizontal ? parent.w * (second ? 1 - fraction : fraction) : parent.w
    const offsetX = split && horizontal && second ? parent.w * fraction : 0
    const offsetY = split && !horizontal && second ? parent.h * fraction : 0
    return placeWidget(
      parent.x + offsetX + (p.x / 24) * regionWidth,
      parent.y + offsetY + p.y,
      (p.w / 24) * regionWidth,
      p.h,
      false,
    )
  }
  const next = widgets.value
    .filter((w) => w.id !== container.id)
    .map((w) => {
      if (w.parentId !== container.id) return w
      const p = w.placement || { x: 0, y: 0, w: 12, h: 10 }
      const element = [
        ...(root.value?.querySelectorAll<HTMLElement>('[data-widget-id]') || []),
      ].find((el) => el.dataset.widgetId === w.id)
      const rect = element?.getBoundingClientRect()
      const result = {
        ...w,
        placement:
          rect?.width && parentRect
            ? placeWidget(
                ((rect.left - parentRect.left) / parentRect.width) * 24,
                (rect.top - parentRect.top) / parentScale / 32,
                (rect.width / parentRect.width) * 24,
                rect.height / parentScale / 32,
                false,
              )
            : detached(p, position, w.region || '0'),
      }
      for (const name of ['tablet', 'phone'] as const)
        if (w.devices?.[name] || container.devices?.[name]) {
          const child = w.devices?.[name] || p,
            parent = container.devices?.[name] || position
          result.devices = { ...result.devices, [name]: detached(child, parent, w.region || '0') }
        }
      if (container.parentId) {
        result.parentId = container.parentId
        result.region = container.region || '0'
      } else {
        delete result.parentId
        delete result.region
      }
      return result
    })
  if (applyLayout(next)) selectWidget(next[0]?.id || '')
}
const availableParents = computed(() =>
  widgets.value.filter(
    (w) => w.type === 'container' && !descendants(widgets.value, selectedIds.value).includes(w),
  ),
)
function changeParent(event: Event) {
  const widget = selectedWidget.value
  if (!widget || geometryLocked(widgets.value, widget, 'positionLocked')) return
  const id = (event.target as HTMLSelectElement).value
  const next = widgets.value.map((w) => {
    if (w.id !== widget.id) return w
    const result = { ...w }
    if (id) {
      result.parentId = id
      result.region = '0'
    } else {
      delete result.parentId
      delete result.region
    }
    return result
  })
  applyLayout(next)
}
function updateContainerLabels(event: Event) {
  const widget = selectedWidget.value
  if (!widget?.container) return
  const labels = (event.target as HTMLTextAreaElement).value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  applyLayout(
    widgets.value.map((w) => (w === widget ? { ...w, container: { ...w.container!, labels } } : w)),
  )
}
function changeContainerKind(event: Event) {
  const widget = selectedWidget.value
  if (!widget?.container) return
  const kind = (event.target as HTMLSelectElement).value as NonNullable<
    SharedDashboardWidget['container']
  >['kind']
  const count = kind === 'tabs' ? widget.container.labels.length : kind === 'split' ? 2 : 1
  const next = widgets.value.map((w) =>
    w === widget
      ? { ...w, container: { ...w.container!, kind } }
      : w.parentId === widget.id && Number(w.region || '0') >= count
        ? { ...w, region: '0' }
        : w,
  )
  if (applyLayout(next))
    message.value = 'Container updated. Widgets from removed regions moved to the first region.'
}
async function remove() {
  if (!editing.value || busy.value || !canEdit.value) return
  const widget = selectedWidget.value
  if (!widget || widget.type === requiredType.value) return
  const current = captureDashboardContext()
  if (
    (await confirm.value?.ask({
      title: 'Remove widget?',
      message:
        'This removes the widget from this layout. Saved announcements, notes, tasks, calendar dates, documents and form submissions are retained.',
      confirmLabel: 'Remove',
      destructive: true,
    })) &&
    current() &&
    editing.value &&
    !busy.value &&
    canEdit.value &&
    widgets.value.includes(widget)
  ) {
    const index = widgets.value.findIndex((entry) => entry.id === widget.id)
    const removed = new Set(descendants(widgets.value, [widget.id]).map((w) => w.id))
    if (!applyLayout(widgets.value.filter((w) => !removed.has(w.id)))) return
    selected.value = widgets.value[Math.min(index, widgets.value.length - 1)]?.id || ''
    focusSettings()
  }
}
async function prepare() {
  if (busy.value) return false
  const current = captureDashboardContext(),
    participant = canvas.value
  if (!((await participant?.prepareForms()) ?? true) || !current() || busy.value) return false
  if (dirty.value || participant?.notesDirty) {
    if (
      !(await confirm.value?.ask({
        title: 'Discard unsaved changes?',
        message:
          'Your unsaved layout, notes, calendar, task or announcement draft edits will be discarded. Saved records remain.',
        confirmLabel: 'Discard changes',
        destructive: true,
      })) ||
      !current() ||
      busy.value
    )
      return false
    participant?.discardNotes()
  }
  return current() && !busy.value
}
function context() {
  return {
    scope: scope.value,
    ...(scope.value === 'job'
      ? { jobId: jobId.value }
      : scope.value === 'role'
        ? { role: role.value }
        : {}),
  }
}
async function load() {
  resetForms()
  stopBackground?.()
  selection.value = []
  handTool.value = false
  const request = ++generation
  drag.cancel()
  loading.value = true
  editing.value = false
  error.value = ''
  message.value = ''
  layout.value = undefined
  widgets.value = []
  saved.value = ''
  undo.value = []
  redo.value = []
  try {
    const result = await sharedDashboardCommand('load', context())
    if (request !== generation) return
    layout.value = result
    widgets.value = JSON.parse(JSON.stringify(result.widgets))
    viewportSettings.value = result.viewport
      ? validateDashboardViewport(result.viewport)
      : defaultDashboardViewport()
    runtimeZoom.value = viewportSettings.value.zoom
    allowRoleEditing.value = result.allowRoleEditing
    saved.value = snapshot()
    selected.value = widgets.value[0]?.id || ''
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) loading.value = false
  }
}
async function reload() {
  if (!(await prepare())) return
  if (jobsStore.error) void jobsStore.subscribeVisibleJobs()
  await load()
}
async function beginEdit() {
  if (!canEdit.value || loading.value || !(await prepare())) return
  editing.value = true
  activePane.value = 'preview'
  fit.value = true
  message.value = ''
  undo.value = []
  redo.value = []
  await loadForms()
}
function resetForms() {
  formsGeneration++
  forms.value = []
  formsError.value = ''
  formsLoading.value = false
}
async function loadForms() {
  resetForms()
  if (!editing.value || !palette.value.includes('form')) return
  const request = formsGeneration,
    dashboardRequest = generation,
    selectedRole = role.value,
    uid = auth.currentUser?.uid
  if (!uid) return
  const current = () =>
    request === formsGeneration &&
    dashboardRequest === generation &&
    editing.value &&
    selectedRole === role.value &&
    uid === auth.currentUser?.uid
  formsLoading.value = true
  try {
    const response = await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', {
      action: 'list',
    })
    if (current())
      forms.value = response.templates.filter(
        (form) =>
          form.latestVersion &&
          !form.archived &&
          form.definition &&
          canSubmitForm(form.definition.access, {
            uid,
            role: selectedRole,
            active: auth.hasWorkspaceAccess,
          }),
      )
  } catch (reason) {
    if (current()) formsError.value = dashboardError(reason)
  } finally {
    if (current()) formsLoading.value = false
  }
}
async function cancel() {
  if (!(await prepare())) return
  drag.cancel()
  restore(saved.value)
  editing.value = false
  resetForms()
  error.value = ''
  undo.value = []
  redo.value = []
}
async function save() {
  if (!canEdit.value || busy.value || !layout.value) return
  busy.value = true
  error.value = ''
  drag.cancel()
  const request = generation
  try {
    const result = await sharedDashboardCommand('save-template', {
      ...context(),
      version: layout.value.version,
      widgets: JSON.parse(JSON.stringify(widgets.value)),
      viewport: validateDashboardViewport(viewportSettings.value),
      ...(scope.value === 'role' && isAdmin.value
        ? { allowRoleEditing: allowRoleEditing.value }
        : {}),
    })
    if (request !== generation) return
    layout.value = result
    widgets.value = JSON.parse(JSON.stringify(result.widgets))
    viewportSettings.value = result.viewport
      ? validateDashboardViewport(result.viewport)
      : defaultDashboardViewport()
    runtimeZoom.value = viewportSettings.value.zoom
    allowRoleEditing.value = result.allowRoleEditing
    saved.value = snapshot()
    editing.value = false
    resetForms()
    message.value =
      scope.value === 'personal'
        ? 'Your layout was saved.'
        : scope.value === 'job'
          ? 'Template saved for all jobs.'
          : 'Template saved for everyone in this role.'
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) busy.value = false
  }
}
const canEditContent = computed(() =>
  scope.value === 'job' ? isAdmin.value && !!layout.value?.job : role.value === auth.rawRole,
)
async function saveContent(
  action: 'save-notes' | 'save-calendar' | 'save-tasks' | 'save-announcement-drafts',
  payload:
    | { widgetId: string; text: string }
    | { events: SharedCalendarEntry[] }
    | { tasks: import('@/features/dashboard/sharedDashboards').PersonalTask[] }
    | { announcementDrafts: import('@/features/dashboard/sharedDashboards').AnnouncementDraft[] },
) {
  if (!canEditContent.value || busy.value || !layout.value) return
  busy.value = true
  error.value = ''
  const request = generation
  try {
    const result = await sharedDashboardCommand(action, {
      ...context(),
      version: layout.value.notesVersion,
      ...payload,
    })
    if (request !== generation) return
    layout.value.announcementDrafts = result.announcementDrafts || []
    layout.value.tasks = result.tasks || []
    layout.value.notes = result.notes
    layout.value.events = result.events
    layout.value.notesVersion = result.version
    canvas.value?.finishNote(action, 'widgetId' in payload ? payload.widgetId : undefined)
    message.value = scope.value === 'job' ? 'Saved for this job.' : 'Saved for your account.'
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) busy.value = false
  }
}
function saveNote(id: string, text: string) {
  void saveContent('save-notes', { widgetId: id, text })
}
function saveCalendar(events: SharedCalendarEntry[]) {
  void saveContent('save-calendar', { events })
}
async function publishAnnouncement(draftId: string) {
  if (!isAdmin.value || busy.value || scope.value !== 'personal' || !layout.value) return
  const request = generation,
    owner = auth.currentUser?.uid,
    targetLayout = layout.value
  const current = () =>
    request === generation &&
    owner === auth.currentUser?.uid &&
    auth.hasWorkspaceAccess &&
    isAdmin.value &&
    scope.value === 'personal' &&
    layout.value === targetLayout
  if (!(await prepare()) || !current()) return
  const draft = targetLayout.announcementDrafts?.find((item) => item.id === draftId)
  if (!draft?.audience) return
  const version = targetLayout.notesVersion
  const audience =
    draft.audience === 'everyone'
      ? 'everyone with current dashboard access'
      : draft.audience === 'people'
        ? `${draft.recipientIds?.length || 0} selected people`
        : 'people currently assigned to ' +
          (visibleJobs.value.find((job) => job.id === draft.jobId)?.name || 'the selected job')
  if (
    !(await confirm.value?.ask({
      title: 'Publish announcement?',
      message: `Publish “${draft.title}” to ${audience}? This publishes a snapshot; no notifications are sent.`,
      confirmLabel: 'Publish',
    })) ||
    !current() ||
    busy.value
  )
    return
  busy.value = true
  error.value = ''
  try {
    await sharedDashboardCommand('publish-announcement', { scope: 'personal', version, draftId })
    if (!current()) return
    targetLayout.publishedDraftIds = [
      ...new Set([...(targetLayout.publishedDraftIds || []), draftId]),
    ]
    message.value =
      'Announcement published. Refresh the Announcements widget to see eligible updates.'
  } catch (reason) {
    if (current()) error.value = dashboardError(reason)
  } finally {
    if (current()) busy.value = false
  }
}
async function changeRole(event: Event) {
  const select = event.target as HTMLSelectElement
  const nextRole = select.value as RawRoleKey
  if (!(await prepare())) {
    select.value = role.value
    return
  }
  role.value = nextRole
  await load()
  if (canEdit.value) await beginEdit()
}
async function changeJob(event: Event) {
  const select = event.target as HTMLSelectElement
  await router.push({
    name: 'shared-job-home',
    params: select.value ? { jobId: select.value } : {},
  })
  select.value = jobId.value
}
function selectForm(event: Event) {
  if (formsLoading.value || formsError.value) return
  const widget = selectedWidget.value,
    form = forms.value.find((f) => f.id === (event.target as HTMLSelectElement).value)
  if (!widget || !form) return
  widget.form = {
    templateId: form.id,
    version: form.latestVersion,
    presentation: widget.form?.presentation || 'launcher',
  }
}
function manualZoom(delta: number) {
  zoom.value = Math.max(0.25, Math.min(2, previewScale.value + delta))
  fit.value = false
}
const handTool = ref(false)
const runtimeZoom = ref(1)
const runtimeCamera = ref({ x: 0, y: 0 })
const editorCamera = ref({ x: 0, y: 0 })
function scrollViewport(x: number, y: number) {
  if (!viewport.value) return
  viewport.value.scrollLeft = x
  viewport.value.scrollTop = y
}
function fitEditor() {
  fit.value = true
  editorCamera.value = { x: 0, y: 0 }
  scrollViewport(0, 0)
}
const marquee = ref<{ x: number; y: number; w: number; h: number }>()
let stopBackground: (() => void) | undefined
function backgroundPointer(event: PointerEvent) {
  if (
    busy.value ||
    (!editing.value && viewportSettings.value.pan === 'locked') ||
    ![0, 1].includes(event.button)
  )
    return
  const target = event.target as HTMLElement
  const surface = target.closest<HTMLElement>('[data-widget-surface]')
  const widget = target.closest<HTMLElement>('[data-widget-id]')
  const panning =
    event.button === 1 ||
    handTool.value ||
    (!widget &&
      (!editing.value
        ? viewportSettings.value.pan === 'free'
        : !(event.shiftKey || event.ctrlKey || event.metaKey)))
  if (!editing.value && !panning) return
  if (!panning && (!surface || (widget && surface.contains(widget)))) return
  if (panning && target.closest('button,input,textarea,select,a,[contenteditable]')) return
  const additive = event.shiftKey || event.ctrlKey || event.metaKey
  const selecting = editing.value && additive && !panning && surface
  if (editing.value && !additive && !panning) selectWidget('')
  const scroller = viewport.value
  if (!scroller) return
  const initial = {
      x: event.clientX,
      y: event.clientY,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      camera: { ...(editing.value ? editorCamera.value : runtimeCamera.value) },
    },
    initialSelection = selectedIds.value.slice()
  event.preventDefault()
  event.stopPropagation()
  stopBackground?.()
  function move(e: PointerEvent) {
    if (e.pointerId !== event.pointerId || busy.value || (editing.value && !canEdit.value)) {
      stopBackground?.()
      return
    }
    if (!selecting) {
      if (editing.value || runtimeFree.value) {
        const value = panCamera(
          initial.camera,
          e.clientX - initial.x,
          e.clientY - initial.y,
          editing.value ? previewScale.value : runtimeScale.value,
        )
        if (editing.value) editorCamera.value = value
        else runtimeCamera.value = value
        return
      }
      scroller!.scrollLeft = initial.left + initial.x - e.clientX
      scroller!.scrollTop = initial.top + initial.y - e.clientY
      return
    }
    const left = Math.min(initial.x, e.clientX),
      top = Math.min(initial.y, e.clientY),
      right = Math.max(initial.x, e.clientX),
      bottom = Math.max(initial.y, e.clientY)
    marquee.value = { x: left, y: top, w: right - left, h: bottom - top }
    const ids = [...surface!.querySelectorAll<HTMLElement>('[data-widget-id]')]
      .filter((el) => el.closest('[data-widget-surface]') === surface)
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.right >= left && r.left <= right && r.bottom >= top && r.top <= bottom
      })
      .map((el) => el.dataset.widgetId!)
    selection.value = [...new Set([...initialSelection, ...ids])]
    selected.value = selection.value.at(-1) || ''
  }
  function cancel(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (editing.value) editorCamera.value = { ...initial.camera }
      else runtimeCamera.value = { ...initial.camera }
      scroller!.scrollLeft = initial.left
      scroller!.scrollTop = initial.top
      selection.value = initialSelection
      selected.value = initialSelection.at(-1) || ''
      stopBackground?.()
    }
  }
  stopBackground = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    window.removeEventListener('blur', finish)
    window.removeEventListener('keydown', cancel)
    marquee.value = undefined
    stopBackground = undefined
  }
  function finish() {
    stopBackground?.()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
  window.addEventListener('blur', finish)
  window.addEventListener('keydown', cancel)
}
onBeforeUnmount(() => stopBackground?.())
const runtimeFixed = computed(() => viewportSettings.value.mode !== 'responsive')
const runtimeCanvasWidth = computed(() =>
  runtimeFixed.value ? viewportSettings.value.width : viewportWidth.value,
)
const runtimeScale = computed(() =>
  viewportSettings.value.mode === 'scale'
    ? Math.min(
        1,
        viewportWidth.value / viewportSettings.value.width,
        viewportSettings.value.fit === 'contain'
          ? viewportHeight.value /
              (viewportSettings.value.frame === 'custom'
                ? viewportSettings.value.height
                : contentHeight.value)
          : 1,
      ) * runtimeZoom.value
    : runtimeZoom.value,
)
const runtimeFramed = computed(
  () =>
    runtimeFixed.value ||
    viewportSettings.value.pan !== 'overflow' ||
    viewportSettings.value.start.x !== 0 ||
    viewportSettings.value.start.y !== 0 ||
    runtimeZoom.value !== 1,
)
const runtimeFree = computed(
  () => !editing.value && runtimeFramed.value && viewportSettings.value.pan === 'free',
)
const runtimeCameraMode = computed(
  () => !editing.value && runtimeFramed.value && viewportSettings.value.pan !== 'overflow',
)
const runtimeOffsetX = computed(() =>
  alignmentOffset(
    viewportWidth.value,
    runtimeCanvasWidth.value * runtimeScale.value,
    viewportSettings.value.align,
  ),
)
const runtimeOffsetY = computed(() =>
  alignmentOffset(
    viewportHeight.value,
    contentHeight.value * runtimeScale.value,
    viewportSettings.value.verticalAlign,
  ),
)
function resetRuntimeView() {
  runtimeZoom.value = viewportSettings.value.zoom
  runtimeCamera.value = startCamera(viewportSettings.value.start, runtimeCanvasWidth.value)
  void nextTick(() => {
    if (editing.value) return
    const start = startCamera(viewportSettings.value.start, runtimeCanvasWidth.value)
    scrollViewport(
      runtimeCameraMode.value ? 0 : start.x * runtimeScale.value,
      runtimeCameraMode.value ? 0 : start.y * runtimeScale.value,
    )
  })
}
watch(
  [editing, layout, () => viewportSettings.value],
  () => {
    stopBackground?.()
    handTool.value = false
    editorCamera.value = { x: 0, y: 0 }
    if (!editing.value) resetRuntimeView()
  },
  { flush: 'post' },
)
watch([runtimeScale, runtimeCanvasWidth], ([, width], [, previousWidth]) => {
  if (!editing.value && runtimeCameraMode.value && width !== previousWidth)
    runtimeCamera.value = startCamera(viewportSettings.value.start, width)
  if (!editing.value && !runtimeCameraMode.value) {
    const start = startCamera(viewportSettings.value.start, runtimeCanvasWidth.value)
    void nextTick(() => scrollViewport(start.x * runtimeScale.value, start.y * runtimeScale.value))
  }
})
function cameraWheel(event: WheelEvent) {
  if (!runtimeFree.value || event.ctrlKey || event.metaKey) return
  // Nested document viewers and form controls retain their own scrolling.
  let target = event.target instanceof HTMLElement ? event.target : null
  while (target && target !== viewport.value) {
    const style = getComputedStyle(target)
    if (
      (/(auto|scroll)/.test(style.overflowY) && target.scrollHeight > target.clientHeight + 1) ||
      (/(auto|scroll)/.test(style.overflowX) && target.scrollWidth > target.clientWidth + 1)
    )
      return
    target = target.parentElement
  }
  event.preventDefault()
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight.value : 1
  runtimeCamera.value = panCamera(
    runtimeCamera.value,
    -(event.shiftKey ? event.deltaY : event.deltaX) * unit,
    -(event.shiftKey ? 0 : event.deltaY) * unit,
    runtimeScale.value,
  )
}
function cameraKey(event: KeyboardEvent) {
  if (editing.value || !runtimeFramed.value || event.target !== viewport.value) return
  if (
    !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home'].includes(
      event.key,
    )
  )
    return
  if (viewportSettings.value.pan === 'locked') {
    event.preventDefault()
    return
  }
  if (event.key === 'Home') {
    event.preventDefault()
    resetRuntimeView()
    return
  }
  if (!runtimeFree.value) return
  event.preventDefault()
  const delta = event.key.startsWith('Page') ? viewportHeight.value * 0.8 : 40
  const x = event.key === 'ArrowLeft' ? delta : event.key === 'ArrowRight' ? -delta : 0
  const y =
    event.key === 'ArrowUp' || event.key === 'PageUp'
      ? delta
      : event.key === 'ArrowDown' || event.key === 'PageDown'
        ? -delta
        : 0
  runtimeCamera.value = panCamera(runtimeCamera.value, x, y, runtimeScale.value)
}
const runtimeDevice = computed(() =>
  viewportWidth.value < 600 ? 'phone' : viewportWidth.value < 1024 ? 'tablet' : 'desktop',
)
function keydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    !editing.value ||
    busy.value ||
    event.altKey ||
    (event.target as HTMLElement).closest('input,select,textarea,[contenteditable]')
  )
    return
  const targetWidget = (event.target as HTMLElement).closest<HTMLElement>('[data-widget-id]')
  if (
    targetWidget &&
    !event.ctrlKey &&
    !event.metaKey &&
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) &&
    canEdit.value
  ) {
    event.preventDefault()
    const id = targetWidget.dataset.widgetId
    const positions = measuredPlacements()
    const widget = widgets.value.find((w) => w.id === id)
    if (!widget || geometryLocked(widgets.value, widget, 'positionLocked')) return
    if (!selectedIds.value.includes(widget.id)) selectWidget(widget.id)
    const distance = event.shiftKey ? 10 : 1
    const entries = selectedRoots.value.filter(
      (w) =>
        !geometryLocked(widgets.value, w, 'positionLocked') &&
        w.parentId === widget.parentId &&
        (w.region || '0') === (widget.region || '0'),
    )
    const dx = event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0
    const dy = event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0
    const grid = interactionGrid.value
    const result = translate(
      entries.map((w) => positions[widgets.value.indexOf(w)]!),
      dx * (grid.snap ? grid.x : 1 / 45),
      dy * (grid.snap ? grid.y : 1 / 32),
      grid,
    )
    widgets.value = widgets.value.map((w, i) =>
      device.value === 'desktop' || entries.includes(w)
        ? withPlacement(w, entries.includes(w) ? result[entries.indexOf(w)]! : positions[i]!)
        : w,
    )
  } else if (
    (event.ctrlKey || event.metaKey) &&
    ['a', 'c', 'v'].includes(event.key.toLowerCase()) &&
    canEdit.value
  ) {
    event.preventDefault()
    if (event.key.toLowerCase() === 'a') {
      selection.value = widgets.value.filter((w) => !w.parentId).map((w) => w.id)
      selected.value = selection.value.at(-1) || ''
    } else if (event.key.toLowerCase() === 'c') copySelection()
    else pasteSelection()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) redoChange()
    else undoChange()
  } else if (
    event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'y'
  ) {
    event.preventDefault()
    redoChange()
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value || canvas.value?.notesDirty) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(prepare)
onBeforeRouteUpdate(prepare)
watch(
  [scope, jobId, () => auth.currentUser?.uid, () => auth.rawRole, () => auth.hasWorkspaceAccess],
  () => {
    generation++
    busy.value = false
    role.value = auth.rawRole
    void load()
  },
)
async function syncDocumentJob() {
  if (scope.value === 'job' && jobId.value && route.query.sdsJob !== jobId.value)
    await router.replace({ query: { ...route.query, sdsJob: jobId.value } })
  else if (scope.value === 'role' && route.query.sdsJob !== undefined) {
    const query = { ...route.query }
    delete query.sdsJob
    await router.replace({ query })
  }
}
watch([scope, jobId], () => void syncDocumentJob())
onMounted(async () => {
  void jobsStore.subscribeVisibleJobs()
  await syncDocumentJob()
  void load()
  observer = new ResizeObserver(() => {
    viewportWidth.value = viewport.value?.clientWidth || 1100
    viewportHeight.value = viewport.value?.clientHeight || 720
    contentHeight.value = content.value?.offsetHeight || 700
  })
  await nextTick()
  if (viewport.value) observer.observe(viewport.value)
  if (content.value) observer.observe(content.value)
  window.addEventListener('beforeunload', beforeUnload)
})
watch(
  [viewport, content],
  ([view, body], [oldView, oldBody]) => {
    if (oldView) observer?.unobserve(oldView)
    if (oldBody) observer?.unobserve(oldBody)
    if (view) observer?.observe(view)
    if (body) observer?.observe(body)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => {
  resetForms()
  generation++
  observer?.disconnect()
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<template>
  <AppShell :contained="editing" :compact="editing" :before-sign-out="prepare">
    <section
      ref="root"
      class="shared-dashboard"
      :class="{ 'is-editing': editing }"
      :aria-label="
        scope === 'personal'
          ? 'Personal dashboard'
          : scope === 'job'
            ? 'Shared job dashboard'
            : 'Shared role home'
      "
      @click.capture="drag.guardClick"
      @keydown="keydown"
    >
      <header class="shared-dashboard-header" :class="{ 'builder-controls': editing }">
        <div>
          <p class="shared-dashboard-eyebrow">
            {{
              scope === 'personal'
                ? 'Personal dashboard'
                : scope === 'job'
                  ? 'Job home'
                  : 'Role home'
            }}
          </p>
          <h1>{{ pageTitle }}</h1>
          <p>
            {{
              scope === 'personal'
                ? 'Your layout and information, private to your account.'
                : scope === 'job'
                  ? 'Your job tools and information in one place.'
                  : 'Your jobs and the tools your team uses.'
            }}
          </p>
        </div>
        <nav class="shared-header-actions" aria-label="Dashboard actions">
          <template v-if="editing"
            ><AppButton
              type="button"
              :disabled="busy || !undo.length"
              aria-label="Undo template edit"
              aria-keyshortcuts="Control+Z Meta+Z"
              @click="undoChange"
            >
              Undo</AppButton
            ><AppButton
              type="button"
              :disabled="busy || !redo.length"
              aria-label="Redo template edit"
              aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z"
              @click="redoChange"
            >
              Redo</AppButton
            ><AppButton variant="primary" type="button" :disabled="busy || !dirty" @click="save"
              >Save template</AppButton
            ><AppButton type="button" :disabled="busy" @click="cancel"
              >Cancel edits</AppButton
            ></template
          >
          <AppButton
            v-else-if="canEdit"
            variant="primary"
            type="button"
            :disabled="contentLoading || busy"
            @click="beginEdit"
          >
            Edit</AppButton
          ><AppButton type="button" :disabled="loading || busy" @click="reload">Refresh</AppButton>
          <AppButtonLink
            v-if="scope === 'job' && editableJobIds.includes(jobId)"
            :to="jobsManagementRoute('edit', 'job', jobId, jobId)"
            >Manage job</AppButtonLink
          >
          <AppButtonLink :to="scope === 'job' && jobId ? `/jobs/${jobId}` : '/jobs'">{{
            scope === 'job' && jobId ? 'Existing job page' : 'Jobs'
          }}</AppButtonLink>
        </nav>
      </header>
      <nav v-if="!editing" class="shared-dashboard-scopes" aria-label="Dashboard scopes">
        <AppButtonLink
          :to="{ name: 'personal-workspace' }"
          :aria-current="scope === 'personal' ? 'page' : undefined"
          >Personal</AppButtonLink
        >
        <AppButtonLink
          :to="{ name: 'role-workspace' }"
          :aria-current="scope === 'role' ? 'page' : undefined"
          >Role</AppButtonLink
        >
        <span v-if="scope === 'job'" aria-current="page">Job dashboard</span>
      </nav>
      <label v-if="scope === 'job'" class="shared-job-picker"
        >Choose job<select
          aria-label="Choose job"
          :value="jobId"
          :disabled="busy"
          @change="changeJob"
        >
          <option value="">Choose a job</option>
          <option v-for="job in visibleJobs" :key="job.id" :value="job.id">
            {{ job.code }} · {{ job.name }}
          </option>
        </select></label
      >
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <AppLoadingRegion
        ref="loadingRegion"
        class="shared-dashboard-loading"
        :loading="loading"
        label="Loading dashboard."
        aria-label="Dashboard content"
      >
        <div v-if="layout && !widgets.length && !editing" class="shared-dashboard-empty">
          <h2>Make this dashboard yours</h2>
          <p>Add the jobs, notes, documents and forms you use most.</p>
          <AppButton
            v-if="canEdit"
            variant="primary"
            :disabled="contentLoading || busy"
            @click="beginEdit"
            >Add widgets</AppButton
          >
        </div>
        <BuilderPanelSwitcher
          v-if="editing"
          v-model="activePane"
          class="builder-controls"
          outline-label="Widgets"
          outline-controls="shared-palette"
          canvas-controls="shared-canvas"
          inspector-controls="shared-inspector"
          :disabled="busy"
        />
        <div
          class="shared-dashboard-body"
          :data-active-pane="activePane"
          :style="{
            '--palette-width': paletteWidth + 'px',
            '--inspector-width': inspectorWidth + 'px',
          }"
        >
          <aside
            v-if="editing"
            id="shared-palette"
            class="shared-builder-sidebar builder-controls"
            aria-label="Dashboard library"
          >
            <h2>Template</h2>
            <p>
              {{
                scope === 'personal'
                  ? 'Changes apply only to your dashboard.'
                  : scope === 'job'
                    ? 'Changes apply to every job. Job data stays separate.'
                    : 'Changes apply to everyone in this role.'
              }}
            </p>
            <label v-if="scope === 'role' && isAdmin"
              >Shared layout for<select
                aria-label="Shared layout for"
                :value="role"
                :disabled="busy"
                @change="changeRole"
              >
                <option v-for="key in CURRENT_EDITABLE_USER_ROLE_KEYS" :key="key" :value="key">
                  {{ CURRENT_ROLE_LABELS[key] }}
                </option>
              </select></label
            >
            <label
              v-if="scope === 'role' && isAdmin && role !== 'admin'"
              class="shared-role-permission"
              ><input v-model="allowRoleEditing" type="checkbox" :disabled="busy" />Allow this role
              to edit its dashboard</label
            >
            <h2>Widgets</h2>
            <label
              >Find a widget<input
                v-model="widgetSearch"
                type="search"
                maxlength="80"
                :disabled="busy"
            /></label>
            <small>Drag onto the canvas, or select to add. {{ widgets.length }} of 12 used.</small>
            <section
              v-for="group in paletteGroups"
              :key="group.title"
              class="shared-widget-group"
              :aria-label="group.title"
            >
              <h3>{{ group.title }}</h3>
              <AppButton
                v-for="type in group.types"
                :key="type"
                class="shared-widget-picker"
                type="button"
                :aria-label="`Add ${sharedWidgetLabels[type]}`"
                :disabled="busy || !canAdd(type)"
                @pointerdown="drag.start($event, { kind: 'new', type }, sharedWidgetLabels[type])"
                @dragstart.prevent
                @click="add(type)"
              >
                <strong>{{ sharedWidgetLabels[type] }}</strong>
                <small>{{
                  !repeatable(type) && widgets.some((widget) => widget.type === type)
                    ? 'Already on dashboard'
                    : widgetDescriptions[type]
                }}</small>
              </AppButton>
            </section>
            <p v-if="!paletteGroups.length" role="status">No widgets match your search.</p>
            <h2 id="shared-widget-list-title">On this dashboard</h2>
            <small id="shared-widget-reorder-help"
              >Use Up and Down to select. Use Alt + Up or Down to reorder.</small
            >
            <div
              class="shared-widget-list"
              role="group"
              aria-labelledby="shared-widget-list-title"
              aria-describedby="shared-widget-reorder-help"
              @keydown="navigateWidgets"
            >
              <AppButton
                v-for="widget in widgets"
                :key="widget.id"
                type="button"
                :disabled="busy"
                :aria-pressed="selectedIds.includes(widget.id)"
                :tabindex="selected === widget.id ? 0 : -1"
                @click="
                  $event.shiftKey || $event.ctrlKey || $event.metaKey
                    ? selectWidget(widget.id, $event)
                    : editWidget(widget.id)
                "
                @dblclick="revealWidget(widget.id)"
              >
                {{ widget.title || sharedWidgetLabels[widget.type] }}
              </AppButton>
            </div>
          </aside>
          <BuilderPanelResize
            v-if="editing"
            v-model:value="paletteWidth"
            label="Resize dashboard library"
            controls="shared-palette"
            :min="190"
            :max="340"
            :disabled="busy"
          />
          <main id="shared-canvas" class="shared-dashboard-stage" aria-label="Dashboard page">
            <div
              v-if="editing"
              class="shared-preview-controls builder-controls"
              role="group"
              aria-label="Preview device"
            >
              <AppButton
                v-for="item in ['desktop', 'tablet', 'phone'] as const"
                :key="item"
                type="button"
                :aria-pressed="device === item"
                @click="device = item"
              >
                {{
                  item === 'desktop' ? 'Desktop' : item === 'tablet' ? 'Tablet' : 'Phone'
                }}</AppButton
              ><AppButton type="button" :aria-pressed="fit" @click="fitEditor">Fit</AppButton
              ><AppButton type="button" aria-label="Zoom out" @click="manualZoom(-0.1)">−</AppButton
              ><span>{{ Math.round(previewScale * 100) }}%</span
              ><AppButton type="button" aria-label="Zoom in" @click="manualZoom(0.1)">+</AppButton>
              <label><input v-model="gridVisible" type="checkbox" />Show grid</label>
              <label><input v-model="snapToGrid" type="checkbox" />Snap to grid</label>
              <label
                >Grid<select aria-label="Grid preset" :value="gridPreset" @change="setGridPreset">
                  <option value="0.25">Fine</option>
                  <option value="1">Standard</option>
                  <option value="2">Coarse</option>
                  <option value="custom" disabled>Custom (X / Y)</option>
                </select></label
              >
              <label
                >X<input
                  aria-label="Horizontal grid spacing"
                  type="number"
                  min="0.125"
                  max="8"
                  step="0.125"
                  :value="viewportSettings.grid.x"
                  @change="setGridSpacing('x', $event)"
              /></label>
              <label
                >Y<input
                  aria-label="Vertical grid spacing"
                  type="number"
                  min="0.125"
                  max="8"
                  step="0.125"
                  :value="viewportSettings.grid.y"
                  @change="setGridSpacing('y', $event)"
              /></label>
              <label><input v-model="gridLinked" type="checkbox" />Link spacing</label>
              <label
                >Major every<input
                  aria-label="Major grid interval"
                  type="number"
                  min="1"
                  max="32"
                  step="1"
                  v-model.number="viewportSettings.grid.majorEvery"
              /></label>
              <AppButton :aria-pressed="handTool" @click="handTool = !handTool">Pan</AppButton>
            </div>
            <div
              v-if="!editing && runtimeFramed"
              class="shared-runtime-controls"
              aria-label="Dashboard view controls"
            >
              <AppButton @click="resetRuntimeView">Reset view</AppButton>
              <AppButton
                @click="runtimeZoom = Math.max(0.25, runtimeZoom - 0.1)"
                aria-label="Zoom dashboard out"
                >−</AppButton
              >
              <span>{{ Math.round(runtimeScale * 100) }}%</span>
              <AppButton
                @click="runtimeZoom = Math.min(2, runtimeZoom + 0.1)"
                aria-label="Zoom dashboard in"
                >+</AppButton
              >
              <AppButton
                v-if="viewportSettings.pan !== 'locked'"
                :aria-pressed="handTool"
                @click="handTool = !handTool"
                >Pan</AppButton
              >
            </div>
            <div
              ref="viewport"
              class="shared-dashboard-viewport"
              data-widget-scroll
              :class="{ 'is-camera-view': runtimeCameraMode, 'is-panning': handTool }"
              tabindex="0"
              aria-label="Dashboard canvas"
              @wheel="cameraWheel"
              @keydown="cameraKey"
              @pointerdown.capture="backgroundPointer"
              :style="
                !editing && runtimeFramed
                  ? {
                      height:
                        viewportSettings.frame === 'custom'
                          ? `min(70dvh, ${viewportSettings.height}px)`
                          : '70dvh',
                      overflow: runtimeCameraMode ? 'hidden' : 'auto',
                    }
                  : undefined
              "
            >
              <div
                :style="
                  editing
                    ? {
                        width: previewWidth * previewScale + 'px',
                        minHeight: contentHeight * previewScale + 'px',
                        transform: `translate(${-editorCamera.x * previewScale}px, ${-editorCamera.y * previewScale}px)`,
                      }
                    : runtimeFramed
                      ? {
                          width: runtimeCanvasWidth * runtimeScale + 'px',
                          height: contentHeight * runtimeScale + 'px',
                          paddingTop: runtimeCameraMode ? '0px' : runtimeOffsetY + 'px',
                          marginLeft:
                            runtimeCameraMode || viewportSettings.align === 'start' ? '0' : 'auto',
                          marginRight:
                            runtimeCameraMode || viewportSettings.align === 'end' ? '0' : 'auto',
                          ...(runtimeCameraMode
                            ? {
                                position: 'absolute',
                                left: runtimeOffsetX - runtimeCamera.x * runtimeScale + 'px',
                                top: runtimeOffsetY - runtimeCamera.y * runtimeScale + 'px',
                              }
                            : {}),
                        }
                      : {}
                "
                class="shared-preview-frame"
              >
                <div
                  ref="content"
                  :style="
                    editing
                      ? {
                          width: previewWidth + 'px',
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                        }
                      : runtimeFramed
                        ? {
                            width: runtimeCanvasWidth + 'px',
                            transform: `scale(${runtimeScale})`,
                            transformOrigin: 'top left',
                          }
                        : {}
                  "
                >
                  <SharedDashboardCanvas
                    v-if="layout && auth.hasWorkspaceAccess"
                    ref="canvas"
                    :key="scope + ':' + jobId + ':' + role"
                    :scope="scope"
                    :widgets="widgets"
                    :job="layout.job"
                    :jobs="visibleJobs"
                    :can-create-jobs="auth.canCreateJobs"
                    :can-manage-jobs="auth.canManageJobs"
                    :editable-job-ids="editableJobIds"
                    :initial-tool-job-id="
                      typeof route.query.dashboardJob === 'string' ? route.query.dashboardJob : ''
                    "
                    :jobs-loading="jobsStore.loading"
                    :jobs-error="jobsStore.error"
                    :notes="layout.notes"
                    :events="layout.events"
                    :text-context="textContext"
                    :role="auth.rawRole"
                    :resource-role="role"
                    :editing="editing"
                    :drop-target="dragging ? dropTarget : undefined"
                    :placement-preview="placementPreview"
                    :placement-previews="placementPreviews"
                    :grid-spacing="viewportSettings.grid"
                    :grid-visible="gridVisible"
                    :selected="selected"
                    :selected-ids="selectedIds"
                    :device="editing ? device : runtimeFixed ? 'desktop' : runtimeDevice"
                    :fixed-frame="!editing && runtimeFixed"
                    :can-edit-notes="canEditContent"
                    :busy="busy"
                    :phone="editing && device === 'phone'"
                    @resize="
                      (event, id, direction) => startTransform(event, id, 'resize', direction)
                    "
                    @select="selectWidget"
                    @edit="editWidget"
                    @move="(event, id) => startTransform(event, id, 'move')"
                    :published-draft-ids="layout?.publishedDraftIds || []"
                    @publish-announcement="publishAnnouncement"
                    :announcement-drafts="layout?.announcementDrafts || []"
                    @save-announcement-drafts="
                      (announcementDrafts) =>
                        saveContent('save-announcement-drafts', { announcementDrafts })
                    "
                    :tasks="layout?.tasks || []"
                    @save-tasks="(tasks) => saveContent('save-tasks', { tasks })"
                    @save-note="saveNote"
                    @save-calendar="saveCalendar"
                  />
                </div>
              </div>
            </div>
          </main>
          <BuilderPanelResize
            v-if="editing"
            v-model:value="inspectorWidth"
            label="Resize dashboard inspector"
            controls="shared-inspector"
            :min="240"
            :max="420"
            reverse
            :disabled="busy"
          />
          <aside
            v-if="editing"
            id="shared-inspector"
            class="shared-builder-sidebar builder-controls"
            aria-label="Widget settings"
          >
            <h2 ref="settingsHeading" tabindex="-1">Widget settings</h2>
            <details class="dashboard-view-settings">
              <summary>Dashboard display</summary>
              <label
                >Runtime layout<select aria-label="Runtime layout" v-model="viewportSettings.mode">
                  <option value="responsive">Responsive</option>
                  <option value="fixed">Fixed canvas with scrolling</option>
                  <option value="scale">Scale canvas</option>
                </select></label
              >
              <label
                >Canvas width<input
                  type="number"
                  min="320"
                  max="3840"
                  v-model.number="viewportSettings.width"
              /></label>
              <label
                >Frame height<input
                  type="number"
                  min="240"
                  max="4000"
                  v-model.number="viewportSettings.height"
              /></label>
              <label
                >Frame bounds<select aria-label="Frame bounds" v-model="viewportSettings.frame">
                  <option value="auto">Fit content</option>
                  <option value="custom">Custom frame</option>
                </select></label
              >
              <label
                >Scale behavior<select aria-label="Scale behavior" v-model="viewportSettings.fit">
                  <option value="contain">Contain</option>
                  <option value="width">Fit width</option>
                </select></label
              >
              <label
                >Horizontal alignment<select
                  aria-label="Horizontal alignment"
                  v-model="viewportSettings.align"
                >
                  <option value="start">Left</option>
                  <option value="center">Center</option>
                  <option value="end">Right</option>
                </select></label
              >
              <label
                >Vertical alignment<select
                  aria-label="Vertical alignment"
                  v-model="viewportSettings.verticalAlign"
                >
                  <option value="start">Top</option>
                  <option value="center">Center</option>
                  <option value="end">Bottom</option>
                </select></label
              >
              <label
                >Runtime panning<select aria-label="Runtime panning" v-model="viewportSettings.pan">
                  <option value="overflow">Overflow</option>
                  <option value="free">Free</option>
                  <option value="locked">Locked</option>
                </select></label
              >
              <label
                >Starting zoom<input
                  type="number"
                  min="0.25"
                  max="2"
                  step="0.05"
                  v-model.number="viewportSettings.zoom"
              /></label>
              <label
                >Starting X (columns)<input
                  aria-label="Starting X (columns)"
                  type="number"
                  min="-10000"
                  max="10000"
                  step="0.25"
                  v-model.number="viewportSettings.start.x"
              /></label>
              <label
                >Starting Y (rows)<input
                  aria-label="Starting Y (rows)"
                  type="number"
                  min="-10000"
                  max="10000"
                  step="0.25"
                  v-model.number="viewportSettings.start.y"
              /></label>
              <p class="shared-muted">
                Starting offsets are relative to the canvas origin. Free allows panning beyond the
                content; Overflow stays within it; Locked holds the starting view.
              </p>
            </details>
            <div class="shared-widget-actions" role="group" aria-label="Selection actions">
              <AppButton :disabled="!selectedIds.length || busy" @click="copySelection"
                >Copy selection</AppButton
              >
              <AppButton :disabled="!clipboard.length || busy" @click="pasteSelection"
                >Paste widgets</AppButton
              >
              <AppButton
                :disabled="
                  selectedRoots.length < 2 || widgets.length >= 12 || busy || device !== 'desktop'
                "
                @click="groupSelection"
                >Group in container</AppButton
              >
              <AppButton
                v-if="selectedWidget?.container"
                :disabled="busy || device !== 'desktop'"
                @click="ungroupSelection"
                >Ungroup container</AppButton
              >
            </div>
            <fieldset v-if="selectedIds.length > 1" :disabled="busy">
              <legend>{{ selectedIds.length }} widgets selected</legend>
              <div class="shared-widget-actions">
                <AppButton
                  v-for="action in [
                    'left',
                    'center',
                    'right',
                    'top',
                    'middle',
                    'bottom',
                    'horizontal',
                    'vertical',
                    'width',
                    'height',
                  ] as const"
                  :key="action"
                  :disabled="
                    ['horizontal', 'vertical'].includes(action) && selectedRoots.length < 3
                  "
                  @click="arrangeSelection(action)"
                  >{{
                    {
                      left: 'Align left',
                      center: 'Center horizontally',
                      right: 'Align right',
                      top: 'Align top',
                      middle: 'Center vertically',
                      bottom: 'Align bottom',
                      horizontal: 'Distribute horizontally',
                      vertical: 'Distribute vertically',
                      width: 'Match width',
                      height: 'Match height',
                    }[action]
                  }}</AppButton
                >
              </div>
            </fieldset>
            <fieldset v-if="selectedWidget" :disabled="busy">
              <legend>{{ sharedWidgetLabels[selectedWidget.type] }}</legend>
              <div class="shared-widget-actions" role="group" aria-label="Selected widget actions">
                <AppButton type="button" :disabled="selectedIndex <= 0" @click="move(-1)"
                  >Move up</AppButton
                >
                <AppButton
                  type="button"
                  :disabled="selectedIndex >= widgets.length - 1"
                  @click="move(1)"
                  >Move down</AppButton
                >
                <AppButton
                  type="button"
                  :disabled="
                    !repeatable(selectedWidget.type) ||
                    !palette.includes(selectedWidget.type) ||
                    !canAdd(selectedWidget.type)
                  "
                  @click="duplicateWidget"
                  >Duplicate widget</AppButton
                >
                <AppButton
                  type="button"
                  :disabled="selectedWidget.type === requiredType"
                  @click="remove"
                  >Remove widget</AppButton
                >
              </div>
              <small v-if="selectedWidget.type === requiredType">Required for this layout.</small>
              <small v-if="!repeatable(selectedWidget.type)"
                >This tool can appear once per dashboard.</small
              >
              <small v-else>Duplicate copies settings, not saved notes or form entries.</small>
              <label>Title<input v-model="selectedWidget.title" maxlength="100" /></label
              ><label v-if="!selectedWidget.placement"
                >Width<select
                  aria-label="Width"
                  v-model.number="selectedWidget.span"
                  @change="
                    selectedWidget.placement &&
                    updatePlacement('w', $event, selectedWidget.span * 2)
                  "
                >
                  <option :value="12">Full width</option>
                  <option :value="6">Half width</option>
                  <option :value="4">One third</option>
                  <option :value="8">Two thirds</option>
                </select></label
              >

              <label
                ><input
                  type="checkbox"
                  :checked="!!selectedWidget.positionLocked"
                  @change="setLock('positionLocked', ($event.target as HTMLInputElement).checked)"
                />Lock position</label
              >
              <label
                ><input
                  type="checkbox"
                  :checked="!!selectedWidget.sizeLocked"
                  @change="setLock('sizeLocked', ($event.target as HTMLInputElement).checked)"
                />Lock size</label
              >
              <p>
                Drag to move; use edge and corner handles to resize. Shift/Ctrl-click selects
                several widgets. Shift-drag empty canvas selects an area. Arrow keys move; Shift
                takes larger steps.
              </p>
              <p v-if="device !== 'desktop'">Placement edits override {{ device }} only.</p>
              <AppButton
                v-if="device !== 'desktop' && selectedWidget.devices?.[device]"
                @click="resetDevicePlacement"
                >Use desktop placement</AppButton
              >
              <label
                >Container<select
                  aria-label="Container"
                  :value="selectedWidget.parentId || ''"
                  :disabled="geometryLocked(widgets, selectedWidget, 'positionLocked')"
                  @change="changeParent"
                >
                  <option value="">Dashboard root</option>
                  <option v-for="parent in availableParents" :key="parent.id" :value="parent.id">
                    {{ parent.title || 'Container' }}
                  </option>
                </select></label
              >
              <label v-if="selectedWidget.parentId"
                >Container region<select
                  aria-label="Container region"
                  v-model="selectedWidget.region"
                  :disabled="geometryLocked(widgets, selectedWidget, 'positionLocked')"
                >
                  <option
                    v-for="(label, index) in parentRegions(selectedWidget.parentId)"
                    :key="index"
                    :value="String(index)"
                  >
                    {{ label }}
                  </option>
                </select></label
              >
              <template v-if="selectedWidget.container">
                <label
                  >Container type<select
                    aria-label="Container type"
                    :value="selectedWidget.container.kind"
                    @change="changeContainerKind"
                  >
                    <option value="panel">Panel</option>
                    <option value="tabs">Tabs</option>
                    <option value="collapsible">Collapsible section</option>
                    <option value="split">Split view</option>
                  </select></label
                >
                <label v-if="selectedWidget.container.kind === 'tabs'"
                  >Tab labels (one per line)<textarea
                    :value="selectedWidget.container.labels.join('\n')"
                    @change="updateContainerLabels"
                  />
                </label>
                <template v-if="selectedWidget.container.kind === 'split'"
                  ><label
                    >Split direction<select v-model="selectedWidget.container.direction">
                      <option value="row">Side by side</option>
                      <option value="column">Stacked</option>
                    </select></label
                  ><label
                    >First region percent<input
                      type="number"
                      min="10"
                      max="90"
                      v-model.number="selectedWidget.container.ratio" /></label
                ></template>
                <label v-if="selectedWidget.container.kind === 'collapsible'"
                  ><input type="checkbox" v-model="selectedWidget.container.collapsed" />Start
                  collapsed</label
                >
              </template>
              <template v-for="field in ['x', 'y', 'w', 'h'] as const" :key="field">
                <label
                  >{{
                    { x: 'Left column', y: 'Top row', w: 'Width in columns', h: 'Height in rows' }[
                      field
                    ]
                  }}
                  <input
                    type="number"
                    step="any"
                    :value="
                      readPlacement(selectedWidget)?.[field] ??
                      measuredPlacements()[selectedIndex]?.[field]
                    "
                    :disabled="
                      busy ||
                      geometryLocked(
                        widgets,
                        selectedWidget,
                        field === 'x' || field === 'y' ? 'positionLocked' : 'sizeLocked',
                      )
                    "
                    @change="updatePlacement(field, $event)"
                  />
                </label>
              </template>
              <template v-if="selectedWidget.type === 'text'"
                ><label
                  >Text content<textarea
                    ref="textInput"
                    v-model="selectedWidget.text"
                    maxlength="8000"
                  />
                </label>
                <details open>
                  <summary>Insert variable</summary>
                  <p>Click a variable to insert it at the cursor.</p>
                  <AppButton
                    v-for="(label, key) in dashboardTextVariables"
                    :key="key"
                    type="button"
                    @click="insertVariable(key)"
                  >
                    {{ label }}
                  </AppButton>
                </details>
                <p v-if="textResult.unavailable.length">
                  These variables need a context or value: {{ textResult.unavailable.join(', ') }}.
                </p>
                <p v-if="textResult.unknown.length" role="alert">
                  Unsupported variables: {{ textResult.unknown.join(', ') }}.
                </p>
                <label
                  >Font size (px)<input
                    type="number"
                    min="12"
                    max="96"
                    :value="selectedWidget.textStyle?.size || 24"
                    @change="
                      setTextStyle('size', Number(($event.target as HTMLInputElement).value))
                    " /></label
                ><label
                  >Text color<input
                    type="color"
                    :value="selectedWidget.textStyle?.color || defaultTextColor()"
                    @input="
                      setTextStyle('color', ($event.target as HTMLInputElement).value)
                    " /></label
                ><label
                  >Font weight<select
                    aria-label="Font weight"
                    :value="selectedWidget.textStyle?.weight || 400"
                    @change="
                      setTextStyle('weight', Number(($event.target as HTMLSelectElement).value))
                    "
                  >
                    <option :value="400">Regular</option>
                    <option :value="500">Medium</option>
                    <option :value="600">Semibold</option>
                    <option :value="700">Bold</option>
                  </select></label
                ><label
                  >Text alignment<select
                    aria-label="Text alignment"
                    :value="selectedWidget.textStyle?.align || 'left'"
                    @change="setTextStyle('align', ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select></label
                ><label
                  >Line height<input
                    type="number"
                    min="1"
                    max="2.5"
                    step="0.05"
                    :value="selectedWidget.textStyle?.lineHeight || 1.5"
                    @change="
                      setTextStyle('lineHeight', Number(($event.target as HTMLInputElement).value))
                    " /></label></template
              ><label v-if="selectedWidget.type === 'form'"
                >Employee form<select
                  aria-label="Employee form"
                  :disabled="formsLoading || !!formsError || !forms.length"
                  aria-describedby="dashboard-form-picker-status"
                  :value="selectedWidget.form?.templateId || ''"
                  @change="selectForm"
                >
                  <option value="">Choose an issued form</option>
                  <option
                    v-if="
                      selectedWidget.form &&
                      !forms.some((form) => form.id === selectedWidget?.form?.templateId)
                    "
                    :value="selectedWidget.form.templateId"
                    disabled
                  >
                    Current form (not in available choices)
                  </option>
                  <option v-for="form in forms" :key="form.id" :value="form.id">
                    {{ form.definition?.title || form.draft.title }} · v{{ form.latestVersion }}
                  </option>
                </select></label
              ><label v-if="selectedWidget.form"
                >Presentation<select
                  aria-label="Presentation"
                  v-model="selectedWidget.form.presentation"
                >
                  <option value="launcher">Full-page launcher</option>
                  <option value="inline">Inline (up to eight fields)</option>
                </select></label
              >
              <div v-if="selectedWidget.type === 'form'" id="dashboard-form-picker-status">
                <p v-if="formsLoading" role="status">Loading available forms.</p>
                <template v-else-if="formsError">
                  <p role="alert">{{ formsError }}</p>
                  <AppButton type="button" :disabled="busy" @click="loadForms"
                    >Retry forms</AppButton
                  >
                </template>
                <p v-else-if="!forms.length" role="status">
                  No issued forms are available for this dashboard role.
                </p>
              </div>
            </fieldset>
            <p v-else>Select a widget on the canvas or from the list to edit it.</p>
          </aside>
        </div>
        <p class="shared-editor-announcement" role="status" aria-live="polite" aria-atomic="true">
          {{ editorAnnouncement }}
        </p>
        <div
          v-if="dragging"
          class="shared-drag-ghost builder-floating"
          :style="{ left: point.x + 12 + 'px', top: point.y + 12 + 'px' }"
        >
          {{ label }}
        </div>
      </AppLoadingRegion>
      <BuilderConfirmDialog ref="confirm" />
      <Teleport to="body"
        ><div
          v-if="marquee"
          class="dashboard-marquee"
          :style="{
            left: marquee.x + 'px',
            top: marquee.y + 'px',
            width: marquee.w + 'px',
            height: marquee.h + 'px',
          }"
          aria-hidden="true"
      /></Teleport>
    </section>
  </AppShell>
</template>
