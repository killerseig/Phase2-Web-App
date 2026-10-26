import { computed, watch, type Ref } from 'vue'
import { descendants, canContain, layoutLocked } from './containers'
import { arrangeSelection, arrangementActions } from './arrangement'
import { selectionBounds, type GeometryMap } from './selection'
import { materializeGrid, resizeWithFollowing, type WidgetGeometry } from './grid'
import {
  newSection,
  sectionLabels,
  type WebsitePage,
  type WebsiteSection,
  type WebsiteDevice,
  type SectionType,
} from './types'
import type { ElementTarget } from './textBox'

export function useWebsiteWidgetEditing(options: {
  page: Readonly<Ref<WebsitePage | undefined>>
  section: Readonly<Ref<WebsiteSection | undefined>>
  selectedSection: Ref<string>
  selectedIds: Ref<string[]>
  selectedText: Ref<ElementTarget | undefined>
  settingsPanel: Ref<'site' | 'page'>
  activePane: Ref<'outline' | 'preview' | 'inspector'>
  locked: Readonly<Ref<boolean>>
  designMode: Readonly<Ref<boolean>>
  geometryEditable: Readonly<Ref<boolean>>
  device: Ref<WebsiteDevice>
  history: { change: (operation: () => void) => void }
  cancelDrag: () => void
  focusArrangement: () => void
}) {
  const {
    page,
    section,
    selectedSection,
    selectedIds,
    selectedText,
    settingsPanel,
    activePane,
    locked,
    designMode,
    geometryEditable,
    device,
    history,
  } = options
  const selectedWidgets = computed(
    () => page.value?.sections.filter((entry) => selectedIds.value.includes(entry.id)) || [],
  )
  const selectedLayoutLocked = computed(() =>
    selectedWidgets.value.some((entry) => layoutLocked(page.value?.sections || [], entry.id)),
  )
  const sectionFixed = computed(
    () => !!section.value && layoutLocked(page.value?.sections || [], section.value.id),
  )
  const selectedTree = computed(() => descendants(page.value?.sections || [], selectedIds.value))
  const containerOptions = computed(() =>
    (page.value?.sections || []).filter(
      (entry) =>
        entry.type === 'container' &&
        canContain(page.value!.sections, section.value?.id || '', entry.id),
    ),
  )
  const canGroup = computed(
    () =>
      !selectedWidgets.value.some((section) => section.type === 'page-content') &&
      selectedWidgets.value.length >= 2 &&
      !selectedLayoutLocked.value &&
      new Set(selectedWidgets.value.map((entry) => entry.parentId || '')).size === 1 &&
      (page.value?.sections.length || 0) < 30,
  )
  function groupWidgets() {
    if (locked.value || !page.value || !canGroup.value) return
    const layout = selectionBounds(
      Object.fromEntries(selectedWidgets.value.map((entry) => [entry.id, entry.layout!])),
    )!
    const container = {
      ...newSection('container'),
      parentId: selectedWidgets.value[0]?.parentId,
      container: { direction: 'row' as const, gap: 16 },
      layout: { ...layout, z: Math.max(...selectedWidgets.value.map((entry) => entry.layout!.z)) },
    }
    history.change(() => {
      for (const entry of selectedWidgets.value) entry.parentId = container.id
      page.value!.sections.push(container)
    })
    setSelection([container.id])
    activePane.value = 'inspector'
  }
  function moveIntoContainer(event: Event) {
    if (locked.value || !page.value || !section.value || sectionFixed.value) return
    const parentId = (event.target as HTMLSelectElement).value
    if (parentId && layoutLocked(page.value.sections, parentId)) return
    if (!canContain(page.value.sections, section.value.id, parentId)) return
    options.cancelDrag()
    history.change(() => {
      section.value!.parentId = parentId || undefined
    })
  }
  function unwrapContainer() {
    if (locked.value || !page.value || section.value?.type !== 'container' || sectionFixed.value)
      return
    const target = section.value
    history.change(() => {
      for (const entry of page.value!.sections)
        if (entry.parentId === target.id) entry.parentId = target.parentId
      page.value!.sections = page.value!.sections.filter((entry) => entry.id !== target.id)
    })
    setSelection([])
  }
  const arrangementOptions = computed(() =>
    arrangementActions.map((action) => ({
      ...action,
      layouts: arrangeSelection(groupGeometry(), action.id, selectedSection.value),
    })),
  )
  function arrangeWidgets(action: string) {
    if (locked.value || !page.value || !geometryEditable.value || selectedLayoutLocked.value) return
    const option = arrangementOptions.value.find((option) => option.id === action)
    if (!option || !Object.keys(option.layouts).length) return
    options.cancelDrag()
    history.change(() => {
      for (const entry of page.value!.sections) {
        if (option.layouts[entry.id]) entry.layout = option.layouts[entry.id]
      }
    })
    // Completed actions may disable their own button. Keep keyboard history in the editor.
    options.focusArrangement()
  }
  watch(
    selectedSection,
    (id) => {
      if (id) settingsPanel.value = 'page'
      if (!id) selectedIds.value = []
      else if (!selectedIds.value.includes(id)) selectedIds.value = [id]
    },
    { flush: 'sync' },
  )
  watch(
    () => page.value?.sections.map((entry) => entry.id).join(','),
    () => {
      selectedIds.value = selectedIds.value.filter((id) =>
        page.value?.sections.some((entry) => entry.id === id),
      )
    },
  )
  function groupGeometry(): GeometryMap {
    return Object.fromEntries(
      selectedWidgets.value
        .filter(
          (entry) =>
            entry.layout && !entry.parentId && !layoutLocked(page.value?.sections || [], entry.id),
        )
        .map((entry) => [entry.id, entry.layout!]),
    )
  }
  const selectionPath = computed(() => {
    const path: { id: string; label: string }[] = []
    const seen = new Set<string>()
    let owner = section.value
    while (owner && !seen.has(owner.id)) {
      seen.add(owner.id)
      path.unshift({ id: owner.id, label: owner.title || sectionLabels[owner.type] })
      owner = page.value?.sections.find((entry) => entry.id === owner!.parentId)
    }
    return path
  })
  function setSelection(ids: string[]) {
    selectedText.value = undefined
    selectedIds.value = ids.filter((id) => page.value?.sections.some((entry) => entry.id === id))
    selectedSection.value = selectedIds.value.at(-1) || ''
  }
  function commitGeometry(
    id: string,
    layout: WidgetGeometry,
    type?: string,
    layouts?: GeometryMap,
    rotation?: number,
    heightOnly = false,
  ) {
    if (!designMode.value) return
    if (locked.value || !page.value || (type && page.value.sections.length >= 30)) return
    if (heightOnly) {
      const entry = page.value.sections.find((entry) => entry.id === id)
      if (!entry || layoutLocked(page.value.sections, id)) return
      history.change(() => {
        const height = Math.max(32, Math.min(2000, Math.round(layout.h * 32)))
        if (device.value === 'desktop') entry.sizing = { ...entry.sizing, height }
        else
          entry.devices = {
            ...entry.devices,
            [device.value]: {
              ...entry.devices?.[device.value],
              sizing: { ...entry.devices?.[device.value]?.sizing, height },
            },
          }
      })
      return
    }
    history.change(() => {
      page.value!.sections = materializeGrid(page.value!.sections)
      if (!type && !layouts && rotation === undefined && geometryEditable.value)
        layouts = resizeWithFollowing(page.value!.sections, id, layout)
      if (type) {
        const entry = { ...newSection(type as SectionType), layout }
        page.value!.sections.push(entry)
        selectedSection.value = entry.id
      } else {
        for (const entry of page.value!.sections) {
          if (layoutLocked(page.value!.sections, entry.id)) continue
          const next = layouts?.[entry.id] || (entry.id === id ? layout : undefined)
          if (next && rotation === undefined) entry.layout = { ...next }
          if (entry.id === id && rotation !== undefined) {
            if (device.value === 'desktop') entry.appearance = { ...entry.appearance, rotation }
            else
              entry.devices = {
                ...entry.devices,
                [device.value]: {
                  ...entry.devices?.[device.value],
                  appearance: { ...entry.devices?.[device.value]?.appearance, rotation },
                },
              }
          }
        }
      }
    })
  }
  return {
    selectedWidgets,
    selectedLayoutLocked,
    sectionFixed,
    selectedTree,
    containerOptions,
    canGroup,
    groupWidgets,
    moveIntoContainer,
    unwrapContainer,
    arrangementOptions,
    arrangeWidgets,
    groupGeometry,
    selectionPath,
    setSelection,
    commitGeometry,
  }
}
