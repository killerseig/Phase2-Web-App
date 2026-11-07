<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppLoadingIndicator from '@/components/common/AppLoadingIndicator.vue'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DashboardAnnouncements from './DashboardAnnouncements.vue'
import DashboardAnnouncementDrafts from './DashboardAnnouncementDrafts.vue'
import DashboardPersonalTasks from './DashboardPersonalTasks.vue'
import DashboardJobInformation from './DashboardJobInformation.vue'
import DashboardCalendarAgenda from './DashboardCalendarAgenda.vue'
import DashboardWorkflowsWidget from './DashboardWorkflowsWidget.vue'
import CompanyLibraryWidget from './CompanyLibraryWidget.vue'
import DashboardJobsWidget from './DashboardJobsWidget.vue'
import DashboardSnapGrid from './DashboardSnapGrid.vue'
import DashboardSelectionFrame from './DashboardSelectionFrame.vue'
import RoleResourcesModule from './RoleResourcesModule.vue'
import {
  sharedWidgetLabels,
  type SharedDashboardWidget,
  type SharedDashboardJob,
  type SharedDashboardScope,
  type SharedCalendarEntry,
} from '@/features/dashboard/sharedDashboards'
import { resolveDashboardText, type DashboardTextContext } from '@/features/dashboard/sharedText'
import { fallbackPlacements } from '@/features/dashboard/widgetPlacement'
import {
  bounds as geometryBounds,
  rootSelection,
  locked as geometryLocked,
  type Direction,
} from '@/features/dashboard/editorGeometry'
import type { WidgetDrop } from '@/features/dashboard/useWidgetDrag'
import type { JobRecord, RawRoleKey } from '@/types/domain'
const SharedDashboardForm = defineAsyncComponent(() => import('./SharedDashboardForm.vue'))
const props = defineProps<{
  scope: SharedDashboardScope
  widgets: SharedDashboardWidget[]
  job: SharedDashboardJob | null
  jobs: JobRecord[]
  initialToolJobId?: string
  jobsLoading?: boolean
  jobsError?: string | null
  canCreateJobs?: boolean
  canManageJobs?: boolean
  editableJobIds?: string[]
  publishedDraftIds?: string[]
  announcementDrafts?: import('@/features/dashboard/sharedDashboards').AnnouncementDraft[]
  tasks?: import('@/features/dashboard/sharedDashboards').PersonalTask[]
  notes: Record<string, string>
  events: SharedCalendarEntry[]
  role: RawRoleKey
  resourceRole?: RawRoleKey
  textContext: DashboardTextContext
  editing: boolean
  editorScale?: number
  gridVisible?: boolean
  placementPreview?: SharedDashboardWidget['placement']
  dropTarget?: WidgetDrop
  dropInvalid?: boolean
  selected: string
  canEditNotes: boolean
  busy: boolean
  phone?: boolean
  device?: 'desktop' | 'tablet' | 'phone'
  fixedFrame?: boolean
  parentId?: string
  selectionHost?: HTMLElement
  region?: string
  tabLabelId?: string
  selectedIds?: string[]
  gridSpacing?: { x: number; y: number; majorEvery?: number }
  placementPreviews?: Record<string, NonNullable<SharedDashboardWidget['placement']>>
}>()
const visibleWidgets = computed(() =>
  props.widgets.filter(
    (w) =>
      (w.parentId || '') === (props.parentId || '') && (w.region || '0') === (props.region || '0'),
  ),
)
const targeted = computed(() => props.editing && props.dropTarget?.surface === (props.parentId || 'shared-dashboard') &&
  (props.dropTarget.region || '0') === (props.region || '0'))
const positioned = computed(() =>
  visibleWidgets.value.some(
    (widget) =>
      widget.placement ||
      (props.device && props.device !== 'desktop' && widget.devices?.[props.device]),
  ),
)
const positions = computed(() =>
  fallbackPlacements(
    visibleWidgets.value.map((w) => ({
      ...w,
      placement:
        props.placementPreviews?.[w.id] ||
        (props.device && props.device !== 'desktop'
          ? w.devices?.[props.device] || w.placement
          : w.placement),
    })),
  ),
)
const canvasStyle = computed(() => {
  return {
    minHeight: positioned.value
      || (props.editing && !visibleWidgets.value.length)
      ? Math.max(
          props.editing ? (props.parentId ? 200 : 960) : 0,
          ...positions.value.map((p) => (p.y + p.h) * 32 + 64),
          targeted.value && props.placementPreview && !props.dropInvalid
            ? (props.placementPreview.y + props.placementPreview.h) * 32 + 64 : 0,
        ) + 'px'
      : undefined,
  }
})
const canvasElement = ref<HTMLElement>()
const selectionOverlay = ref<HTMLElement>()
const selectionTarget = computed(() => props.selectionHost || selectionOverlay.value)
const projectedSelection = ref<SelectionGeometry>()
const selectionClip = ref<string>()
const selectionClipBounds = ref<{ left: number; top: number; right: number; bottom: number }>()
function focusVisibleCanvas() {
  selectionTarget.value?.closest<HTMLElement>('[data-widget-scroll]')?.focus({ preventScroll: true })
}
type SelectionGeometry = NonNullable<SharedDashboardWidget['placement']>
const measuredSelection = ref<SelectionGeometry>()
const selectionWidgets = computed(() => {
  if (!props.editing) return []
  const roots = rootSelection(props.widgets, props.selectedIds || [props.selected])
  return roots.length > 0 &&
    roots.every(
      (widget) =>
        (widget.parentId || '') === (props.parentId || '') &&
        (widget.region || '0') === (props.region || '0'),
    )
    ? roots
    : []
})
const selectionPrimary = computed(
  () =>
    selectionWidgets.value.find((widget) => widget.id === props.selected)?.id ||
    selectionWidgets.value[0]?.id ||
    '',
)
const selectionGeometry = computed(() => {
  if (!selectionWidgets.value.length) return undefined
  if (!positioned.value) return measuredSelection.value
  const ids = new Set(selectionWidgets.value.map((widget) => widget.id))
  return geometryBounds(
    positions.value.filter((_, index) => ids.has(visibleWidgets.value[index]!.id)),
  )
})
const displayedSelection = computed(() =>
  props.parentId ? projectedSelection.value : selectionGeometry.value,
)
const selectionMoveDisabled = computed(
  () =>
    props.busy ||
    selectionWidgets.value.some((widget) =>
      geometryLocked(props.widgets, widget, 'positionLocked'),
    ),
)
const selectionResizeDisabled = computed(
  () =>
    props.busy ||
    (selectionWidgets.value.length > 1 && selectionMoveDisabled.value) ||
    selectionWidgets.value.some((widget) => geometryLocked(props.widgets, widget, 'sizeLocked')),
)
let selectionObserver: ResizeObserver | undefined
let selectionFrame = 0
const observedWidgets = new Set<HTMLElement>()
function updateMeasuredSelection(next?: SelectionGeometry) {
  const previous = measuredSelection.value
  if (
    (!previous && !next) ||
    (previous &&
      next &&
      (['x', 'y', 'w', 'h'] as const).every((key) => Math.abs(previous[key] - next[key]) < 0.0001))
  )
    return
  measuredSelection.value = next
}
function measureSelection() {
  selectionFrame = 0
  projectSelection()
  const host = canvasElement.value
  if (!host) return
  const measuring = !positioned.value && selectionWidgets.value.length > 0
  const children = measuring
    ? [...host.querySelectorAll<HTMLElement>(':scope > [data-widget-id]')]
    : []
  for (const child of observedWidgets) {
    if (!children.includes(child)) {
      selectionObserver?.unobserve(child)
      observedWidgets.delete(child)
    }
  }
  for (const child of children) {
    if (!observedWidgets.has(child)) {
      selectionObserver?.observe(child)
      observedWidgets.add(child)
    }
  }
  const hostRect = host.getBoundingClientRect()
  if (!measuring || !hostRect.width || !host.offsetWidth) {
    updateMeasuredSelection()
    return
  }
  const scale = hostRect.width / host.offsetWidth
  const ids = new Set(selectionWidgets.value.map((widget) => widget.id))
  const rectangles = children
    .filter((child) => ids.has(child.dataset.widgetId!))
    .map((child) => {
      const rect = child.getBoundingClientRect()
      return {
        x: (((rect.left - hostRect.left) / scale + host.scrollLeft) / host.clientWidth) * 24,
        y: ((rect.top - hostRect.top) / scale + host.scrollTop) / 32,
        w: (rect.width / scale / host.clientWidth) * 24,
        h: rect.height / scale / 32,
      }
    })
  updateMeasuredSelection(rectangles.length === ids.size ? geometryBounds(rectangles) : undefined)
}
function projectSelection() {
  const geometry = selectionGeometry.value,
    source = canvasElement.value,
    target = selectionTarget.value
  if (!geometry || !source || !target) {
    projectedSelection.value = undefined
    return
  }
  const from = source.getBoundingClientRect(),
    to = target.getBoundingClientRect()
  if (!from.width || !from.height || !to.width || !target.offsetWidth) {
    projectedSelection.value = undefined
    return
  }
  const scale = to.width / target.offsetWidth
  const sourceScale = from.width / source.offsetWidth
  const next = {
    x:
      ((from.left -
        to.left +
        ((geometry.x / 24) * source.clientWidth - source.scrollLeft) * sourceScale) /
        to.width) *
      24,
    y: (from.top - to.top + (geometry.y * 32 - source.scrollTop) * sourceScale) / scale / 32,
    w: (geometry.w * source.clientWidth * sourceScale) / to.width,
    h: (geometry.h * sourceScale) / scale,
  }
  // Escaping layer stacks must not expose controls for content hidden by a
  // scrolling/collapsed ancestor. Clip in the root overlay's coordinate space.
  let left = -100000,
    top = -100000,
    right = 100000,
    bottom = 100000,
    clipped = false
  const root = target.parentElement
  for (
    let element: HTMLElement | null = source;
    element && element !== root;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element),
      rect = element.getBoundingClientRect()
    const elementScale = rect.width / element.offsetWidth || scale
    if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
      left = Math.max(left, rect.left + element.clientLeft * elementScale)
      right = Math.min(right, rect.left + (element.clientLeft + element.clientWidth) * elementScale)
      clipped = true
    }
    if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
      top = Math.max(top, rect.top + element.clientTop * elementScale)
      bottom = Math.min(
        bottom,
        rect.top + (element.clientTop + element.clientHeight) * elementScale,
      )
      clipped = true
    }
  }
  selectionClip.value = clipped
    ? `inset(${(top - to.top) / scale}px ${(to.right - right) / scale}px ${(to.bottom - bottom) / scale}px ${(left - to.left) / scale}px)`
    : undefined
  const clipBounds = clipped ? { left, top, right, bottom } : undefined
  if (JSON.stringify(selectionClipBounds.value) !== JSON.stringify(clipBounds))
    selectionClipBounds.value = clipBounds
  const previous = projectedSelection.value
  if (
    !previous ||
    (['x', 'y', 'w', 'h'] as const).some((key) => Math.abs(previous[key] - next[key]) > 0.0001)
  )
    projectedSelection.value = next
}
// Only the selected canvas observes screen geometry. This also follows ancestor
// scrolling/panning/transforms, which ResizeObserver alone cannot observe.
let projectionFrame = 0
function followSelection() {
  projectionFrame = 0
  projectSelection()
  if (props.editing && selectionWidgets.value.length)
    projectionFrame = requestAnimationFrame(followSelection)
}
watch(
  [selectionWidgets, selectionTarget],
  () => {
    if (!projectionFrame && typeof requestAnimationFrame !== 'undefined')
      projectionFrame = requestAnimationFrame(followSelection)
  },
  { flush: 'post' },
)
function scheduleSelectionMeasurement() {
  if (props.editing && !selectionFrame && typeof requestAnimationFrame !== 'undefined')
    selectionFrame = requestAnimationFrame(measureSelection)
}
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  selectionObserver = new ResizeObserver(scheduleSelectionMeasurement)
  if (canvasElement.value) selectionObserver.observe(canvasElement.value)
  scheduleSelectionMeasurement()
})
watch([selectionWidgets, positions, positioned], scheduleSelectionMeasurement, {
  deep: true,
  flush: 'post',
})
onBeforeUnmount(() => {
  selectionObserver?.disconnect()
  observedWidgets.clear()
  if (selectionFrame) cancelAnimationFrame(selectionFrame)
  if (projectionFrame) cancelAnimationFrame(projectionFrame)
})
function requestMenu(event: MouseEvent | KeyboardEvent, id: string) {
  if (!props.editing) return
  event.preventDefault()
  event.stopPropagation()
  emit('request-menu', event, id)
}
function widgetKey(event: KeyboardEvent, id: string) {
  if (event.target !== event.currentTarget) return
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) requestMenu(event, id)
  else if (props.editing && !props.busy && !event.altKey && ['Enter', ' '].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
    emit('select', id, event)
  }
}
function canvasClick(event: MouseEvent) {
  if (!props.editing) return
  const widget = (event.target as HTMLElement).closest('[data-widget-id]')
  // A blank nested canvas belongs to this surface, not its ancestor widget.
  if (!widget || widget.closest('[data-widget-surface]') !== event.currentTarget)
    event.stopPropagation()
}
function startWidgetMove(event: PointerEvent, id: string) {
  if (
    !props.editing ||
    props.busy ||
    event.button !== 0 ||
    (event.target as HTMLElement).closest('button,input,select,textarea,a,[contenteditable]')
  )
    return
  if (event.shiftKey || event.ctrlKey || event.metaKey) return
  if (geometryLocked(props.widgets, props.widgets.find((w) => w.id === id)!, 'positionLocked'))
    return
  emit('move', event, id)
}
function widgetStyle(widget: SharedDashboardWidget, index: number) {
  const p = positions.value[index]!
  return positioned.value
    ? {
        position: 'absolute' as const,
        left: (p.x / 24) * 100 + '%',
        top: p.y * 32 + 'px',
        width: (p.w / 24) * 100 + '%',
        height: p.h * 32 + 'px',
        boxSizing: 'border-box' as const,
        zIndex: index,
      }
    : { '--widget-span': widget.span }
}
const emit = defineEmits<{
  select: [id: string, event?: MouseEvent | PointerEvent | KeyboardEvent]
  edit: [id: string]
  resize: [event: PointerEvent, id: string, direction?: Direction]
  move: [event: PointerEvent, id: string]
  'selection-move': [event: PointerEvent, id: string]
  'selection-resize': [event: PointerEvent, id: string, direction: Direction]
  'selection-key': [
    event: KeyboardEvent,
    id: string,
    action: 'move' | 'resize',
    direction?: Direction,
  ]
  'request-menu': [event: MouseEvent | KeyboardEvent, id: string]
  'save-note': [id: string, text: string]
  'publish-announcement': [draftId: string]
  'save-announcement-drafts': [
    items: import('@/features/dashboard/sharedDashboards').AnnouncementDraft[],
  ]
  'save-tasks': [tasks: import('@/features/dashboard/sharedDashboards').PersonalTask[]]
  'save-calendar': [events: SharedCalendarEntry[]]
}>()
type NavigationParticipant = { prepareNavigation: () => boolean | Promise<boolean> }
const forms = ref<NavigationParticipant[]>([])
type ContentAction = 'save-notes' | 'save-calendar' | 'save-tasks' | 'save-announcement-drafts'
type ChildCanvas = {
  notesDirty: boolean
  discardNotes: () => void
  finishNote: (action: ContentAction, id?: string) => void
  prepareForms: () => Promise<boolean>
}
const childCanvases = ref<ChildCanvas[]>([])
const activeTabs = ref<Record<string, string>>({}),
  collapsed = ref<Record<string, boolean>>({})
function regions(widget: SharedDashboardWidget) {
  return widget.container?.kind === 'split'
    ? ['0', '1']
    : widget.container?.kind === 'tabs'
      ? widget.container.labels.map((_, i) => String(i))
      : ['0']
}
watch(
  () => props.selected,
  (id) => {
    let child = props.widgets.find((w) => w.id === id)
    const seen = new Set<string>()
    while (child?.parentId && !seen.has(child.id)) {
      seen.add(child.id)
      activeTabs.value[child.parentId] = child.region || '0'
      collapsed.value[child.parentId] = false
      child = props.widgets.find((w) => w.id === child!.parentId)
    }
  },
  { immediate: true },
)
function navigateTab(event: KeyboardEvent, widget: SharedDashboardWidget, index: number) {
  const count = widget.container!.labels.length
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? count - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % count
          : event.key === 'ArrowLeft'
            ? (index + count - 1) % count
            : -1
  if (next < 0) return
  event.preventDefault()
  activeTabs.value[widget.id] = String(next)
  const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
    '[role="tab"]',
  )
  tabs?.[next]?.focus()
}
const libraries = ref<NavigationParticipant[]>([])
const resources = ref<NavigationParticipant[]>([])
const announcementEditors = ref<InstanceType<typeof DashboardAnnouncementDrafts>[]>([])
const announcementsEditing = computed(() =>
  announcementEditors.value.some((editor) => editor.editing),
)
const taskEditors = ref<InstanceType<typeof DashboardPersonalTasks>[]>([])
const tasksEditing = computed(() => taskEditors.value.some((editor) => editor.editing))
const noteId = ref(''),
  noteText = ref(''),
  calendarEditing = ref(false),
  calendarDraft = ref<SharedCalendarEntry[]>([]),
  toolJobId = ref(props.initialToolJobId || '')
watch(
  () => props.initialToolJobId,
  (id) => {
    toolJobId.value = id || ''
  },
)
const notesDirty = computed(
  () =>
    childCanvases.value.some((child) => child.notesDirty) ||
    announcementEditors.value.some((editor) => editor.dirty) ||
    taskEditors.value.some((editor) => editor.dirty) ||
    (!!noteId.value && noteText.value !== (props.notes[noteId.value] || '')) ||
    (calendarEditing.value && JSON.stringify(calendarDraft.value) !== JSON.stringify(props.events)),
)
const toolJob = computed(() => props.job || props.jobs.find((job) => job.id === toolJobId.value))
function beginNote(id: string) {
  if (
    !props.canEditNotes ||
    props.busy ||
    noteId.value ||
    calendarEditing.value ||
    tasksEditing.value ||
    announcementsEditing.value
  )
    return
  noteId.value = id
  noteText.value = props.notes[id] || ''
}
function cancelNote() {
  childCanvases.value.forEach((child) => child.discardNotes())
  announcementEditors.value.forEach((editor) => editor.discard())
  taskEditors.value.forEach((editor) => editor.discard())
  noteId.value = ''
  noteText.value = ''
  calendarEditing.value = false
  calendarDraft.value = []
}
function cancelLocalNote() {
  noteId.value = ''
  noteText.value = ''
}
function cancelLocalCalendar() {
  calendarEditing.value = false
  calendarDraft.value = []
}
function finishNote(action: ContentAction, id?: string) {
  childCanvases.value.forEach((child) => child.finishNote(action, id))
  if (action === 'save-notes' && noteId.value === id) {
    noteId.value = ''
    noteText.value = ''
  }
  if (action === 'save-calendar') {
    calendarEditing.value = false
    calendarDraft.value = []
  }
  if (action === 'save-tasks') taskEditors.value.forEach((editor) => editor.discard())
  if (action === 'save-announcement-drafts')
    announcementEditors.value.forEach((editor) => editor.discard())
}
function editCalendar() {
  calendarDraft.value = JSON.parse(JSON.stringify(props.events))
  calendarEditing.value = true
}
function addDate() {
  calendarDraft.value.push({ id: crypto.randomUUID(), title: '', date: '' })
}
defineExpose({
  notesDirty,
  discardNotes: cancelNote,
  finishNote,
  prepareForms: async () => {
    for (const child of childCanvases.value) if (!(await child.prepareForms())) return false
    for (const child of [...forms.value, ...libraries.value, ...resources.value])
      if (!(await child.prepareNavigation())) return false
    return true
  },
})
const dates = computed(() =>
  [
    ...(props.scope === 'job' && props.job?.startDate
      ? [{ id: 'job-start', title: 'Job start', date: props.job.startDate }]
      : []),
    ...(props.scope === 'job' && props.job?.finishDate
      ? [{ id: 'job-finish', title: 'Job finish', date: props.job.finishDate }]
      : []),
    ...props.events,
  ].sort((a, b) => a.date.localeCompare(b.date)),
)
function textStyle(widget: SharedDashboardWidget) {
  const style = widget.textStyle
  return style
    ? {
        fontSize: style.size + 'px',
        color: style.color,
        fontWeight: style.weight,
        textAlign: style.align,
        lineHeight: style.lineHeight,
      }
    : undefined
}
</script>
<template>
  <div
    ref="canvasElement"
    class="shared-dashboard-grid"
    :style="canvasStyle"
    :class="{
      'is-grid-visible': gridVisible,
      'is-positioned': positioned,
      'is-placement-editor': editing,
      'is-nested': parentId,
      'phone-preview': phone,
      'has-phone-placement': fixedFrame || visibleWidgets.some((w) => w.devices?.phone),
      'is-empty-editor': editing && !visibleWidgets.length,
      'is-drop-target': targeted,
      'is-drop-invalid': targeted && dropInvalid,
    }"
    :data-widget-surface="parentId || 'shared-dashboard'"
    :data-region="region || '0'"
    @click="canvasClick"
    :role="tabLabelId ? 'tabpanel' : undefined"
    :aria-labelledby="tabLabelId"
  >
    <DashboardSnapGrid v-if="editing && gridVisible" :spacing="gridSpacing" :layout="positions" />
    <span
      v-if="editing && !parentId"
      class="shared-dashboard-origin"
      data-dashboard-origin
      aria-hidden="true"
    >
      <span>0,0</span>
    </span>
    <div v-if="editing && !parentId" ref="selectionOverlay" class="dashboard-selection-overlay" />
    <Teleport v-if="selectionTarget && displayedSelection" :to="selectionTarget">
      <div
        class="dashboard-selection-clip"
        :style="{ clipPath: parentId ? selectionClip : undefined }"
      >
        <DashboardSelectionFrame
          :geometry="displayedSelection"
          :disable-move="selectionMoveDisabled"
          :disable-resize="selectionResizeDisabled"
          :position-locked="selectionMoveDisabled"
          :widget-title="
            selectionWidgets.length === 1
              ? selectionWidgets[0]!.title || sharedWidgetLabels[selectionWidgets[0]!.type]
              : undefined
          "
          :scale="editorScale"
          :clip-bounds="parentId ? selectionClipBounds : undefined"
          @focus-hidden="focusVisibleCanvas"
          @move="emit('selection-move', $event, selectionPrimary)"
          @resize="
            (event, direction) => emit('selection-resize', event, selectionPrimary, direction)
          "
          @key="
            (event, action, direction) =>
              emit('selection-key', event, selectionPrimary, action, direction)
          "
        />
      </div>
    </Teleport>
    <div
      v-if="targeted && placementPreview && !dropInvalid"
      data-widget-placement-preview
      aria-hidden="true"
      :style="{
        left: (placementPreview.x / 24) * 100 + '%',
        top: placementPreview.y * 32 + 'px',
        width: (placementPreview.w / 24) * 100 + '%',
        height: placementPreview.h * 32 + 'px',
      }"
    />
    <div v-if="editing && !visibleWidgets.length" class="shared-empty-canvas">
      <h2>Start your dashboard</h2>
      <p>Drag a widget here, or choose one from the widget library.</p>
    </div>
    <article
      v-for="(widget, widgetIndex) in visibleWidgets"
      :key="widget.id"
      :data-widget-id="widget.id"
      :data-container-kind="widget.container?.kind"
      class="shared-dashboard-widget"
      :tabindex="editing ? 0 : undefined"
      :aria-label="
        editing ? 'Widget ' + (widget.title || sharedWidgetLabels[widget.type]) : undefined
      "
      :aria-keyshortcuts="editing ? 'Enter Space Escape ArrowLeft ArrowRight ArrowUp ArrowDown Shift+F10' : undefined"
      @pointerdown.stop="startWidgetMove($event, widget.id)"
      @contextmenu="requestMenu($event, widget.id)"
      @keydown="widgetKey($event, widget.id)"
      :class="{
        'is-selected': editing && (selectedIds || [selected]).includes(widget.id),
        'is-container': widget.type === 'container',
      }"
      :data-drop-edge="
        editing &&
        !placementPreview &&
        dropTarget?.surface === 'shared-dashboard' &&
        dropTarget.overId === widget.id
          ? dropTarget.edge
          : undefined
      "
      :style="widgetStyle(widget, widgetIndex)"
      @click.stop="editing && emit('select', widget.id, $event)"
    >
      <header class="shared-widget-heading">
        <h2>{{ widget.title || sharedWidgetLabels[widget.type] }}</h2>
        <span
          v-if="
            editing &&
            (geometryLocked(widgets, widget, 'positionLocked') ||
              geometryLocked(widgets, widget, 'sizeLocked'))
          "
          class="shared-widget-locks"
        >
          <span
            v-if="geometryLocked(widgets, widget, 'positionLocked')"
            class="shared-widget-lock-badge"
            :title="widget.positionLocked ? 'Position locked' : 'Position locked by a parent'"
            ><span aria-hidden="true">🔒</span>Position locked</span
          >
          <span
            v-if="geometryLocked(widgets, widget, 'sizeLocked')"
            class="shared-widget-lock-badge"
            :title="widget.sizeLocked ? 'Size locked' : 'Size locked by a parent'"
            ><span aria-hidden="true">🔒</span>Size locked</span
          >
        </span>
        <AppButton
          v-if="editing"
          class="shared-widget-edit builder-floating"
          :disabled="busy"
          :aria-label="`Edit ${widget.title || sharedWidgetLabels[widget.type]}`"
          @click.stop="emit('edit', widget.id)"
          >Edit</AppButton
        >
        <AppButton
          v-if="editing"
          class="shared-widget-move builder-floating"
          type="button"
          :disabled="busy || geometryLocked(widgets, widget, 'positionLocked')"
          :aria-label="`Move ${widget.title || sharedWidgetLabels[widget.type]}`"
          @pointerdown.stop="emit('move', $event, widget.id)"
          @click.stop="emit('select', widget.id)"
        >
          Move
        </AppButton>
      </header>
      <div v-if="widget.container" class="shared-container-content">
        <div
          v-if="widget.container.kind === 'tabs'"
          role="tablist"
          :aria-label="widget.title || 'Container tabs'"
          class="shared-container-tabs"
        >
          <AppButton
            v-for="(tab, index) in widget.container.labels"
            :key="index"
            role="tab"
            :id="`tab-${widget.id}-${index}`"
            :aria-controls="`region-${widget.id}-${index}`"
            :tabindex="(activeTabs[widget.id] || '0') === String(index) ? 0 : -1"
            :aria-selected="(activeTabs[widget.id] || '0') === String(index)"
            @keydown="navigateTab($event, widget, index)"
            @click.stop="activeTabs[widget.id] = String(index)"
            >{{ tab }}</AppButton
          >
        </div>
        <AppButton
          v-if="widget.container.kind === 'collapsible'"
          :aria-expanded="!(collapsed[widget.id] ?? widget.container.collapsed)"
          @click.stop="collapsed[widget.id] = !(collapsed[widget.id] ?? widget.container.collapsed)"
          >{{ (collapsed[widget.id] ?? widget.container.collapsed) ? 'Expand' : 'Collapse' }}
          {{ widget.title || 'section' }}</AppButton
        >
        <div
          v-show="
            editing ||
            widget.container.kind !== 'collapsible' ||
            !(collapsed[widget.id] ?? widget.container.collapsed)
          "
          :class="['shared-container-regions', { 'is-split': widget.container.kind === 'split' }]"
          :style="
            widget.container.kind === 'split'
              ? {
                  display: 'grid',
                  [widget.container.direction === 'row'
                    ? 'gridTemplateColumns'
                    : 'gridTemplateRows']:
                    `${widget.container.ratio}fr ${100 - widget.container.ratio}fr`,
                }
              : undefined
          "
        >
          <SharedDashboardCanvas
            v-for="slot in regions(widget)"
            :key="slot"
            ref="childCanvases"
            v-show="widget.container.kind !== 'tabs' || (activeTabs[widget.id] || '0') === slot"
            v-bind="props"
            :selection-host="selectionTarget"
            :parent-id="widget.id"
            :region="slot"
            :id="`region-${widget.id}-${slot}`"
            :tab-label-id="
              widget.container.kind === 'tabs' ? `tab-${widget.id}-${slot}` : undefined
            "
            @select="(id, event) => emit('select', id, event)"
            @edit="emit('edit', $event)"
            @resize="(event, id, direction) => emit('resize', event, id, direction)"
            @move="(event, id) => emit('move', event, id)"
            @selection-move="(event, id) => emit('selection-move', event, id)"
            @selection-resize="
              (event, id, direction) => emit('selection-resize', event, id, direction)
            "
            @selection-key="
              (event, id, action, direction) => emit('selection-key', event, id, action, direction)
            "
            @request-menu="(event, id) => emit('request-menu', event, id)"
            @save-note="(id, text) => emit('save-note', id, text)"
            @save-calendar="emit('save-calendar', $event)"
            @save-tasks="emit('save-tasks', $event)"
            @publish-announcement="emit('publish-announcement', $event)"
            @save-announcement-drafts="emit('save-announcement-drafts', $event)"
          />
        </div>
      </div>
      <div
        v-else-if="widget.type === 'text'"
        class="shared-variable-text"
        :style="textStyle(widget)"
      >
        {{ resolveDashboardText(widget.text, textContext).text }}
      </div>
      <template v-else-if="widget.type === 'workflows'">
        <AppLoadingIndicator
          v-if="scope !== 'job' && !editing && jobsLoading"
          inline
          label="Loading jobs for tools."
        />
        <p v-else-if="scope !== 'job' && !editing && jobsError" role="alert">
          Jobs could not be loaded. {{ jobsError }} Use Refresh to try again.
        </p>
        <p v-else-if="scope !== 'job' && !editing && !jobs.length">
          No jobs are available for your account.
        </p>
        <label v-else-if="scope !== 'job' && !editing" class="shared-widget-tools"
          >Choose job for tools<select v-model="toolJobId">
            <option value="">Choose a job</option>
            <option v-for="entry in jobs" :key="entry.id" :value="entry.id">
              {{ entry.code }} · {{ entry.name }}
            </option>
          </select></label
        >
        <DashboardWorkflowsWidget
          v-if="toolJob && (scope === 'job' || (!jobsLoading && !jobsError))"
          :job-id="toolJob.id"
          :scope="scope"
          :editing="editing"
        />
        <p v-else-if="!jobsLoading && !jobsError && (scope === 'job' || jobs.length || editing)">
          Choose a job to open Timecards, Daily Logs, Shop Orders, Company Library and available
          forms.
        </p>
      </template>
      <DashboardJobInformation
        v-else-if="widget.type === 'job-info'"
        :job="job"
        :jobs="jobs"
        :loading="jobsLoading"
        :error="jobsError"
        :editing="editing"
        :job-scope="scope === 'job'"
      />
      <DashboardJobsWidget
        v-else-if="widget.type === 'jobs'"
        :scope="scope"
        :job-id="job?.id"
        :can-create-jobs="canCreateJobs"
        :can-manage-jobs="canManageJobs"
        :editable-job-ids="editableJobIds"
        :jobs="jobs"
        :editing="editing"
        :jobs-loading="jobsLoading"
        :jobs-error="jobsError"
      />
      <div v-else-if="widget.type === 'dates'" class="shared-widget-tools">
        <p v-if="editing">
          Calendar entries stay separate for each
          {{ scope === 'job' ? 'job' : 'signed-in person' }}.
        </p>
        <form v-else-if="calendarEditing" @submit.prevent="emit('save-calendar', calendarDraft)">
          <div
            v-for="(entry, index) in calendarDraft"
            :key="entry.id"
            class="shared-calendar-entry"
          >
            <label
              >Event title<input
                v-model="entry.title"
                required
                maxlength="200"
                :disabled="busy" /></label
            ><label>Date<input v-model="entry.date" type="date" required :disabled="busy" /></label
            ><AppButton
              type="button"
              :disabled="busy"
              :aria-label="`Remove calendar date ${index + 1}`"
              @click="calendarDraft.splice(index, 1)"
            >
              Remove
            </AppButton>
          </div>
          <AppButton type="button" :disabled="busy || calendarDraft.length >= 100" @click="addDate">
            Add date</AppButton
          ><AppButton variant="primary" type="submit" :disabled="busy">Save calendar</AppButton
          ><AppButton type="button" :disabled="busy" @click="cancelLocalCalendar"
            >Cancel calendar</AppButton
          >
        </form>
        <template v-else
          ><DashboardCalendarAgenda :events="dates" />
          <AppButton
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId || tasksEditing || announcementsEditing"
            @click="editCalendar"
          >
            Edit calendar
          </AppButton></template
        >
      </div>
      <DashboardAnnouncements
        v-else-if="widget.type === 'announcements'"
        :scope="scope"
        :job-id="job?.id"
        :jobs="jobs"
        :layout-editing="editing"
      />
      <DashboardAnnouncementDrafts
        v-else-if="
          widget.type === 'announcement-drafts' && scope === 'personal' && role === 'admin'
        "
        ref="announcementEditors"
        :items="announcementDrafts || []"
        :jobs="jobs"
        :published-draft-ids="publishedDraftIds || []"
        @publish="emit('publish-announcement', $event)"
        :busy="busy || !!noteId || calendarEditing || tasksEditing"
        :layout-editing="editing"
        @save="emit('save-announcement-drafts', $event)"
      />
      <DashboardPersonalTasks
        v-else-if="widget.type === 'tasks' && scope === 'personal'"
        ref="taskEditors"
        :items="tasks || []"
        :busy="busy || !!noteId || calendarEditing || announcementsEditing"
        :layout-editing="editing"
        @save="emit('save-tasks', $event)"
      />
      <div v-else-if="widget.type === 'notes'" class="shared-widget-tools">
        <p v-if="editing">
          Notes stay separate for each {{ scope === 'job' ? 'job' : 'signed-in person' }}.
        </p>
        <form
          v-else-if="noteId === widget.id"
          @submit.prevent="emit('save-note', widget.id, noteText)"
        >
          <label :for="'dashboard-note-' + widget.id"
            >{{ scope === 'job' ? 'Job notes' : 'Your notes'
            }}<textarea
              :id="'dashboard-note-' + widget.id"
              v-model="noteText"
              maxlength="8000"
              :disabled="busy"
            /></label
          ><AppButton variant="primary" type="submit" :disabled="busy || !notesDirty"
            >Save notes</AppButton
          ><AppButton type="button" :disabled="busy" @click="cancelLocalNote"
            >Cancel notes</AppButton
          >
        </form>
        <template v-else
          ><p class="shared-note-text">{{ notes[widget.id] || 'No notes yet.' }}</p>
          <AppButton
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId || calendarEditing || tasksEditing || announcementsEditing"
            @click="beginNote(widget.id)"
          >
            Edit notes
          </AppButton></template
        >
      </div>
      <template v-else-if="editing"
        ><p>
          {{ sharedWidgetLabels[widget.type] }} appears here when you finish editing the template.
        </p></template
      >
      <p
        v-else-if="
          scope === 'job' && !job && (widget.type === 'form' || widget.type === 'documents')
        "
      >
        Choose a job to use {{ sharedWidgetLabels[widget.type].toLowerCase() }}.
      </p>
      <CompanyLibraryWidget
        ref="libraries"
        v-else-if="widget.type === 'documents'"
        :key="scope === 'job' ? job?.id : 'role-documents'"
        class="shared-library-widget"
        :show-heading="false"
      />
      <RoleResourcesModule
        ref="resources"
        v-else-if="widget.type === 'resources'"
        :key="resourceRole || role"
        :fixed-role="resourceRole || role"
      />
      <SharedDashboardForm
        v-else-if="widget.type === 'form'"
        ref="forms"
        :widget="widget"
        :scope="scope"
        :can-respond="['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role)"
        :job-id="scope === 'job' ? job?.id : undefined"
      />
    </article>
  </div>
</template>

<style scoped>
.shared-widget-locks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}
.shared-widget-lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border: 1px solid #46c4ff80;
  border-radius: 5px;
  background: #111925;
  color: #bef5ff;
  font-size: 10px;
  line-height: 1.3;
}
</style>
