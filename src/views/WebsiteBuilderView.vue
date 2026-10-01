<script setup lang="ts">
import BuilderHelpDialog from '@/components/builder/BuilderHelpDialog.vue'
import { commandKey, editorHelp } from '@/features/website/editorHelp'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import BuilderPanelResize from '@/components/builder/BuilderPanelResize.vue'
import { useBuilderPanels } from '@/features/builder/useBuilderPanels'
import WebsitePageCode from '@/components/website/WebsitePageCode.vue'
import WebsiteScriptFrame from '@/components/website/WebsiteScriptFrame.vue'
import { parseWebsiteHtml, reconcileWebsiteHtml } from '../../functions/src/websiteLayout'
import WebsiteThemeFields from '@/components/website/WebsiteThemeFields.vue'
import { widgetCategories, widgetCategory, widgetInfo } from '@/features/website/widgetCatalog'
import WebsiteBlockFields from '@/components/website/WebsiteBlockFields.vue'
import { blockCollections } from '../../functions/src/websiteBlocks'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  watch,
} from 'vue'
import {
  inlineEditingKey,
  navigationEditingKey,
  navigationPreviewKey,
  itemEditingKey,
  type InlineTarget,
  type InlineEditing,
} from '@/features/website/inlineEditing'
import { updateNavigationLabel } from '@/features/website/navigation'
import { inlineItem } from '@/features/website/itemEditing'
import { imageEditingKey, type ImageTarget } from '@/features/website/imageEditing'
import WebsiteImageEditor from '@/components/website/WebsiteImageEditor.vue'
import WebsiteWidgetToolbar from '@/components/website/WebsiteWidgetToolbar.vue'
import WebsiteAlignmentGuides from '@/components/website/WebsiteAlignmentGuides.vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import WebsiteCanvas from '@/components/website/WebsiteCanvas.vue'
import WebsiteAppearanceFields from '@/components/website/WebsiteAppearanceFields.vue'
import WebsiteInspectorTabs, {
  type InspectorTab,
} from '@/components/website/WebsiteInspectorTabs.vue'
import WebsiteLayoutFields from '@/components/website/WebsiteLayoutFields.vue'
import WebsiteLayersPanel from '@/components/website/WebsiteLayersPanel.vue'
import WebsiteFormSettings from '@/components/website/WebsiteFormSettings.vue'
import WebsiteFormSubmissions from '@/components/website/WebsiteFormSubmissions.vue'
import { newWebsiteForm, type WebsiteFormDefinition } from '../../functions/src/websiteForms'
import WebsiteCustomLibrary from '@/components/website/WebsiteCustomLibrary.vue'
import {
  captureCustomWidget,
  customPlacement,
  customUsages,
  detachCustom,
  updateCustomDefinition,
} from '@/features/website/customWidgets'
import { customDefinition, type CustomWidgetDefinition } from '../../functions/src/websiteCustom'
import WebsiteSavedSections from '@/components/website/WebsiteSavedSections.vue'
import { captureSavedSection, insertSavedSection } from '@/features/website/savedSections'
import { reorderLayer } from '@/features/website/layers'
import { compilePageCss } from '../../functions/src/websiteDesign'
import { responsiveSection, deviceWidth, deviceHeight, isFlow } from '@/features/website/responsive'
import type {
  WebsiteDevice,
  WidgetAppearance,
  ContainerLayout,
  ItemSizing,
} from '@/features/website/types'
import {
  descendants,
  canContain,
  visibleSections,
  layoutLocked,
} from '@/features/website/containers'
import { visualGeometry } from '@/features/website/appearance'
import { normalizeRotation } from '@/features/website/transform'
import { textBoxEditingKey, sameText, type ElementTarget } from '@/features/website/textBox'
import BuilderSelectionContext from '@/components/builder/BuilderSelectionContext.vue'
import WebsiteElementFields from '@/components/website/WebsiteElementFields.vue'
import WebsiteElementContent from '@/components/website/WebsiteElementContent.vue'
import {
  changeElementBox,
  resetElementBox,
  resolveElementBox,
  type ElementField,
} from '@/features/website/elementLayout'
import type { TextBoxValues } from '../../functions/src/websiteTextBox'
import WebsiteNavigationFields from '@/components/website/WebsiteNavigationFields.vue'
import WebsiteRevisionHistory from '@/components/website/WebsiteRevisionHistory.vue'
import WebsitePublishComparison from '@/components/website/WebsitePublishComparison.vue'
import { publishingChecks, type PublishingIssue } from '@/features/website/publishing'
import WebsiteItemFields from '@/components/website/WebsiteItemFields.vue'
import WebsiteBrandingFields from '@/components/website/WebsiteBrandingFields.vue'
import ExplorerContextMenu from '@/components/dashboard/ExplorerContextMenu.vue'
import { arrangeSelection, arrangementActions } from '@/features/website/arrangement'
import {
  translateSelection,
  cloneWidgets,
  layerSelection,
  selectionBounds,
  type GeometryMap,
} from '@/features/website/selection'
import {
  newItem,
  newSection,
  pageUrl,
  sectionLabels,
  withWebsiteDefaults,
  type SectionType,
  type WebsiteItem,
  type WebsiteSection,
  type WebsiteSite,
  type WebsitePage,
  type WebsiteState,
} from '@/features/website/types'
import { websiteCommand, websiteError } from '@/services/website'
import {
  copyPage,
  pageFromTemplate,
  pageTemplates,
  type PageTemplate,
} from '@/features/website/pageTools'
import { useWebsiteHistory } from '@/features/website/useWebsiteHistory'
import { useWebsiteGrid } from '@/features/website/useWebsiteGrid'
import { starterFromDraft, backupBeforeStarter } from '@/features/website/starterImport'
import { useWebsiteAutosave } from '@/features/website/useWebsiteAutosave'
import { useWebsiteDraftSync } from '@/features/website/useWebsiteDraftSync'
import { useAuthStore } from '@/stores/auth'
import {
  defaultGrid,
  materializeGrid,
  nextGeometry,
  gridExtent,
  changeGeometry,
  gridStep,
  resizeWithFollowing,
  type WidgetGeometry,
  type WidgetAction,
} from '@/features/website/grid'

type EditorMode = 'content' | 'design' | 'code'
const router = useRouter()
const modes: { id: EditorMode; label: string; description: string }[] = [
  { id: 'content', label: 'Content', description: 'Update text, images, links and list entries.' },
  {
    id: 'design',
    label: 'Design',
    description: 'Arrange widgets and adjust layout and appearance.',
  },
  { id: 'code', label: 'Code', description: 'Edit site and page HTML, CSS and JavaScript.' },
]
function preferredMode(): EditorMode {
  try {
    const value = sessionStorage.getItem('website-editor-mode')
    if (value === 'design' || value === 'code') return value
  } catch {
    /* Storage is optional. */
  }
  return 'content'
}
const guide = ref<InstanceType<typeof BuilderHelpDialog>>()
function helpKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.key !== '?')
    return
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('input, textarea, select, [contenteditable]')
  )
    return
  event.preventDefault()
  void guide.value?.open()
}
const confirmation = ref<InstanceType<typeof BuilderConfirmDialog>>()
const editorMode = ref<EditorMode>(preferredMode())
const designMode = computed(() => editorMode.value === 'design')
const codeMode = computed(() => editorMode.value === 'code')
const settingsPanel = ref<'page' | 'site'>('page')
const inspectorTab = ref<InspectorTab>('content')
function chooseInspectorTab(tab: InspectorTab) {
  history.checkpoint()
  inspectorTab.value = tab
  if (inspectorPane.value) inspectorPane.value.scrollTop = 0
}
type BuilderTool = 'pages' | 'widgets' | 'layers' | 'publishing'
const builderTool = ref<BuilderTool>('pages')
const leftPanelOpen = ref(true)
const rightPanelOpen = ref(true)
const builderTools = computed(() => [
  { id: 'pages' as const, label: 'Pages', icon: 'pi-file' },
  ...(editorMode.value !== 'content'
    ? [{ id: 'widgets' as const, label: 'Widgets', icon: 'pi-plus-circle' }]
    : []),
  ...(designMode.value ? [{ id: 'layers' as const, label: 'Layers', icon: 'pi-clone' }] : []),
  { id: 'publishing' as const, label: 'Publishing', icon: 'pi-check-circle' },
])
function openBuilderTool(tool: BuilderTool) {
  builderTool.value = tool
  leftPanelOpen.value = true
  activePane.value = 'outline'
  widgetDrag.cancel()
  closeMenu()
}
function openWidgetLibrary() {
  if (!designMode.value) changeMode('design')
  openBuilderTool('widgets')
}
function togglePanels() {
  const open = !leftPanelOpen.value && !rightPanelOpen.value
  leftPanelOpen.value = open
  rightPanelOpen.value = open
}

const editingLayout = ref(false)
const runningCode = ref(false)
const codePreviewSite = ref<WebsiteSite>()
function toggleCodePreview() {
  runningCode.value = !runningCode.value
  if (runningCode.value && site.value)
    codePreviewSite.value = JSON.parse(JSON.stringify(site.value))
}
function chooseScope(layout: boolean) {
  history.checkpoint()
  widgetDrag.cancel()
  closeMenu()
  setSelection([])
  editingLayout.value = layout
  settingsPanel.value = 'page'
  runningCode.value = false
}
function createSharedLayout() {
  if (!site.value || site.value.sharedLayout) return
  const slot = {
    ...newSection('page-content'),
    title: 'Page content',
    text: 'Each page appears here.',
    locked: true,
  }
  history.change(() => {
    site.value!.sharedLayout = {
      id: 'site-layout',
      slug: 'site-layout',
      title: 'Site layout',
      description: '',
      inNavigation: false,
      chrome: 'widgets',
      layout: { desktop: 'flow', tablet: 'flow', mobile: 'flow', gap: 0, padding: 0 },
      sections: materializeGrid([newSection('navigation'), slot, newSection('footer')]),
    }
  })
  chooseScope(true)
}
function changeMode(mode: EditorMode) {
  runningCode.value = false
  if (locked.value || mode === editorMode.value) return
  history.checkpoint()
  widgetDrag.cancel()
  closeMenu()
  hand.value = false
  editorMode.value = mode
  inspectorTab.value = 'content'
  rightPanelOpen.value = true
  builderTool.value = 'pages'
  setSelection(selectedSection.value ? [selectedSection.value] : [])
  try {
    sessionStorage.setItem('website-editor-mode', mode)
  } catch {
    /* Storage is optional. */
  }
}
function openSiteSettings() {
  chooseSection('')
  settingsPanel.value = 'site'
  rightPanelOpen.value = true
  activePane.value = 'inspector'
}
const site = ref<WebsiteSite>()
const localHistory = useWebsiteHistory(site)
const history = {
  ...localHistory,
  change(operation: () => void) {
    const pages = () => [
      ...(site.value?.pages || []),
      ...(site.value?.sharedLayout ? [site.value.sharedLayout] : []),
    ]
    const previous = new Map(
      pages().map((page) => [
        page.id,
        {
          html: page.html,
          ids: page.sections.filter((section) => !section.parentId).map((section) => section.id),
        },
      ]),
    )
    localHistory.change(() => {
      operation()
      for (const page of pages()) {
        const before = previous.get(page.id)
        const ids = page.sections
          .filter((section) => !section.parentId)
          .map((section) => section.id)
        if (
          before?.html === undefined ||
          page.html !== before.html ||
          ids.join(',') === before.ids.join(',')
        )
          continue
        try {
          page.html = reconcileWebsiteHtml(
            before.html,
            before.ids,
            ids,
            page.sections.find((section) => section.type === 'page-content')?.id,
          )
        } catch {
          /* Incomplete authored HTML remains visible for correction. */
        }
      }
    })
  },
}
const { canUndo, canRedo } = history
const pageTemplate = ref<PageTemplate>('company')
const version = ref(0)
const saved = ref('')
const publishedAt = ref<number | null>(null)
const hasPrevious = ref(false)
const loading = ref(true)
const busy = ref(false)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const message = ref('')
const selectedPage = ref('')
const homePageId = ref('')
const selectedSection = ref('')
const selectedIds = ref<string[]>([])
const clipboard = ref<WebsiteSection[]>([])
const arrangementPanel = ref<HTMLElement>()
const menu = ref<{ x: number; y: number; point?: { x: number; y: number } }>()
let menuOpener: HTMLElement | undefined
const builtinLabels = Object.fromEntries(
  Object.entries(sectionLabels).filter(
    ([type]) => !['custom', 'form', 'page-content'].includes(type),
  ),
) as Omit<typeof sectionLabels, 'custom' | 'form'>
const widgetSearch = ref('')
const widgetFilter = ref('All')
function clearWidgetFilters() {
  widgetSearch.value = ''
  widgetFilter.value = 'All'
}
function matchesWidget(type: SectionType, label: string) {
  return (
    (widgetFilter.value === 'All' || widgetCategory(type) === widgetFilter.value) &&
    (label + ' ' + type + ' ' + widgetCategory(type) + ' ' + widgetInfo(type).description)
      .toLowerCase()
      .includes(widgetSearch.value.trim().toLowerCase())
  )
}
const filteredWidgets = computed(
  () =>
    Object.fromEntries(
      Object.entries(builtinLabels).filter(([type, label]) =>
        matchesWidget(type as SectionType, label),
      ),
    ) as typeof builtinLabels,
)
const widgetGroups = computed(() => {
  const entries = [
    ...Object.entries(filteredWidgets.value),
    ...(matchesWidget('form', 'Form') ? [['form', 'Form']] : []),
  ] as [SectionType, string][]
  return widgetCategories
    .map((category) => ({
      category,
      widgets: entries.filter(([type]) => widgetCategory(type) === category),
    }))
    .filter((group) => group.widgets.length)
})
const device = ref<WebsiteDevice>('desktop')
const mobile = computed(() => device.value !== 'desktop')
const activePane = ref<'outline' | 'preview' | 'inspector'>('inspector')
const inspectorPane = ref<HTMLElement>()

const contentPage = computed(() => site.value?.pages.find((page) => page.id === selectedPage.value))
const page = computed(() => (editingLayout.value ? site.value?.sharedLayout : contentPage.value))
// Shared widgets stay on the canvas with the current page. Route every edit to
// its owner rather than replacing the preview when the selection changes scope.
function sectionOwner(id: string) {
  if (contentPage.value?.sections.some((entry) => entry.id === id)) return contentPage.value
  if (site.value?.sharedLayout?.sections.some((entry) => entry.id === id))
    return site.value.sharedLayout
}
function chooseSectionScope(id: string) {
  const owner = sectionOwner(id)
  if (owner && (owner === site.value?.sharedLayout) !== editingLayout.value)
    chooseScope(owner === site.value?.sharedLayout)
}
const section = computed(() =>
  page.value?.sections.find((section) => section.id === selectedSection.value),
)
const effectiveSection = computed(() => section.value && renderedSection(section.value))
const layerSections = computed(() => (page.value?.sections || []).map(renderedSection))
function renderedSection(entry: WebsiteSection) {
  const owner = sectionOwner(entry.id) || page.value
  return responsiveSection(entry, device.value, {
    flow: owner === site.value?.sharedLayout || isFlow(owner?.layout, device.value),
    parent: owner?.sections.find((parent) => parent.id === entry.parentId),
  })
}
const geometryEditable = computed(
  () =>
    designMode.value &&
    !editingLayout.value &&
    device.value === 'desktop' &&
    !isFlow(page.value?.layout, device.value),
)
const cssError = computed(() => {
  for (const entry of [
    ...(site.value?.pages || []),
    ...(site.value?.sharedLayout ? [site.value.sharedLayout] : []),
  ]) {
    try {
      compilePageCss(site.value?.css || '', 'validation')
      compilePageCss(entry.css || '', 'validation')
      if (entry.html !== undefined)
        parseWebsiteHtml(
          entry.html,
          entry.sections
            .filter((section) => !section.parentId && section.type !== 'page-content')
            .map((section) => section.id),
          entry === site.value?.sharedLayout,
        )
    } catch (reason) {
      return entry.title + ': ' + (reason instanceof Error ? reason.message : 'Invalid page CSS')
    }
  }
  return ''
})
function setDesign(
  key: 'appearance' | 'container' | 'sizing' | 'hidden',
  value: WidgetAppearance | ContainerLayout | ItemSizing | boolean | undefined,
) {
  if (!section.value || locked.value) return
  if (sectionFixed.value) {
    if (key === 'container' || key === 'sizing') return
    if (key === 'appearance') {
      const rotation =
        device.value === 'desktop'
          ? section.value.appearance?.rotation
          : section.value.devices?.[device.value]?.appearance?.rotation
      const next = { ...((value as WidgetAppearance) || {}) }
      if (rotation === undefined) delete next.rotation
      else next.rotation = rotation
      value = Object.keys(next).length ? next : undefined
    }
  }
  history.change(() => {
    const entry = section.value!
    if (device.value === 'desktop') {
      if (value !== undefined) Object.assign(entry, { [key]: value })
      else if (key === 'hidden') entry.hidden = false
      else delete entry[key]
    } else {
      const override = { ...entry.devices?.[device.value], [key]: value }
      if (value === undefined) delete override[key]
      entry.devices = {
        ...entry.devices,
        [device.value]: override,
      }
      if (!Object.keys(override).length) delete entry.devices[device.value]
      if (!Object.keys(entry.devices).length) delete entry.devices
    }
  })
}
function setPageSpacing(key: 'gap' | 'padding', event: Event) {
  const input = event.target as HTMLInputElement
  if (!page.value || !input.value || !input.validity.valid) {
    input.reportValidity()
    return
  }
  history.change(() => {
    page.value!.layout = { ...page.value!.layout, [key]: Number(input.value) }
  })
}
function resetDevice() {
  if (!section.value || device.value === 'desktop' || sectionFixed.value) return
  history.change(() => {
    delete section.value!.devices?.[device.value as 'tablet' | 'mobile']
  })
}
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
  widgetDrag.cancel()
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
  widgetDrag.cancel()
  history.change(() => {
    for (const entry of page.value!.sections) {
      if (option.layouts[entry.id]) entry.layout = option.layouts[entry.id]
    }
  })
  // Completed actions may disable their own button. Keep keyboard history in the editor.
  void nextTick(() => arrangementPanel.value?.focus({ preventScroll: true }))
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
const selectedText = ref<ElementTarget>()
const canvasElements = shallowRef<{ target: ElementTarget; element: HTMLElement }[]>([])
const selectedElement = computed(() =>
  canvasElements.value.find((entry) => sameText(entry.target, selectedText.value)),
)
const elementNames: Record<string, string> = {
  title: 'Heading',
  text: 'Text',
  image: 'Image',
  button: 'Button',
}
const selectedElementItem = computed(
  () => selectedText.value && inlineItem(page.value?.sections || [], selectedText.value),
)
const selectedElementDisplay = computed(() => {
  const item = selectedElementItem.value
  return item &&
    selectedText.value?.field === 'image' &&
    !selectedText.value.key &&
    ['navigation', 'footer'].includes(section.value?.type || '') &&
    !item.imageId
    ? {
        ...item,
        imageId: site.value?.branding?.logoId || '',
        alt: site.value?.branding?.logoAlt || '',
      }
    : item
})
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
const selectionDetail = computed(() => {
  const target =
    selectedText.value ||
    (imageTarget.value
      ? {
          id: imageTarget.value.sectionId,
          key:
            imageTarget.value.itemId === imageTarget.value.sectionId
              ? undefined
              : imageTarget.value.itemId,
          field: 'image',
        }
      : inlineTarget.value)
  if (!target) return undefined
  const item = target.key && inlineItem(page.value?.sections || [], target as ElementTarget)
  return {
    label: elementNames[target.field] || (target.field === 'linkLabel' ? 'Button' : 'Text'),
    item: item ? item.title || 'Item' : undefined,
  }
})
function updateElementContent(patch: Partial<WebsiteItem>) {
  const item = selectedElementItem.value
  if (!item || locked.value || !designMode.value) return
  endInline()
  history.change(() => {
    Object.assign(item, patch)
    for (const key of [
      'titleRichText',
      'textRichText',
      'linkRichText',
      'textFormat',
      'imageSettings',
    ] as const)
      if (key in patch && patch[key] === undefined) delete item[key]
  })
}
function cropSelectedElement() {
  const target = selectedText.value
  if (!target || target.field !== 'image') return
  const element = selectedElement.value?.element
  imageTarget.value = { sectionId: target.id, itemId: target.key || target.id }
  imageRatio.value = element ? element.clientWidth / Math.max(1, element.clientHeight) : 1.5
  const image = element?.querySelector('img')
  imageContain.value = !!image && getComputedStyle(image).objectFit === 'contain'
}
const elementOverrides = computed(() => {
  const target = selectedText.value
  if (!target || device.value === 'desktop') return undefined
  return selectedElementItem.value?.textBoxes?.[target.field as ElementField]?.devices?.[
    device.value
  ]
})
const elementBox = computed(() => {
  const target = selectedText.value
  const item = target && inlineItem(page.value?.sections || [], target)
  return resolveElementBox(item?.textBoxes?.[target?.field as ElementField], device.value)
})
function selectElement(target: ElementTarget) {
  if (locked.value || !designMode.value) return
  chooseSectionScope(target.id)
  if (layoutLocked(page.value?.sections || [], target.id)) return
  endInline()
  endImage()
  widgetDrag.cancel()
  setSelection([target.id])
  selectedText.value = target
  rightPanelOpen.value = true
}
async function revealElement(target: ElementTarget) {
  selectElement(target)
  activePane.value = 'preview'
  await nextTick()
  selectedElement.value?.element.scrollIntoView({ block: 'center', inline: 'nearest' })
  selectedElement.value?.element.focus({ preventScroll: true })
}
function changeElement(patch: TextBoxValues, reset?: (keyof TextBoxValues)[]) {
  const target = selectedText.value
  if (
    !target ||
    locked.value ||
    !designMode.value ||
    layoutLocked(page.value?.sections || [], target.id)
  )
    return
  const item = inlineItem(page.value?.sections || [], target)
  if (!item) return
  endInline()
  const field = target.field as ElementField
  // Numeric dimensions follow the same aspect lock as the corner handles.
  if (!reset && (elementBox.value.lockAspect ?? field === 'image')) {
    const width = elementBox.value.width ?? selectedElement.value?.element.offsetWidth
    const height = elementBox.value.height ?? selectedElement.value?.element.offsetHeight
    if (width && height) {
      if (patch.width !== undefined && patch.height === undefined)
        patch = {
          ...patch,
          height: Math.max(
            24,
            Math.min(4000, Math.round(((patch.width * height) / width) * 100) / 100),
          ),
        }
      else if (patch.height !== undefined && patch.width === undefined)
        patch = {
          ...patch,
          width: Math.max(
            24,
            Math.min(4000, Math.round(((patch.height * width) / height) * 100) / 100),
          ),
        }
    }
  }
  history.change(() => {
    const box = item.textBoxes?.[field]
    item.textBoxes = {
      ...item.textBoxes,
      [field]: reset
        ? resetElementBox(box, device.value, reset)
        : changeElementBox(box, device.value, patch),
    }
  })
}
function setSelection(ids: string[]) {
  selectedText.value = undefined
  selectedIds.value = ids.filter((id) => page.value?.sections.some((entry) => entry.id === id))
  selectedSection.value = selectedIds.value.at(-1) || ''
}
const checks = computed(() => (site.value ? publishingChecks(site.value) : []))
const publishBlocked = computed(() => checks.value.some((issue) => issue.level === 'error'))
const draftSnapshot = computed(() => (site.value ? JSON.stringify(site.value) : ''))
const dirty = computed(() => Boolean(site.value && draftSnapshot.value !== saved.value))
const draftState = computed(() =>
  loading.value
    ? 'Loading draft…'
    : !site.value
      ? 'Draft unavailable'
      : saving.value || autosave.saving.value
        ? 'Saving draft…'
        : dirty.value
          ? autosave.conflict.value
            ? 'Save conflict · Online save paused'
            : autosave.protectedLocally.value
              ? autosave.online.value
                ? 'Saved in browser · Waiting to sync'
                : 'Saved in browser · Offline'
              : 'Unsaved changes'
          : 'Draft saved',
)
watch(dirty, (changed) => {
  if (changed && message.value.startsWith('Draft saved.')) message.value = ''
})
const locked = computed(() => loading.value || busy.value || uploading.value)
const inlineTarget = ref<InlineTarget>()
const focusedItemId = ref<string>()
const focusedItem = computed(() =>
  section.value?.items.find((item) => item.id === focusedItemId.value),
)
watch(
  [selectedSection, selectedPage, editingLayout],
  () => {
    focusedItemId.value = undefined
  },
  { flush: 'sync' },
)
const imageTarget = ref<ImageTarget>()
const imageRatio = ref(1.5)
const imageContain = ref(false)
function imageItem(target: ImageTarget | undefined) {
  if (!target) return
  const owner = sectionOwner(target.sectionId)?.sections.find(
    (entry) => entry.id === target.sectionId,
  )
  return owner?.id === target.itemId
    ? owner
    : owner?.items.find((item) => item.id === target.itemId)
}
const selectedImage = computed(() => {
  const item = imageItem(imageTarget.value)
  if (
    item &&
    'type' in item &&
    ['navigation', 'footer'].includes(String(item.type)) &&
    !item.imageId
  )
    return {
      ...item,
      imageId: site.value?.branding?.logoId || '',
      alt: site.value?.branding?.logoAlt || '',
    }
  return item
})
function endImage() {
  imageTarget.value = undefined
}
function updateImage(value: Pick<WebsiteItem, 'imageId' | 'alt' | 'imageSettings'>) {
  const item = imageItem(imageTarget.value)
  if (!item) return
  history.change(() => {
    item.imageId = value.imageId
    item.alt = value.alt
    if (value.imageSettings) item.imageSettings = value.imageSettings
    else delete item.imageSettings
  })
}
provide(imageEditingKey, {
  enabled: (target) =>
    !locked.value && !codeMode.value && !runningCode.value && !!imageItem(target),
  begin: (target, ratio, contain) => {
    endInline()
    widgetDrag.cancel()
    hand.value = false
    closeMenu()
    chooseSection(target.sectionId)
    focusedItemId.value = target.itemId === target.sectionId ? undefined : target.itemId
    imageTarget.value = target
    imageRatio.value = ratio
    imageContain.value = contain
    void nextTick(() => {
      inspectorPane.value?.scrollTo({ top: 0 })
      inspectorPane.value?.focus({ preventScroll: true })
    })
  },
})
watch([selectedPage, editingLayout, editorMode, runningCode, settingsPanel], endImage, {
  flush: 'sync',
})
watch([selectedSection, selectedImage], () => {
  if (
    imageTarget.value &&
    (selectedSection.value !== imageTarget.value.sectionId || !selectedImage.value)
  )
    endImage()
})
function endInline(target?: InlineTarget) {
  if (
    !inlineTarget.value ||
    (target &&
      (target.id !== inlineTarget.value.id ||
        target.field !== inlineTarget.value.field ||
        target.key !== inlineTarget.value.key))
  )
    return
  inlineTarget.value = undefined
  history.endGroup()
}
provide(textBoxEditingKey, {
  selected: selectedText,
  device,
  register: (target, element) => {
    const entry = { target, element }
    canvasElements.value = [...canvasElements.value, entry]
    return () => {
      canvasElements.value = canvasElements.value.filter((item) => item !== entry)
    }
  },
  enabled: (target) =>
    designMode.value &&
    !locked.value &&
    !runningCode.value &&
    (target.field === 'title' ||
      target.field === 'text' ||
      target.field === 'image' ||
      target.field === 'button') &&
    !!inlineItem(sectionOwner(target.id)?.sections || [], target) &&
    !layoutLocked(sectionOwner(target.id)?.sections || [], target.id),
  select: selectElement,
  save: (target, box) => {
    const item = inlineItem(page.value?.sections || [], target)
    if (
      !item ||
      locked.value ||
      layoutLocked(page.value?.sections || [], target.id) ||
      (target.field !== 'title' &&
        target.field !== 'text' &&
        target.field !== 'image' &&
        target.field !== 'button')
    )
      return
    const field = target.field
    history.change(() => {
      item.textBoxes = {
        ...item.textBoxes,
        [field]: changeElementBox(item.textBoxes?.[field], device.value, box),
      }
    })
  },
})
watch(
  [editorMode, page],
  () => {
    selectedText.value = undefined
  },
  { flush: 'sync' },
)
const inlineEditing: InlineEditing = {
  active: inlineTarget,
  enabled: (target) =>
    !locked.value &&
    !codeMode.value &&
    !runningCode.value &&
    (target.field === 'menu' || target.field === 'brand'
      ? Boolean(sectionOwner(target.id))
      : Boolean(inlineItem(sectionOwner(target.id)?.sections || [], target))),
  design: () => designMode.value,
  select: (target, event) => {
    endInline()
    const pane = activePane.value
    chooseSection(target.id, event)
    activePane.value = pane
  },
  begin: (target) => {
    chooseSectionScope(target.id)
    if (
      inlineTarget.value?.id === target.id &&
      inlineTarget.value.field === target.field &&
      inlineTarget.value.key === target.key
    )
      return
    endImage()
    endInline()
    widgetDrag.cancel()
    hand.value = false
    closeMenu()
    setSelection([target.id])
    focusedItemId.value =
      target.field === 'menu' || target.field === 'brand' ? undefined : target.key
    inspectorTab.value = 'content'
    settingsPanel.value = 'page'
    history.beginGroup()
    inlineTarget.value = target
    if (designMode.value && ['title', 'text', 'linkLabel'].includes(target.field))
      selectedText.value = {
        ...target,
        field: target.field === 'linkLabel' ? 'button' : target.field,
      }
  },
  update: (target, text, format, rich) => {
    if (
      inlineTarget.value?.id !== target.id ||
      inlineTarget.value.field !== target.field ||
      inlineTarget.value.key !== target.key
    )
      return
    const entry = page.value?.sections.find((entry) => entry.id === target.id)
    if (!entry) return
    if (target.field === 'menu') {
      entry.navigation ||= {
        showBrand: true,
        showPages: entry.type === 'navigation',
        showLogin: false,
        links: [],
      }
      if (target.key && site.value)
        updateNavigationLabel(entry.navigation, target.key, text, rich, site.value)
      return
    }
    if (target.field === 'brand') {
      entry.navigation ||= {
        showBrand: true,
        showPages: entry.type === 'navigation',
        showLogin: false,
        links: [],
      }
      entry.navigation.brandText = text
      if (rich) entry.navigation.brandRichText = rich
      else delete entry.navigation.brandRichText
      return
    }
    const item = inlineItem(page.value?.sections || [], target)
    if (!item) return
    item[target.field] = text
    const richField =
      target.field === 'title'
        ? 'titleRichText'
        : target.field === 'linkLabel'
          ? 'linkRichText'
          : 'textRichText'
    if (rich) item[richField] = rich
    else delete item[richField]
    if (target.field === 'text') {
      if (format) item.textFormat = format
      else delete item.textFormat
    }
  },
  end: endInline,
}
provide(inlineEditingKey, inlineEditing)
provide(navigationPreviewKey, {
  pageId: (url) => site.value?.pages.find((entry) => pageUrl(entry.slug) === url)?.id,
  navigate: (id) => {
    if (locked.value) return
    endInline()
    endImage()
    choosePage(id)
  },
  openAppLogin: () => {
    if (locked.value) return
    endInline()
    endImage()
    void router.push('/login')
  },
  edit: (target) => {
    if (locked.value || codeMode.value || runningCode.value) return
    if (site.value?.sharedLayout?.sections.some((entry) => entry.id === target.id))
      chooseScope(true)
    void nextTick(() => {
      if (inlineEditing.enabled(target)) inlineEditing.begin(target)
    })
  },
})
watch([selectedPage, editingLayout, editorMode, runningCode, locked], () => endInline(), {
  flush: 'sync',
})
provide(itemEditingKey, (target) => {
  if (
    locked.value ||
    codeMode.value ||
    runningCode.value ||
    !inlineItem(sectionOwner(target.id)?.sections || [], target)
  )
    return
  endInline()
  chooseSection(target.id)
  focusedItemId.value = target.key
  inspectorTab.value = 'content'
  void nextTick(() => {
    const fields = inspectorPane.value?.querySelector<HTMLElement>(
      `[data-item-id="${CSS.escape(target.key || target.id)}"]`,
    )
    const input = fields?.querySelector<HTMLInputElement>('[data-link-url]')
    let parent = input?.parentElement
    while (parent && parent !== inspectorPane.value) {
      if (parent instanceof HTMLDetailsElement) parent.open = true
      parent = parent.parentElement
    }
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'center', inline: 'nearest' })
  })
})
provide(navigationEditingKey, (sectionId, linkId) => {
  if (locked.value || codeMode.value || runningCode.value) return
  endInline()
  chooseSection(sectionId)
  inspectorTab.value = 'content'
  if (linkId.startsWith('page:')) linkId = 'automatic-pages'
  else if (linkId === 'login') linkId = 'employee-login'
  void nextTick(() => {
    const field =
      inspectorPane.value?.querySelector<HTMLInputElement>(
        `[data-menu-link="${CSS.escape(linkId)}"]`,
      ) || inspectorPane.value?.querySelector<HTMLInputElement>('.menu-toggle input')
    field?.focus()
  })
})
const builderRoot = ref<HTMLElement>()
const previewScroller = ref<HTMLElement>()
const previewViewport = ref<HTMLElement>()
const websiteCanvas = ref<InstanceType<typeof WebsiteCanvas>>()
const zoom = ref(1)
const autoFit = ref(true)
const widgetDrag = useWebsiteGrid({
  surface: () => websiteCanvas.value?.getSurface(editingLayout.value),
  scroller: previewScroller,
  viewport: previewViewport,
  disabled: () => locked.value || Boolean(inlineTarget.value),
  settings: () => page.value?.grid || defaultGrid(),
  commit: commitGeometry,
  resize: (id, layout) =>
    geometryEditable.value
      ? resizeWithFollowing(materializeGrid(page.value?.sections || []), id, layout)
      : undefined,
  rotation: (id) => {
    const entry = page.value?.sections.find((entry) => entry.id === id)
    return entry ? renderedSection(entry).appearance?.rotation || 0 : 0
  },
  group: groupGeometry,
  widgets: () =>
    Object.fromEntries(
      visibleSections(page.value?.sections || [])
        .filter((entry) => !entry.parentId && entry.layout)
        .map((entry) => [entry.id, entry.layout!]),
    ),
  select: setSelection,
})
const { draft: gridDraft, hand, marquee } = widgetDrag
const canvasWidth = computed(
  () =>
    gridExtent([
      ...visibleSections(contentPage.value?.sections || [])
        .filter((section) => !section.parentId && section.layout)
        .map((section) =>
          visualGeometry(
            gridDraft.value?.layouts?.[section.id] ||
              (gridDraft.value?.id === section.id ? gridDraft.value.layout : section.layout!),
            gridDraft.value?.id === section.id && gridDraft.value.rotation !== undefined
              ? gridDraft.value.rotation
              : section.appearance?.rotation,
          ),
        ),
      ...(gridDraft.value
        ? Object.values(gridDraft.value.layouts || { primary: gridDraft.value.layout })
        : []),
    ]).width,
)
const previewWidth = computed(() => (mobile.value ? deviceWidth[device.value] : canvasWidth.value))
const previewFrame = ref<HTMLElement>()
const previewHeight = computed(() => deviceHeight[device.value])
watch([selectedPage, device], async () => {
  await nextTick()
  previewViewport.value?.scrollTo(0, 0)
  previewScroller.value?.scrollTo(0, 0)
})
watch(selectedPage, () => {
  settingsPanel.value = 'page'
})
watch([selectedPage, selectedSection, settingsPanel], async () => {
  inspectorTab.value = 'content'
  rightPanelOpen.value = true
  await nextTick()
  if (inspectorPane.value) inspectorPane.value.scrollTop = 0
})
watch([selectedPage, locked, activePane, zoom, device], () => {
  widgetDrag.cancel()
  menu.value = undefined
})
function fitView() {
  autoFit.value = true
  updateFit()
}
function setZoom(value: number) {
  autoFit.value = false
  zoom.value = Math.max(0.1, Math.min(3, value))
}
function chooseDevice(value: WebsiteDevice) {
  if (value === device.value) return
  // Fit follows device changes; manual zoom remains unchanged until Fit is chosen.
  device.value = value
}
function updateFit() {
  const scroller = previewScroller.value
  if (!autoFit.value || !scroller?.clientWidth || gridDraft.value) return
  const style = getComputedStyle(scroller)
  const available =
    scroller.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight)
  const availableHeight =
    scroller.clientHeight -
    parseFloat(style.paddingTop) -
    parseFloat(style.paddingBottom)
  zoom.value = Math.max(
    0.1,
    Math.min(
      1,
      available / previewWidth.value,
      availableHeight / previewHeight.value,
    ),
  )
}
let fitFrame: number | undefined
function scheduleFit() {
  if (fitFrame !== undefined) cancelAnimationFrame(fitFrame)
  fitFrame = requestAnimationFrame(() => {
    fitFrame = undefined
    updateFit()
  })
}
watch(previewScroller, (element, _previous, onCleanup) => {
  if (!element) return
  const observer = new ResizeObserver(scheduleFit)
  observer.observe(element)
  onCleanup(() => {
    observer.disconnect()
    if (fitFrame !== undefined) cancelAnimationFrame(fitFrame)
  })
})
watch([device, canvasWidth, gridDraft, activePane, selectedPage, editorMode, runningCode], async () => {
  await nextTick()
  scheduleFit()
})
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
function startWidgetMove(event: PointerEvent, id: string, action: WidgetAction = 'move') {
  if (!designMode.value || locked.value) return
  chooseSectionScope(id)
  if (layoutLocked(page.value?.sections || [], id) || selectedLayoutLocked.value) return
  if (action !== 'rotate' && action !== 'height' && !geometryEditable.value) return
  if (!page.value || locked.value || event.button === 2 || (event.shiftKey && action !== 'rotate'))
    return
  const entry = page.value.sections.find((section) => section.id === id)
  // Transform handles can be used directly from the inline text toolbar.
  // Finish the text history group before starting a separate geometry edit.
  endInline()
  if (action === 'height' && entry && entry.type !== 'page-content') {
    const frame = previewScroller.value?.querySelector<HTMLElement>(
      `[data-widget-id="${CSS.escape(id)}"]`,
    )
    if (!frame) return
    selectedSection.value = id
    widgetDrag.start(
      event,
      id,
      {
        x: 0,
        y: 0,
        w: frame.offsetWidth / 45,
        h: (renderedSection(entry).sizing?.height ?? frame.offsetHeight) / 32,
        z: entry.layout?.z || 0,
      },
      'height',
    )
    return
  }
  if (entry?.layout && (!entry.parentId || action === 'rotate')) {
    selectedSection.value = id
    if (action === 'rotate') (event.currentTarget as HTMLElement)?.focus({ preventScroll: true })
    widgetDrag.start(event, id, entry.layout, action)
  }
}
function startNewWidget(event: PointerEvent, type: SectionType) {
  if (!geometryEditable.value) return
  if (!page.value || page.value.sections.length >= 30) return
  widgetDrag.start(event, '', nextGeometry(page.value.sections, type), 'new', type)
}
function startOutlineMove(event: PointerEvent, id: string) {
  if (layoutLocked(page.value?.sections || [], id)) return
  if (!geometryEditable.value) return
  if (event.shiftKey || event.button === 2 || locked.value) return
  const entry = page.value?.sections.find((section) => section.id === id)
  if (entry?.layout && !entry.parentId) {
    selectedSection.value = id
    widgetDrag.start(event, id, entry.layout, 'place')
  }
}
function addWidget(type: SectionType) {
  if (!page.value) return
  const parentId =
    section.value?.type === 'container' && !sectionFixed.value ? section.value.id : undefined
  if (parentId && page.value.sections.length < 30 && !locked.value) {
    const entry = { ...newSection(type), parentId, layout: nextGeometry(page.value.sections, type) }
    history.change(() => page.value!.sections.push(entry))
    setSelection([entry.id])
    activePane.value = 'inspector'
    return
  }
  commitGeometry('', nextGeometry(page.value.sections, type), type)
  activePane.value = 'inspector'
}
function geometryKey(event: KeyboardEvent, id: string, action: WidgetAction = 'move') {
  if (!designMode.value) return
  if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select')) return
  if (locked.value) return
  chooseSectionScope(id)
  if (!page.value) return
  const entry = page.value.sections.find((section) => section.id === id)
  if (!entry?.layout || layoutLocked(page.value.sections, id) || selectedLayoutLocked.value) return
  if (action === 'rotate' || (event.target as HTMLElement).closest('.grid-rotate')) {
    const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key]
    if (direction || event.key === 'Home') {
      event.preventDefault()
      event.stopPropagation()
      widgetDrag.cancel()
      commitGeometry(
        id,
        entry.layout,
        undefined,
        undefined,
        event.key === 'Home'
          ? 0
          : normalizeRotation(
              (renderedSection(entry).appearance?.rotation || 0) +
                direction! * (event.shiftKey ? 15 : 1),
            ),
      )
    }
    return
  }
  if (action === 'height' || (event.target as HTMLElement).hasAttribute('data-height-resize')) {
    const delta = { ArrowUp: -1, ArrowDown: 1 }[event.key]
    const frame = previewScroller.value?.querySelector<HTMLElement>(
      `[data-widget-id="${CSS.escape(id)}"]`,
    )
    if (delta && frame) {
      event.preventDefault()
      event.stopPropagation()
      commitGeometry(
        id,
        {
          ...entry.layout,
          h:
            ((renderedSection(entry).sizing?.height ?? frame.offsetHeight) +
              delta * (event.shiftKey ? 10 : 1)) /
            32,
        },
        undefined,
        undefined,
        undefined,
        true,
      )
    }
    return
  }
  if (entry.parentId || !geometryEditable.value) return
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
    event.key
  ]
  if (!direction) return
  event.preventDefault()
  event.stopPropagation()
  const settings = page.value.grid || defaultGrid()
  const step = event.shiftKey ? 10 : 1
  const layout = changeGeometry(
    entry.layout,
    direction[0]! * step * gridStep(settings, 'x'),
    direction[1]! * step * gridStep(settings, 'y'),
    action,
    settings,
  )
  const group =
    action === 'move' && selectedIds.value.includes(id) && selectedWidgets.value.length > 1
      ? translateSelection(groupGeometry(), layout.x - entry.layout.x, layout.y - entry.layout.y)
      : undefined
  commitGeometry(id, group?.[id] || layout, undefined, group)
}
const overlapTargets = shallowRef<{ id: string; label: string; target?: ElementTarget }[]>([])
function objectsAtPoint(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest('.preview-frame')) return []
  const stack = document.elementsFromPoint(event.clientX, event.clientY)
  const entries: { id: string; label: string; target?: ElementTarget; rank: number }[] = []
  for (const { target, element } of canvasElements.value) {
    const rank = stack.findIndex((node) => node === element || element.contains(node))
    if (rank < 0) continue
    const owner = page.value?.sections.find((entry) => entry.id === target.id)
    const item = target.key && owner?.items.find((entry) => entry.id === target.key)
    entries.push({
      id: target.id,
      target,
      rank,
      label: `${owner?.title || (owner && sectionLabels[owner.type]) || 'Widget'} / ${item ? `${item.title || 'Item'} / ` : ''}${elementNames[target.field] || target.field}`,
    })
  }
  for (const [rank, node] of stack.entries()) {
    const id = (node as HTMLElement).dataset.widgetId
    const owner = page.value?.sections.find((entry) => entry.id === id)
    if (owner) entries.push({ id: owner.id, label: owner.title || sectionLabels[owner.type], rank })
  }
  return entries
    .sort((a, b) => a.rank - b.rank)
    .filter(
      (entry, index, all) =>
        all.findIndex((other) =>
          entry.target
            ? sameText(other.target, entry.target)
            : !other.target && other.id === entry.id,
        ) === index,
    )
}
const menuActions = computed(() => [
  ...overlapTargets.value.map((entry, index) => ({
    id: `select-object:${index}`,
    label: `Select object: ${entry.label}`,
    icon: 'pi-mouse-pointer',
  })),
  { id: 'copy', label: 'Copy widgets', disabled: !selectedWidgets.value.length },
  {
    id: 'paste',
    label: 'Paste widgets',
    disabled:
      !clipboard.value.length || (page.value?.sections.length || 0) + clipboard.value.length > 30,
  },
  {
    id: 'duplicate',
    label: 'Duplicate selection',
    disabled:
      !selectedWidgets.value.length ||
      (page.value?.sections.length || 0) + selectedTree.value.length > 30,
  },
  { id: 'front', label: 'Bring to front', disabled: !selectedWidgets.value.length },
  { id: 'back', label: 'Send to back', disabled: !selectedWidgets.value.length },
  { id: 'group', label: 'Group in container', disabled: !canGroup.value },
  ...(selectedWidgets.value.length > 1
    ? arrangementOptions.value.map((option) => ({
        id: option.id,
        label: option.label,
        disabled: !Object.keys(option.layouts).length,
      }))
    : []),
  {
    id: 'all',
    label: 'Select all widgets',
    disabled: !page.value?.sections.some((entry) => !entry.hidden),
  },
  {
    id: 'delete',
    label: 'Remove selection',
    danger: true,
    disabled: !selectedWidgets.value.length,
  },
])
function closeMenu(restore = false) {
  menu.value = undefined
  overlapTargets.value = []
  if (restore) menuOpener?.focus({ preventScroll: true })
}
function chooseCanvasScope(ownerId: string | undefined) {
  if (ownerId && ownerId !== page.value?.id) chooseScope(ownerId === site.value?.sharedLayout?.id)
}
function startCanvasMarquee(event: PointerEvent, ownerId: string) {
  if (locked.value || !designMode.value) return
  chooseCanvasScope(ownerId)
  widgetDrag.startMarquee(event)
}
async function openMenu(event: MouseEvent, id = '', ownerId?: string) {
  if (!designMode.value) return
  if (locked.value) return
  chooseCanvasScope(ownerId)
  if (id) chooseSectionScope(id)
  event.preventDefault()
  overlapTargets.value = objectsAtPoint(event)
  widgetDrag.cancel()
  if (id && !selectedIds.value.includes(id)) setSelection([id])
  if (!id) setSelection([])
  const surface = websiteCanvas.value?.getSurface(editingLayout.value)
  const bounds = surface?.getBoundingClientRect()
  const scale = bounds && surface ? bounds.width / surface.offsetWidth : 1
  const point =
    !id && bounds
      ? {
          x: Math.max(0, (event.clientX - bounds.left) / (45 * scale)),
          y: Math.max(0, (event.clientY - bounds.top) / (32 * scale)),
        }
      : undefined
  menuOpener =
    (event.target as HTMLElement).closest<HTMLElement>('[tabindex],button') || previewScroller.value
  menu.value = undefined
  await nextTick()
  menu.value = { x: event.clientX, y: event.clientY, point }
}
function widgetToolbarAction(action: string, trigger?: Event) {
  if (locked.value || !designMode.value || !section.value) return
  if (action === 'settings') {
    chooseSection(section.value.id)
    void nextTick(() => inspectorPane.value?.focus({ preventScroll: true }))
  } else if (action === 'deselect') setSelection([])
  else if (action === 'lock') {
    if (section.value.parentId && layoutLocked(page.value?.sections || [], section.value.parentId))
      return
    widgetDrag.cancel()
    history.change(() => {
      section.value!.locked = !section.value!.locked
    })
  } else selectionAction(action, trigger)
}
async function selectionAction(action: string, trigger?: Event) {
  if (!designMode.value) return
  if (locked.value || !page.value) return
  if (action.startsWith('select-object:')) {
    const entry = overlapTargets.value[Number(action.split(':')[1])]
    closeMenu()
    if (entry?.target) void revealElement(entry.target)
    else if (entry) revealLayer(entry.id)
    return
  }
  if (
    ['delete', 'duplicate', 'copy'].includes(action) &&
    selectedTree.value.some((section) => section.type === 'page-content')
  ) {
    error.value = 'Keep the page-content slot in the site layout.'
    return
  }
  const point = menu.value?.point
  closeMenu(true)
  if (action === 'group') {
    groupWidgets()
    return
  }
  if (arrangementActions.some((option) => option.id === action)) {
    arrangeWidgets(action)
    return
  }
  if (action === 'all') {
    setSelection(page.value.sections.filter((entry) => !entry.hidden).map((entry) => entry.id))
    return
  }
  if (action === 'copy') {
    clipboard.value = JSON.parse(JSON.stringify(selectedTree.value))
    message.value = `${clipboard.value.length} widget(s) copied in this editor.`
    return
  }
  if (action === 'paste' || action === 'duplicate') {
    const source = action === 'paste' ? clipboard.value : selectedTree.value
    const copies = cloneWidgets(source, page.value.sections, point)
    if (!copies.length) return
    history.change(() => page.value!.sections.push(...copies))
    const copiedIds = new Set(copies.map((entry) => entry.id))
    setSelection(
      copies
        .filter((entry) => !entry.parentId || !copiedIds.has(entry.parentId))
        .map((entry) => entry.id),
    )
  } else if (action === 'front' || action === 'back') {
    const layouts = layerSelection(page.value.sections, selectedIds.value, action === 'front')
    history.change(() => {
      for (const entry of page.value!.sections)
        if (layouts[entry.id]) entry.layout = layouts[entry.id]
    })
  } else if (action === 'delete' && selectedWidgets.value.length) {
    const target = page.value
    const ids = selectedTree.value.map((entry) => entry.id)
    if (
      !(await confirmation.value?.ask(
        {
          title: 'Remove widgets?',
          message:
            'Remove ' +
            ids.length +
            ' widget(s), including container contents, from this draft? You can undo this change.',
          confirmLabel: 'Remove widgets',
          destructive: true,
        },
        trigger,
      )) ||
      locked.value ||
      page.value !== target
    )
      return
    history.change(() => {
      page.value!.sections = page.value!.sections.filter((entry) => !ids.includes(entry.id))
    })
    setSelection([])
  }
}
function editorKey(event: KeyboardEvent) {
  if (
    locked.value ||
    event.defaultPrevented ||
    (event.target instanceof HTMLElement &&
      event.target.closest('input,textarea,select,[contenteditable]'))
  )
    return
  const command = event.ctrlKey || event.metaKey
  if (command && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault()
    widgetDrag.cancel()
    closeMenu()
    if (event.key.toLowerCase() === 'y' || event.shiftKey) history.redo()
    else history.undo()
    return
  }
  const action = command
    ? { a: 'all', c: 'copy', v: 'paste', d: 'duplicate' }[event.key.toLowerCase()]
    : ['Delete', 'Backspace'].includes(event.key)
      ? 'delete'
      : undefined
  if (action) {
    event.preventDefault()
    selectionAction(action)
  } else if (event.key === 'Escape') {
    const wasDragging = widgetDrag.dragging.value
    widgetDrag.cancel()
    if (!wasDragging) setSelection([])
    closeMenu()
  }
}
// Keep an unfinished numeric edit through Fit/ResizeObserver rerenders until blur commits it.
const geometryInput = ref<{ id: string; field: keyof WidgetGeometry; value: string }>()
function geometryValue(field: keyof WidgetGeometry) {
  const edit = geometryInput.value
  return edit && edit.id === section.value?.id && edit.field === field
    ? edit.value : section.value?.layout?.[field]
}
function holdGeometry(field: keyof WidgetGeometry, event: Event) {
  if (section.value) geometryInput.value = { id: section.value.id, field, value: (event.target as HTMLInputElement).value }
}
function setGeometry(field: keyof WidgetGeometry, event: Event) {
  if (!section.value?.layout || locked.value || sectionFixed.value) return
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  const next = { ...section.value.layout, [field]: Math.round(value * 1000) / 1000 }
  if (
    !Number.isFinite(value) ||
    input.value === '' ||
    next.x < 0 ||
    next.y < 0 ||
    next.w < 1 ||
    next.h < 1 ||
    next.x + next.w > 1000 ||
    next.y + next.h > 10000 ||
    !Number.isInteger(next.z) ||
    next.z < 0 ||
    next.z > 10000
  ) {
    input.value = String(section.value.layout[field])
    return
  }
  commitGeometry(section.value.id, next)
}
const auth = useAuthStore()
const panels = useBuilderPanels({
  scope: () =>
    auth.currentUser?.uid
      ? 'website:' +
        (import.meta.env.VITE_FIREBASE_PROJECT_ID || 'default') +
        ':' +
        auth.currentUser.uid
      : '',
  root: builderRoot,
  leftOpen: leftPanelOpen,
  rightOpen: rightPanelOpen,
})
const remoteChangePending = ref(false)
const starterReview = ref(false)
const starterConfirmation = ref(false)

const autosave = useWebsiteAutosave({
  scope: () =>
    auth.currentUser?.uid
      ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'default'}:${auth.currentUser.uid}`
      : '',
  site,
  saved,
  version,
  manualSave: () => starterReview.value,
  blocked: () => locked.value || starterReview.value || starterConfirmation.value || !!cssError.value || !auth.currentUser || remoteChangePending.value,
  save: (draft, baseVersion) =>
    websiteCommand<{ version: number }>('save', { site: draft, version: baseVersion }),
})
const recoveryKey = ref('')
const recovery = computed(
  () =>
    autosave.recoveries.value.find((entry) => entry.key === recoveryKey.value) ||
    autosave.recoveries.value[0],
)
let loadedServer = false
let loadedSnapshot = ''
let loadedVersion = 0
const draftSync = useWebsiteDraftSync({
  scope: () =>
    auth.currentUser?.uid
      ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'default'}:${auth.currentUser.uid}`
      : '',
  snapshot: draftSnapshot,
  version,
  ready: () => loadedServer && autosave.ready.value && !loading.value,
  // Materialized editor defaults are not user edits. Once the server version
  // changes, the older load baseline must not excuse an intentional Undo.
  dirty: () =>
    dirty.value && (version.value !== loadedVersion || draftSnapshot.value !== loadedSnapshot),
  blocked: () =>
    locked.value ||
    starterReview.value ||
    starterConfirmation.value ||
    saving.value ||
    autosave.saving.value ||
    autosave.conflict.value ||
    autosave.recoveries.value.length > 0 ||
    widgetDrag.dragging.value ||
    !!inlineTarget.value ||
    !!imageTarget.value ||
    !!selectedText.value ||
    runningCode.value ||
    !!document.activeElement?.closest(
      'input, textarea, select, [contenteditable], dialog[open], [role="dialog"]',
    ),
  load: () => websiteCommand<WebsiteState>('load'),
  apply: applySharedDraft,
})
watch(draftSync.newerVersion, (value) => (remoteChangePending.value = value !== null), {
  flush: 'sync',
})
function applySharedDraft(result: WebsiteState) {
  autosave.ready.value = false
  history.reset(withWebsiteDefaults(result.draft))
  loadedSnapshot = draftSnapshot.value
  loadedVersion = result.version
  version.value = result.version
  saved.value = JSON.stringify(result.draft)
  publishedAt.value = result.publishedAt
  hasPrevious.value = result.hasPrevious
  homePageId.value = result.draft.pages.find((entry) => entry.slug === 'home')?.id || ''
  if (!contentPage.value) selectedPage.value = result.draft.pages[0]?.id || ''
  if (editingLayout.value && !site.value?.sharedLayout) editingLayout.value = false
  if (!section.value) setSelection([])
  autosave.conflict.value = false
  autosave.problem.value = ''
  autosave.discover(saved.value)
  autosave.begin()
  message.value = 'Shared draft updated.'
}
function downloadRecovery() {
  const draft = site.value || recovery.value?.draft
  if (!draft) return
  autosave.persist()
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `website-recovery-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function importStarter(trigger?: Event) {
  if (locked.value || !site.value || !auth.currentUser || starterConfirmation.value) return
  const snapshot = JSON.stringify(site.value)
  const uid = auth.currentUser.uid
  starterConfirmation.value = true
  try {
    await autosave.settle()
    if (!(await confirmation.value?.ask({
      title: 'Review the nine-page starter?',
      message: 'This replaces the pages in this editor with an editable placeholder starter. A browser backup and downloaded copy preserve your current draft. Automatic saving stays paused until you choose Save draft. The published website stays unchanged. Careers is hidden until you configure its recipients.',
      confirmLabel: 'Back up and review starter',
      destructive: true,
    }, trigger))) return
    if (locked.value || uid !== auth.currentUser?.uid || snapshot !== JSON.stringify(site.value)) {
      message.value = 'The draft changed while confirming. Review it and try again.'
      return
    }
    const scope = (import.meta.env.VITE_FIREBASE_PROJECT_ID || 'default') + ':' + uid
    const backup = backupBeforeStarter(localStorage, scope, site.value, version.value, saved.value)
    const next = starterFromDraft(site.value)
    endInline()
    endImage()
    widgetDrag.cancel()
    closeMenu()
    downloadRecovery()
    autosave.stash()
    // Backups share the recovery contract so the existing Recover edits UI can restore them.
    localStorage.setItem('website-recovery:v1:' + encodeURIComponent(scope) + ':starter-' + crypto.randomUUID(), backup.value)
    starterReview.value = true
    autosave.discover(saved.value)
    history.change(() => { site.value = next })
    editingLayout.value = false
    selectedPage.value = next.pages[0]?.id || ''
    homePageId.value = selectedPage.value
    setSelection([])
    runningCode.value = false
    error.value = ''
    message.value = 'Starter review is local. Automatic saving is paused. Save draft only when you are ready to replace the private draft; publication remains a separate action.'
    await nextTick()
    fitView()
  } catch {
    error.value = 'The starter was not imported because a draft backup could not be saved. Your current draft is unchanged.'
  } finally { starterConfirmation.value = false }
}

async function recoverDraft(trigger?: Event) {
  const record = recovery.value
  if (
    !record ||
    locked.value ||
    (JSON.stringify(site.value) !== loadedSnapshot && !(await canDiscard(trigger)))
  )
    return
  const serverVersion = version.value
  starterReview.value = record.manualSave === true
  autosave.stash()
  autosave.ready.value = false
  history.reset(withWebsiteDefaults(record.draft))
  saved.value = record.saved
  version.value = record.version
  autosave.conflict.value = loadedServer && serverVersion !== record.version
  autosave.problem.value = autosave.conflict.value
    ? 'The online draft changed since this recovery copy. Automatic saving is paused. Download your recovery copy before reloading the latest draft to review it.'
    : ''
  selectedPage.value = site.value!.pages[0]?.id || ''
  selectedSection.value = ''
  homePageId.value = site.value!.pages.find((entry) => entry.slug === 'home')?.id || ''
  autosave.begin(true)
  autosave.persist()
  if (autosave.protectedLocally.value) autosave.forget(record)
  error.value = ''
  message.value = 'Browser recovery restored. The published website has not changed.'
}
async function canDiscard(trigger?: Event) {
  return (
    !dirty.value ||
    !!(await confirmation.value?.ask(
      {
        title: 'Discard unsaved changes?',
        message: 'Your unsaved website changes will be replaced. Keep editing to save them first.',
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
        destructive: true,
      },
      trigger,
    ))
  )
}
async function load(trigger?: Event) {
  if (!(await canDiscard(trigger))) return
  autosave.stash()
  autosave.ready.value = false
  loading.value = true
  error.value = ''
  message.value = ''
  let receivedDraft = false
  try {
    await autosave.settle()
    const result = await websiteCommand<WebsiteState>('load')
    history.reset(withWebsiteDefaults(result.draft))
    starterReview.value = false
    loadedSnapshot = JSON.stringify(site.value)
    loadedVersion = result.version
    version.value = result.version
    saved.value = JSON.stringify(result.draft)
    receivedDraft = true
    loadedServer = true
    autosave.conflict.value = false
    autosave.problem.value = ''
    autosave.discover(saved.value)
    if (dirty.value)
      message.value =
        'This draft is ready for the grid editor. Review the layout and save it before publishing.'
    publishedAt.value = result.publishedAt
    hasPrevious.value = result.hasPrevious
    homePageId.value = result.draft.pages.find((page) => page.slug === 'home')?.id || ''
    selectedPage.value = result.draft.pages[0]?.id || ''
    selectedSection.value = ''
    await nextTick()
    fitView()
  } catch (reason) {
    error.value = websiteError(reason)
  } finally {
    loading.value = false
    if (site.value) autosave.begin(!receivedDraft)
  }
}
async function command(
  action: 'save' | 'publish' | 'restore' | 'unpublish' | 'restoreRevision',
  revisionId?: string,
  trigger?: Event,
) {
  if (locked.value || !site.value) return
  if ((action === 'save' || action === 'publish') && cssError.value) {
    error.value = cssError.value
    return
  }
  if (action === 'save' && !autosave.online.value) {
    autosave.persist()
    message.value = autosave.protectedLocally.value
      ? 'Saved in this browser. Your draft will sync when the connection returns.'
      : ''
    return
  }
  if (
    action === 'publish' &&
    !(await confirmation.value?.ask(
      {
        title: 'Publish website?',
        message: 'Your saved pages and images will be visible to anyone with the website link.',
        confirmLabel: 'Publish website',
      },
      trigger,
    ))
  )
    return
  if (
    action === 'unpublish' &&
    !(await confirmation.value?.ask(
      {
        title: 'Take website offline?',
        message:
          'Visitors will no longer see the published website. Your saved draft will remain available.',
        confirmLabel: 'Take offline',
        destructive: true,
      },
      trigger,
    ))
  )
    return
  if ((action === 'restore' || action === 'restoreRevision') && !(await canDiscard(trigger))) return
  if (locked.value || !site.value) return
  if (action === 'publish' && publishBlocked.value) {
    error.value = 'Resolve the publishing checks before publishing.'
    return
  }
  history.checkpoint()
  busy.value = true
  saving.value = action === 'save'
  error.value = ''
  message.value = ''
  try {
    await autosave.settle()
    const snapshot = JSON.stringify(site.value)
    const result = await websiteCommand<{
      version: number
      draft?: WebsiteSite
      publishedAt?: number | null
      hasPrevious?: boolean
    }>(action, {
      version: version.value,
      ...(action === 'save' ? { site: JSON.parse(snapshot) } : {}),
      ...(action === 'restoreRevision' ? { revisionId } : {}),
    })
    version.value = result.version
    if (action === 'save') {
      starterReview.value = false
      saved.value = snapshot
      autosave.problem.value = ''
      autosave.conflict.value = false
    }
    if (result.draft) {
      history.reset(withWebsiteDefaults(result.draft))
      loadedSnapshot = draftSnapshot.value
      loadedVersion = result.version
      saved.value = JSON.stringify(result.draft)
      homePageId.value = result.draft.pages.find((page) => page.slug === 'home')?.id || ''
      selectedPage.value = result.draft.pages[0]?.id || ''
      selectedSection.value = ''
    }
    if (result.publishedAt !== undefined) publishedAt.value = result.publishedAt
    if (result.hasPrevious !== undefined) hasPrevious.value = result.hasPrevious
    autosave.persist()
    message.value = {
      save: 'Draft saved. The published website has not changed.',
      publish: 'Website published.',
      restore: 'Previous published version restored to your draft. Review it before publishing.',
      unpublish: 'Website taken offline. Your draft is retained.',
      restoreRevision: 'Saved version restored to your draft. Review it before publishing.',
    }[action]
  } catch (reason) {
    error.value = websiteError(reason)
    if (action === 'save') autosave.reportFailure(reason)
  } finally {
    busy.value = false
    saving.value = false
  }
}
function choosePage(id: string) {
  runningCode.value = false
  if (locked.value) return
  history.checkpoint()
  settingsPanel.value = 'page'
  editingLayout.value = false
  selectedPage.value = id
  selectedSection.value = ''
  activePane.value = 'inspector'
}
async function reviewIssue(issue: PublishingIssue) {
  if (locked.value || !site.value) return
  if (issue.target === 'code' || issue.target === 'site-code') changeMode('code')
  else if (codeMode.value || issue.target === 'site' || issue.target === 'widgets')
    changeMode('design')
  if (issue.pageId === site.value.sharedLayout?.id) chooseScope(true)
  else choosePage(issue.pageId)
  chooseSection(issue.sectionId || '')
  if (issue.target === 'site' || issue.target === 'site-code') openSiteSettings()
  if (issue.target === 'widgets') {
    if (customDefinition(section.value?.custom, site.value.customWidgets)?.kind === 'code')
      changeMode('code')
    openBuilderTool('widgets')
  } else {
    // Keep checks available alongside the setting being corrected.
    builderTool.value = 'publishing'
    await nextTick()
    if (issue.target === 'form-delivery') {
      inspectorTab.value = 'content'
      await nextTick()
      const recipients =
        inspectorPane.value?.querySelector<HTMLTextAreaElement>('[data-form-recipients]')
      recipients?.focus({ preventScroll: true })
      recipients?.scrollIntoView({ block: 'center', inline: 'nearest' })
    } else inspectorPane.value?.focus({ preventScroll: true })
  }
}
function chooseSection(id: string, event?: MouseEvent) {
  rightPanelOpen.value = true
  if (!locked.value) {
    if (id) chooseSectionScope(id)
    endInline()
    selectedText.value = undefined
    endImage()
    history.checkpoint()
    settingsPanel.value = 'page'
    if (designMode.value && event?.shiftKey && id)
      setSelection(
        selectedIds.value.includes(id)
          ? selectedIds.value.filter((value) => value !== id)
          : [...selectedIds.value, id],
      )
    else if (!id || !selectedIds.value.includes(id)) setSelection(id ? [id] : [])
    else selectedSection.value = id
    activePane.value = 'inspector'
  }
}
function selectLayer(id: string, event: MouseEvent) {
  const pane = activePane.value
  chooseSection(id, event)
  activePane.value = pane
}
function changeLayer(source: string, target: string, placement: 'before' | 'after') {
  if (!designMode.value) return
  if (!page.value || locked.value) return
  widgetDrag.cancel()
  const sections = reorderLayer(page.value.sections, source, target, placement)
  if (sections === page.value.sections) return
  history.change(() => {
    page.value!.sections = sections
  })
  setSelection([source])
}
function saveReusableSection(name: string) {
  if (selectedTree.value.some((section) => section.type === 'page-content')) return
  if (locked.value || !site.value || !page.value || (site.value.savedSections?.length || 0) >= 20)
    return
  const entry = captureSavedSection(page.value.sections, selectedIds.value, name)
  if (!entry) return
  history.change(() => {
    site.value!.savedSections = [...(site.value!.savedSections || []), entry]
  })
  message.value = `Added ${entry.name} to the saved widget library. Save draft to keep it.`
}
function renameReusableSection(id: string, name: string) {
  if (locked.value || !name.trim() || name.trim().length > 80) return
  const entry = site.value?.savedSections?.find((entry) => entry.id === id)
  if (entry)
    history.change(() => {
      entry.name = name.trim()
    })
}
function removeReusableSection(id: string) {
  if (locked.value || !site.value) return
  history.change(() => {
    site.value!.savedSections = site.value!.savedSections?.filter((entry) => entry.id !== id)
  })
  message.value =
    'Removed from the library. Existing page copies are unchanged. Undo can restore it.'
}
function addReusableSection(id: string) {
  if (locked.value || !page.value) return
  const entry = site.value?.savedSections?.find((entry) => entry.id === id)
  if (!entry) return
  const before = new Set(page.value.sections.map((section) => section.id))
  const sections = insertSavedSection(entry, page.value.sections)
  if (!sections) {
    error.value =
      'This section does not fit within the page limits. Make room or choose another page.'
    return
  }
  widgetDrag.cancel()
  history.change(() => {
    page.value!.sections = sections
  })
  const ids = sections
    .filter((section) => !before.has(section.id) && !section.parentId)
    .map((section) => section.id)
  setSelection(ids)
  message.value = `Inserted a copy of ${entry.name}. Changes to this copy stay on this page.`
  if (ids[0]) void revealLayer(ids[0], true)
}
async function revealLayer(id: string, preserveSelection = false) {
  if (locked.value || !page.value) return
  widgetDrag.cancel()
  history.checkpoint()
  if (!preserveSelection) setSelection([id])
  activePane.value = 'preview'
  await nextTick()
  const element = Array.from(
    websiteCanvas.value
      ?.getSurface(editingLayout.value)
      ?.querySelectorAll<HTMLElement>('[data-widget-id]') || [],
  ).find((element) => element.dataset.widgetId === id)
  if (!element) {
    activePane.value = 'inspector'
    message.value =
      'This object or its container is hidden in this preview. It is selected in the editor.'
    return
  }
  // Scroll only the preview and its inner containers, leaving the app shell in place.
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const bounds = parent.getBoundingClientRect()
    const target = element.getBoundingClientRect()
    const scaleX = bounds.width / parent.offsetWidth || 1
    const scaleY = bounds.height / parent.offsetHeight || 1
    if (parent.scrollHeight > parent.clientHeight)
      parent.scrollTop +=
        (target.top - bounds.top - Math.max(16, (bounds.height - target.height) / 2)) / scaleY
    if (parent.scrollWidth > parent.clientWidth)
      parent.scrollLeft +=
        (target.left - bounds.left - Math.max(16, (bounds.width - target.width) / 2)) / scaleX
    if (parent === previewScroller.value) break
  }
  element.focus({ preventScroll: true })
}

const selectedForm = computed(() =>
  site.value?.forms?.find((form) => form.id === section.value?.formId),
)
function addWebsiteForm(existing?: WebsiteFormDefinition) {
  if (
    !site.value ||
    !page.value ||
    locked.value ||
    page.value.sections.length >= 30 ||
    (!existing && (site.value.forms?.length || 0) >= 20)
  )
    return
  const form = existing || newWebsiteForm(crypto.randomUUID())
  const widget = {
    ...newSection('form'),
    title: form.name,
    formId: form.id,
    layout: nextGeometry(page.value.sections, 'form', { w: 16, h: 24 }),
  }
  history.change(() => {
    if (!existing) (site.value!.forms ||= []).push(form)
    page.value!.sections.push(widget)
  })
  setSelection([widget.id])
  activePane.value = 'inspector'
}
function updateWebsiteForm(form: WebsiteFormDefinition) {
  if (!site.value || locked.value) return
  history.change(() => {
    site.value!.forms = site.value!.forms?.map((entry) => (entry.id === form.id ? form : entry))
  })
}
function formUsed(id: string) {
  return [
    ...(site.value?.pages || []),
    ...(site.value?.sharedLayout ? [site.value.sharedLayout] : []),
    ...(site.value?.savedSections || []),
  ].some((page) => page.sections.some((section) => section.formId === id))
}
function removeWebsiteForm(id: string) {
  if (!site.value || locked.value || formUsed(id)) return
  history.change(() => {
    site.value!.forms = site.value!.forms?.filter((form) => form.id !== id)
  })
}
function createCustom(name: string) {
  if (locked.value || !site.value || !page.value || (site.value.customWidgets?.length || 0) >= 20)
    return
  const definition = captureCustomWidget(page.value.sections, selectedIds.value, name)
  if (!definition) {
    error.value = 'Select built-in widgets or a container to create a custom widget.'
    return
  }
  history.change(() => {
    ;(site.value!.customWidgets ||= []).push(definition)
  })
  message.value = 'Custom widget created. Add linked placements from Custom widgets.'
}
function insertCustom(definition: CustomWidgetDefinition, linked: boolean) {
  if (locked.value || !site.value || !page.value || page.value.sections.length >= 30) return
  const widget = customPlacement(definition, page.value.sections, linked)
  if (widget.layout!.y + widget.layout!.h > 10000) {
    error.value = 'There is no room below the existing widgets.'
    return
  }
  history.change(() => page.value!.sections.push(widget))
  setSelection([widget.id])
}
function saveCustom(definition: CustomWidgetDefinition) {
  if (locked.value || !site.value) return
  if (
    !(site.value.customWidgets || []).some((entry) => entry.id === definition.id) &&
    (site.value.customWidgets?.length || 0) >= 20
  )
    return
  history.change(() => updateCustomDefinition(site.value!, definition))
  message.value =
    'Custom widget updated. Linked placements use the new design; save draft to keep it.'
}
function removeCustom(id: string) {
  if (!site.value || locked.value || customUsages(site.value, id).length) return
  history.change(() => {
    site.value!.customWidgets = site.value!.customWidgets?.filter((entry) => entry.id !== id)
  })
}
function detachSelectedCustom() {
  if (!site.value || !section.value?.custom || locked.value) return
  history.change(() => detachCustom(section.value!, site.value!))
}
function setCustomValue(key: string, value: string | undefined) {
  if (!section.value?.custom || locked.value) return
  history.change(() => {
    if (value === undefined) delete section.value!.custom!.values[key]
    else section.value!.custom!.values[key] = value
  })
}
function saveIndependentCustom(definition: CustomWidgetDefinition) {
  if (!section.value?.custom?.inline || locked.value) return
  history.change(() => {
    section.value!.custom = {
      inline: definition,
      values: Object.fromEntries(
        Object.entries(section.value!.custom!.values).filter(([key]) =>
          definition.fields.some((field) => field.key === key),
        ),
      ),
    }
  })
}

function addPage() {
  if (!site.value || site.value.pages.length >= 30) return
  let count = 1
  while (site.value.pages.some((page) => page.slug === `page-${count}`)) count++
  const id = crypto.randomUUID()
  const entry: WebsitePage = {
    id,
    chrome: 'widgets' as const,
    layout: { mobile: 'flow' as const, tablet: 'flow' as const },
    title: 'New page',
    grid: defaultGrid(),
    slug: `page-${count}`,
    description: '',
    inNavigation: true,
    sections: [],
  }
  if (site.value.sharedLayout) {
    entry.useSiteLayout = true
    entry.sections = entry.sections.filter(
      (section) => !['navigation', 'footer'].includes(section.type),
    )
  }
  history.change(() => site.value!.pages.push(entry))
  choosePage(id)
}
function addTemplatePage() {
  if (locked.value || !site.value || site.value.pages.length >= 30) return
  const entry = pageFromTemplate(pageTemplate.value, site.value.pages)
  if (site.value.sharedLayout) {
    entry.useSiteLayout = true
    entry.sections = entry.sections.filter(
      (section) => !['navigation', 'footer'].includes(section.type),
    )
  }
  entry.sections = materializeGrid(entry.sections)
  entry.grid = defaultGrid()
  history.change(() => site.value!.pages.push(entry))
  choosePage(entry.id)
  message.value =
    'Template added to your draft. Replace the starter headings and add your content before publishing.'
}
function duplicatePage() {
  if (editingLayout.value) return
  if (locked.value || !site.value || !page.value || site.value.pages.length >= 30) return
  const entry = copyPage(page.value, site.value.pages)
  history.change(() =>
    site.value!.pages.splice(site.value!.pages.indexOf(page.value!) + 1, 0, entry),
  )
  choosePage(entry.id)
}
function duplicateSection() {
  if (!section.value) return
  setSelection([section.value.id])
  selectionAction('duplicate')
}
function travelHistory(direction: 'undo' | 'redo') {
  if (locked.value) return
  history[direction]()
  if (editingLayout.value && !site.value?.sharedLayout) editingLayout.value = false
  if (!page.value) selectedPage.value = site.value?.pages[0]?.id || ''
  if (!section.value) selectedSection.value = ''
  message.value = ''
  error.value = ''
}
async function removePage(trigger?: Event) {
  if (
    locked.value ||
    editingLayout.value ||
    !site.value ||
    !page.value ||
    page.value.slug === 'home'
  )
    return
  const target = page.value
  if (
    !(await confirmation.value?.ask(
      {
        title: 'Remove page?',
        message:
          'Remove "' +
          target.title +
          '" and its widgets from the draft? You can undo this change. The live website changes only when you publish.',
        confirmLabel: 'Remove page',
        destructive: true,
      },
      trigger,
    )) ||
    locked.value ||
    page.value !== target
  )
    return
  history.change(() => {
    site.value!.pages = site.value!.pages.filter((item) => item.id !== target.id)
  })
  choosePage(site.value.pages[0]?.id || '')
}

function move<T>(list: T[], index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= list.length) return
  history.change(() => {
    const [item] = list.splice(index, 1)
    if (item) list.splice(target, 0, item)
  })
}
function removeSection(trigger?: Event) {
  if (!section.value) return
  setSelection([section.value.id])
  selectionAction('delete', trigger)
}
function updateSection(value: WebsiteItem) {
  const target = site.value?.pages
    .flatMap((page) => page.sections)
    .find((section) => section.id === value.id)
  if (target) Object.assign(target, value)
}
function beforeUnload(event: BeforeUnloadEvent) {
  autosave.persist()
  if ((dirty.value && !autosave.protectedLocally.value) || uploading.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => {
  void load()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(() => {
  autosave.persist()
  return !uploading.value && !busy.value && (autosave.protectedLocally.value || canDiscard())
})
</script>
<template>
  <AppShell v-slot="{ openNavigation, mobileNavOpen }" contained compact>
    <div class="website-builder" @keydown="helpKey">
      <BuilderHelpDialog
        ref="guide"
        title="Editing guide"
        introduction="Quick controls for building pages. Widget shortcuts apply in the workspace; text fields keep their normal editing keys."
        :groups="editorHelp"
      />
      <BuilderConfirmDialog ref="confirmation" />
      <p v-if="starterReview" role="status" class="builder-status">Starter review: automatic saving is paused. Save draft deliberately to replace the private draft, or Undo to restore your previous layout. Your backup is also available in browser recovery.</p>
      <header class="builder-header builder-controls">
        <div class="builder-heading">
          <button
            class="builder-navigation"
            type="button"
            aria-label="Open navigation"
            title="Open navigation"
            aria-controls="app-shell-navigation"
            :aria-expanded="mobileNavOpen"
            @click="openNavigation"
          >
            <i class="pi pi-bars" aria-hidden="true"></i>
          </button>
          <div class="builder-title">
            <h1>Website Builder</h1>
            <p
              class="subtle"
              aria-live="polite"
              aria-atomic="true"
              :title="
                draftState +
                (publishedAt
                  ? ' · Published ' + new Date(publishedAt).toLocaleString()
                  : ' · Not published')
              "
            >
              {{ draftState }} ·
              {{
                publishedAt
                  ? `Published ${new Date(publishedAt).toLocaleString()}`
                  : 'Not published'
              }}
            </p>
          </div>
        </div>
        <div class="editor-modes" role="group" aria-label="Editor mode">
          <button
            v-for="mode in modes"
            :key="mode.id"
            :aria-pressed="editorMode === mode.id"
            :title="mode.description"
            :disabled="locked"
            @click="changeMode(mode.id)"
          >
            {{ mode.label }}
          </button>
        </div>
        <div class="builder-actions">
          <button
            type="button"
            aria-label="Editing guide"
            title="Editing guide (?)"
            @click="guide?.open($event)"
          >
            <i class="pi pi-question-circle" aria-hidden="true" />
          </button>
          <button
            :disabled="locked || !canUndo"
            aria-label="Undo"
            :title="`Undo draft edit (${commandKey} + Z)`"
            @click="travelHistory('undo')"
          >
            <i class="pi pi-undo" aria-hidden="true"></i>
          </button>
          <button
            :disabled="locked || !canRedo"
            aria-label="Redo"
            :title="`Redo draft edit (${commandKey} + Shift + Z)`"
            @click="travelHistory('redo')"
          >
            <i class="pi pi-refresh" aria-hidden="true"></i>
          </button>
          <button
            :disabled="locked"
            aria-label="Site settings"
            title="Edit shared website branding, fonts and colors"
            @click="openSiteSettings"
          >
            <i class="pi pi-cog" aria-hidden="true"></i
            ><span class="desktop-label"> Site settings</span></button
          ><a
            v-if="publishedAt"
            href="/website"
            target="_blank"
            rel="noopener"
            aria-label="View website"
            title="Open the published website in a new tab"
            class="view-website"
            ><i class="pi pi-external-link" aria-hidden="true"></i
            ><span class="desktop-label"> View website</span></a
          ><button
            aria-label="Save draft"
            title="Save your edits to the draft without publishing"
            :disabled="locked || !site || !!cssError"
            @click="command('save', undefined, $event)"
          >
            {{ saving ? 'Saving…' : 'Save draft' }}</button
          ><button
            class="primary"
            :title="
              dirty || !version
                ? 'Save your draft before publishing'
                : publishBlocked || cssError
                  ? 'Open Publishing to review issues before publishing'
                  : 'Publish the saved draft'
            "
            :disabled="locked || !site || dirty || !version || !!cssError || publishBlocked"
            @click="command('publish', undefined, $event)"
          >
            Publish
          </button>
        </div>
      </header>

      <div v-if="draftSync.newerVersion.value !== null" class="recovery-notice" aria-live="polite">
        <span>A newer shared draft is available. Your current edits are still here.</span>
        <button :disabled="locked" @click="load">Load latest draft</button>
      </div>
      <div v-if="recovery" class="recovery-notice" aria-label="Browser recovery">
        <span
          >Unsaved work is available from {{ new Date(recovery.updatedAt).toLocaleString() }}.</span
        >
        <select
          v-if="autosave.recoveries.value.length > 1"
          v-model="recoveryKey"
          aria-label="Recovery copy"
        >
          <option v-for="record in autosave.recoveries.value" :key="record.key" :value="record.key">
            {{ new Date(record.updatedAt).toLocaleString() }}
          </option>
        </select>
        <button :disabled="locked" @click="recoverDraft">Recover edits</button>
        <button :disabled="locked" @click="autosave.forget(recovery)">Discard recovery</button>
      </div>
      <div
        v-if="autosave.problem.value || autosave.storageProblem.value"
        class="recovery-notice"
        aria-live="polite"
      >
        <span>{{ autosave.storageProblem.value || autosave.problem.value }}</span>
        <button @click="downloadRecovery">Download recovery copy</button>
      </div>

      <p v-if="cssError" role="alert" class="notice error">{{ cssError }}</p>
      <p v-if="error" role="alert" class="notice error">{{ error }}</p>
      <p v-if="loading" role="status">Loading website draft…</p>
      <nav v-if="site" class="pane-switcher builder-controls" aria-label="Builder panels">
        <button
          type="button"
          :aria-pressed="activePane === 'outline'"
          @click="activePane = 'outline'"
        >
          Pages & widgets
        </button>
        <button
          type="button"
          :aria-pressed="activePane === 'preview'"
          @click="activePane = 'preview'"
        >
          Preview
        </button>
        <button
          type="button"
          :aria-pressed="activePane === 'inspector'"
          @click="activePane = 'inspector'"
        >
          Editor
        </button>
      </nav>
      <fieldset
        v-if="site"
        ref="builderRoot"
        :disabled="locked"
        class="builder-grid"
        :style="panels.style.value"
        :data-active-pane="activePane"
        :data-editor-mode="editorMode"
        :class="{ 'left-closed': !leftPanelOpen, 'right-closed': !rightPanelOpen }"
        @focusout="history.checkpoint()"
        @click.capture="widgetDrag.guardClick"
        @keydown="editorKey"
      >
        <aside
          id="website-structure"
          class="outline builder-controls"
          aria-label="Website structure"
        >
          <nav class="builder-tools" aria-label="Workspace tools">
            <button
              v-for="tool in builderTools"
              :key="tool.id"
              :aria-pressed="builderTool === tool.id"
              :aria-label="tool.label"
              @click="openBuilderTool(tool.id)"
            >
              <i :class="['pi', tool.icon]" aria-hidden="true"></i><span>{{ tool.label }}</span>
              <small
                v-if="tool.id === 'publishing' && publishBlocked"
                class="publishing-count"
                aria-hidden="true"
                >{{ checks.filter((issue) => issue.level === 'error').length }}</small
              >
            </button>
          </nav>
          <div class="outline-content" data-widget-scroll>
            <div class="workspace-context">
              <span>{{
                editingLayout ? 'Shared site layout' : page?.title || 'Choose a page'
              }}</span>
              <button title="Edit page settings" @click="chooseSection('')">Page settings</button>
            </div>
            <div v-show="builderTool === 'pages'" class="tool-panel">
              <div class="outline-switcher" aria-label="Editing scope">
                <button :aria-pressed="!editingLayout" @click="chooseScope(false)">
                  Current page
                </button>
                <button
                  :aria-pressed="editingLayout"
                  :disabled="!site.sharedLayout"
                  @click="chooseScope(true)"
                >
                  Site layout
                </button>
              </div>
              <button
                v-if="!site.sharedLayout && editorMode !== 'content'"
                @click="createSharedLayout"
              >
                Create shared layout
              </button>
              <p v-if="editingLayout" class="subtle">
                Changes here apply to every page using the default layout.
              </p>
              <div class="pane-title">
                <h2>Pages</h2>
                <button v-if="designMode" :disabled="site.pages.length >= 30" @click="addPage">
                  + Page
                </button>
              </div>
              <div v-for="(entry, index) in site.pages" :key="entry.id" class="outline-row">
                <button
                  :class="{ active: entry.id === selectedPage }"
                  @click="choosePage(entry.id)"
                >
                  {{ entry.title }}<small>/{{ entry.slug }}</small></button
                ><button
                  v-if="designMode"
                  :aria-label="`Move ${entry.title} page up`"
                  :disabled="index === 0"
                  @click="move(site.pages, index, -1)"
                >
                  ↑</button
                ><button
                  v-if="designMode"
                  :aria-label="`Move ${entry.title} page down`"
                  :disabled="index === site.pages.length - 1"
                  @click="move(site.pages, index, 1)"
                >
                  ↓
                </button>
              </div>
              <details v-if="designMode" class="template-tools">
                <summary>Page templates</summary>
                <label
                  >Page template<select v-model="pageTemplate" aria-label="Page template">
                    <option v-for="(label, key) in pageTemplates" :key="key" :value="key">
                      {{ label }}
                    </option>
                  </select></label
                >
                <button :disabled="site.pages.length >= 30" @click="addTemplatePage">
                  Create from template
                </button>
              </details>
              <details class="template-tools">
                <summary>Complete website starter</summary>
                <p>Nine editable pages with placeholder copy and photo slots. Existing photos are reused; Careers starts hidden.</p>
                <button :disabled="locked || starterConfirmation" @click="importStarter">Review nine-page starter</button>
              </details>
              <h2 class="on-page-heading">On this page</h2>
              <div v-if="page" data-widget-surface="outline" class="widget-outline">
                <div
                  v-for="(entry, index) in page.sections"
                  :key="entry.id"
                  class="outline-row widget-outline-row"
                  :data-widget-id="entry.id"
                  @contextmenu.prevent="openMenu($event, entry.id)"
                >
                  <button
                    v-if="designMode"
                    class="widget-grip"
                    :aria-label="`Drag outline widget ${index + 1}`"
                    title="Drag widget to move"
                    @pointerdown="startOutlineMove($event, entry.id)"
                    @dragstart.prevent
                    @click="chooseSection(entry.id, $event)"
                  >
                    ⠿
                  </button>
                  <button
                    :class="{ active: selectedIds.includes(entry.id) }"
                    @click="chooseSection(entry.id, $event)"
                  >
                    {{ entry.title || sectionLabels[entry.type]
                    }}<small
                      >{{ sectionLabels[entry.type]
                      }}{{
                        entry.parentId
                          ? ' · In ' +
                            (page.sections.find((parent) => parent.id === entry.parentId)?.title ||
                              'container')
                          : ''
                      }}{{ entry.hidden ? ' · Hidden' : '' }}</small
                    ></button
                  ><button
                    v-if="designMode"
                    :aria-label="`Move section ${index + 1} up`"
                    :disabled="index === 0"
                    @click="move(page.sections, index, -1)"
                  >
                    ↑</button
                  ><button
                    v-if="designMode"
                    :aria-label="`Move section ${index + 1} down`"
                    :disabled="index === page.sections.length - 1"
                    @click="move(page.sections, index, 1)"
                  >
                    ↓
                  </button>
                </div>
                <p v-if="!page.sections.length" class="subtle">
                  This page is empty. Switch to Design to add widgets.
                </p>
              </div>
              <button v-if="designMode" class="add-widget-shortcut" @click="openWidgetLibrary">
                <i class="pi pi-plus" aria-hidden="true"></i> Add widgets
              </button>
            </div>
            <WebsiteLayersPanel
              v-if="page && builderTool === 'layers' && designMode"
              :key="page.id"
              :sections="layerSections"
              :selected-ids="selectedIds"
              :elements="canvasElements.map((entry) => entry.target)"
              :selected-element="selectedText"
              @select-element="selectElement"
              @reveal-element="revealElement"
              :disabled="locked"
              @select="selectLayer"
              @reveal="revealLayer"
              @reorder="changeLayer"
            />

            <div v-show="builderTool === 'widgets'" class="tool-panel">
              <template v-if="designMode">
                <details class="widget-library" open>
                  <summary>Widget library</summary>
                  <div class="widget-library-filters">
                    <label
                      >Find widgets<input
                        v-model="widgetSearch"
                        type="search"
                        placeholder="Search widgets..."
                    /></label>
                    <label
                      >Widget category<select aria-label="Widget category" v-model="widgetFilter">
                        <option>All</option>
                        <option v-for="category in widgetCategories" :key="category">
                          {{ category }}
                        </option>
                      </select></label
                    >
                    <p class="widget-result-count">
                      {{
                        Object.keys(filteredWidgets).length +
                        (matchesWidget('form', 'Form') ? 1 : 0)
                      }}
                      widgets
                      <button
                        v-if="widgetSearch || widgetFilter !== 'All'"
                        type="button"
                        @click="clearWidgetFilters"
                      >
                        Clear filters
                      </button>
                    </p>
                  </div>
                  <p class="subtle">Click to add, or drag onto the canvas.</p>
                  <p
                    v-if="!Object.keys(filteredWidgets).length && !matchesWidget('form', 'Form')"
                    class="subtle"
                  >
                    No matching widgets.
                  </p>
                  <section
                    v-for="group in widgetGroups"
                    :key="group.category"
                    class="widget-category-group"
                    :aria-label="group.category + ' widgets'"
                  >
                    <h3>
                      {{ group.category }}<span>{{ group.widgets.length }}</span>
                    </h3>
                    <div class="widget-library-grid">
                      <button
                        v-for="[type, label] in group.widgets"
                        :key="type"
                        class="widget-library-item"
                        :class="{ 'widget-library-item--form': type === 'form' }"
                        :disabled="
                          !page ||
                          page.sections.length >= 30 ||
                          (type === 'form' && (site.forms?.length || 0) >= 20)
                        "
                        :aria-label="'Add ' + label + ' widget'"
                        :title="widgetInfo(type).description"
                        @pointerdown="type !== 'form' && startNewWidget($event, type)"
                        @dragstart.prevent
                        @click="type === 'form' ? addWebsiteForm() : addWidget(type)"
                      >
                        <i :class="['pi', widgetInfo(type).icon]" aria-hidden="true" />
                        <span
                          >{{ label }}<small>{{ widgetInfo(type).description }}</small></span
                        >
                      </button>
                    </div>
                  </section>
                </details>
                <details class="template-tools">
                  <summary>Public forms</summary>
                  <p class="subtle">
                    Use the app's email sender. Recipients are configured in the form editor.
                  </p>
                  <button
                    :disabled="
                      !page || page.sections.length >= 30 || (site.forms?.length || 0) >= 20
                    "
                    @click="addWebsiteForm()"
                  >
                    Add contact form
                  </button>
                  <div v-for="form in site.forms || []" :key="form.id">
                    <span>{{ form.name }}</span
                    ><button
                      :disabled="!page || page.sections.length >= 30"
                      :aria-label="'Add form ' + form.name"
                      @click="addWebsiteForm(form)"
                    >
                      Add existing form</button
                    ><button
                      :disabled="formUsed(form.id)"
                      :aria-label="'Remove form ' + form.name"
                      @click="removeWebsiteForm(form.id)"
                    >
                      Remove form
                    </button>
                  </div>
                  <WebsiteFormSubmissions />
                </details>
              </template>
              <WebsiteCustomLibrary
                v-if="editorMode !== 'content'"
                :mode="editorMode"
                :site="site"
                :selected="section"
                :disabled="locked"
                :can-capture="
                  !!selectedTree.length &&
                  !selectedTree.some(
                    (entry) => entry.custom || entry.formId || entry.type === 'page-content',
                  )
                "
                :remaining="30 - (page?.sections.length || 0)"
                @capture="createCustom"
                @insert="insertCustom"
                @update="saveCustom"
                @remove="removeCustom"
                @detach="detachSelectedCustom"
                @value="setCustomValue"
                @uploading="uploading = $event"
                @independent="saveIndependentCustom"
              />
              <WebsiteSavedSections
                v-if="designMode"
                :site="site"
                :entries="site.savedSections || []"
                :selection-count="selectedTree.length"
                :suggested-name="
                  selectedWidgets.length === 1 ? section?.title || 'Saved widget' : 'Widget group'
                "
                :remaining="30 - (page?.sections.length || 0)"
                :disabled="locked || !page"
                :accent="site.accent"
                @save="saveReusableSection"
                @insert="addReusableSection"
                @rename="renameReusableSection"
                @remove="removeReusableSection"
              />
            </div>
            <div v-show="builderTool === 'publishing'" class="history-actions tool-panel">
              <button :disabled="locked" @click="load">Reload draft</button>
              <h2>Publishing</h2>
              <details open class="publishing-checks">
                <summary>Publishing checks ({{ checks.length }})</summary>
                <p v-if="!checks.length">Ready to publish.</p>
                <p v-else class="subtle">
                  {{ checks.filter((issue) => issue.level === 'error').length }} to fix ·
                  {{ checks.filter((issue) => issue.level === 'warning').length }} suggestions.
                  Select a check to open its settings.
                </p>
                <ul>
                  <li v-for="(issue, index) in checks" :key="index">
                    <button
                      type="button"
                      :class="{ 'check-error': issue.level === 'error' }"
                      @click="reviewIssue(issue)"
                    >
                      {{ issue.level === 'error' ? 'Fix' : 'Review' }}: {{ issue.message }}
                    </button>
                  </li>
                </ul>
              </details>
              <WebsitePublishComparison :site="site" :version="version" :disabled="locked" />
              <WebsiteRevisionHistory
                :site="site"
                :version="version"
                :disabled="locked"
                @restore="command('restoreRevision', $event)"
              />
              <p>Save your draft, then publish when it is ready.</p>
              <button :disabled="!hasPrevious" @click="command('restore', undefined, $event)">
                Restore previous to draft</button
              ><button
                v-if="publishedAt"
                class="danger"
                @click="command('unpublish', undefined, $event)"
              >
                Take website offline
              </button>
            </div>
          </div>
        </aside>
        <BuilderPanelResize
          v-if="leftPanelOpen"
          class="left-resize"
          label="Resize structure panel"
          controls="website-structure"
          :value="panels.widths.value.left"
          :min="panels.minimum.left"
          :max="panels.limits.value.left"
          :disabled="locked"
          @update:value="panels.set('left', $event)"
          @start="panels.begin"
          @cancel="panels.cancel"
          @commit="panels.save"
          @reset="panels.reset('left')"
        />
        <div class="preview-pane">
          <div class="preview-toolbar builder-controls" role="group" aria-label="Canvas controls">
            <div class="canvas-tool-group panel-tools" role="group" aria-label="Canvas panels">
              <button
                class="desktop-tool icon-tool"
                :aria-pressed="leftPanelOpen"
                aria-label="Toggle tools panel"
                title="Show or hide tools"
                @click="leftPanelOpen = !leftPanelOpen"
              >
                <i class="pi pi-bars" aria-hidden="true"></i>
              </button>
              <button
                class="desktop-tool icon-tool"
                :aria-pressed="!leftPanelOpen && !rightPanelOpen"
                aria-label="Focus canvas"
                title="Hide or restore both panels"
                @click="togglePanels"
              >
                <i class="pi pi-expand" aria-hidden="true"></i>
              </button>
              <button
                class="desktop-tool icon-tool"
                :aria-pressed="rightPanelOpen"
                aria-label="Toggle settings panel"
                title="Show or hide settings"
                @click="rightPanelOpen = !rightPanelOpen"
              >
                <i class="pi pi-sliders-h" aria-hidden="true"></i>
              </button>
            </div>
            <div class="canvas-tool-group zoom-tools" role="group" aria-label="Zoom and pan">
              <button @click="setZoom(zoom - 0.1)" aria-label="Zoom out" title="Zoom out">
                <i class="pi pi-minus" aria-hidden="true"></i>
              </button>
              <button
                class="zoom-value"
                @click="setZoom(1)"
                aria-label="Reset zoom"
                title="Show the preview at 100%. Device changes keep the same zoom."
              >
                {{ Math.round(zoom * 100) }}%
              </button>
              <button @click="setZoom(zoom + 0.1)" aria-label="Zoom in" title="Zoom in">
                <i class="pi pi-plus" aria-hidden="true"></i>
              </button>
              <button
                @click="fitView"
                :aria-pressed="autoFit"
                title="Fit the selected device to the workspace and follow device or panel changes. Manual zoom turns Fit off."
              >
                Fit
              </button>
              <button
                :aria-pressed="hand"
                aria-label="Pan"
                @click="hand = !hand"
                title="Pan with this tool, Space + drag, or the middle mouse button"
              >
                <i class="pi pi-arrows-alt" aria-hidden="true"></i>
              </button>
            </div>
            <div class="canvas-tool-group device-tools" role="group" aria-label="Preview device">
              <button
                v-for="option in ['desktop', 'tablet', 'mobile'] as const"
                :key="option"
                :aria-pressed="device === option"
                :aria-label="option[0]!.toUpperCase() + option.slice(1)"
                :title="`${option === 'mobile' ? 'Phone' : option[0]!.toUpperCase() + option.slice(1)} preview · ${option === 'desktop' ? canvasWidth : deviceWidth[option]} × ${deviceHeight[option]} CSS pixels · ${autoFit ? 'fits the workspace' : 'keeps manual zoom'}`"
                @click="chooseDevice(option)"
              >
                <i
                  :class="[
                    'pi',
                    { desktop: 'pi-desktop', tablet: 'pi-tablet', mobile: 'pi-mobile' }[option],
                  ]"
                  aria-hidden="true"
                ></i>
              </button>
              <span
                class="preview-dimensions"
                aria-label="Preview viewport size"
                title="Representative screen size in CSS pixels before editor zoom. Scroll inside the preview to see the rest of the page."
                >{{ previewWidth }} × {{ previewHeight }}</span
              >
            </div>
            <button v-if="codeMode" class="code-preview-action" @click="toggleCodePreview">
              <i :class="['pi', runningCode ? 'pi-stop' : 'pi-play']" aria-hidden="true"></i>
              {{ runningCode ? 'Stop code preview' : 'Run code preview' }}
            </button>
          </div>
          <div
            v-if="designMode && selectedWidgets.length > 1"
            class="selection-toolbar"
            role="group"
            aria-label="Selection actions"
          >
            <span
              :title="
                selectedWidgets.length === 1
                  ? section?.title || 'Widget'
                  : `${selectedWidgets.length} widgets selected`
              "
              >{{
                selectedWidgets.length === 1
                  ? section?.title || 'Widget'
                  : `${selectedWidgets.length} selected`
              }}</span
            >
            <button
              aria-label="Duplicate selection"
              title="Duplicate selection"
              :disabled="
                !selectedWidgets.length || (page?.sections.length || 0) + selectedTree.length > 30
              "
              @click="selectionAction('duplicate')"
            >
              <i class="pi pi-copy" aria-hidden="true"></i>
            </button>
            <button
              aria-label="Bring to front"
              title="Bring to front"
              @click="selectionAction('front')"
            >
              <i class="pi pi-angle-double-up" aria-hidden="true"></i>
            </button>
            <button aria-label="Send to back" title="Send to back" @click="selectionAction('back')">
              <i class="pi pi-angle-double-down" aria-hidden="true"></i>
            </button>
            <button
              aria-label="Group in container"
              title="Group in container"
              :disabled="!canGroup"
              @click="groupWidgets"
            >
              <i class="pi pi-objects-column" aria-hidden="true"></i>
            </button>
            <button
              aria-label="Deselect widgets"
              title="Deselect widgets"
              @click="setSelection([])"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
          <WebsiteWidgetToolbar
            v-if="
              designMode &&
              section &&
              selectedWidgets.length === 1 &&
              !inlineTarget &&
              !selectedText &&
              !imageTarget &&
              !runningCode
            "
            :key="section.id"
            :id="section.id"
            :scroller="previewScroller"
            :viewport="previewViewport"
            :disabled="locked"
            :fixed="sectionFixed"
            :own-lock="!!section.locked"
            :parent-locked="
              !!section.parentId && layoutLocked(page?.sections || [], section.parentId)
            "
            :can-transform="geometryEditable && !section.parentId"
            :can-resize-height="
              (!!section.parentId || editingLayout || isFlow(page?.layout, device)) &&
              section.type !== 'page-content'
            "
            :can-copy="
              (page?.sections.length || 0) + selectedTree.length <= 30 &&
              !selectedTree.some((entry) => entry.type === 'page-content')
            "
            :can-delete="!selectedTree.some((entry) => entry.type === 'page-content')"
            @action="widgetToolbarAction"
            @drag="(event, action) => startWidgetMove(event, section!.id, action)"
            @geometry-key="(event, action) => geometryKey(event, section!.id, action)"
          />
          <WebsiteAlignmentGuides :guides="widgetDrag.guides.value" />
          <div
            ref="previewScroller"
            class="preview-scroll"
            :class="{ 'pan-tool': hand }"
            :style="{ '--preview-handle-space': '0px' }"
            tabindex="0"
            aria-label="Website grid workspace"
            @pointerdown.capture="widgetDrag.background"
          >
            <div v-if="page && !page.sections.length && !runningCode" class="canvas-empty">
              <i class="pi pi-th-large" aria-hidden="true"></i>
              <h2>Start building {{ page.title }}</h2>
              <p>Add a widget, then select it to edit its content and design.</p>
              <button class="primary" @click="openWidgetLibrary">Add your first widget</button>
            </div>
            <div
              class="preview-scale"
              :style="{ width: `${previewWidth * zoom}px`, height: `${previewHeight * zoom}px` }"
            >
              <div class="preview-clip">
                <div
                  ref="previewFrame"
                  class="preview-frame"
                  :class="{ mobile }"
                  :style="{
                    width: `${previewWidth}px`,
                    height: `${previewHeight}px`,
                    transform: `scale(${zoom})`,
                    '--device-handle-space': `${designMode && !runningCode ? 40 : 0}px`,
                  }"
                >
                  <div
                    ref="previewViewport"
                    class="preview-viewport"
                    tabindex="0"
                    :aria-label="`${device === 'mobile' ? 'Phone' : device === 'tablet' ? 'Tablet' : 'Desktop'} website preview`"
                  >
                    <WebsiteScriptFrame
                      v-if="runningCode && codePreviewSite"
                      :key="selectedPage"
                      :site="codePreviewSite"
                      :page-id="selectedPage"
                      :viewport-height="previewHeight"
                      preview
                    />
                    <WebsiteCanvas
                      v-else
                      ref="websiteCanvas"
                      :site="site"
                      :page-id="selectedPage"
                      :layout-editor="editingLayout"
                      @select-layout="chooseSection"
                      :selected-id="selectedSection"
                      :selected-ids="selectedIds"
                      :marquee="marquee"
                      preview
                      :device="device"
                      :grid-draft="gridDraft"
                      :locked="locked"
                      :design-tools="designMode"
                      @select="chooseSection"
                      @page="choosePage"
                      @drag-widget="startWidgetMove"
                      @geometry-key="geometryKey"
                      @marquee-start="startCanvasMarquee"
                      @widget-menu="openMenu"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BuilderPanelResize
          v-if="rightPanelOpen"
          class="right-resize"
          label="Resize editor panel"
          controls="website-inspector"
          :value="panels.widths.value.right"
          :min="panels.minimum.right"
          :max="panels.limits.value.right"
          :disabled="locked"
          reverse
          @update:value="panels.set('right', $event)"
          @start="panels.begin"
          @cancel="panels.cancel"
          @commit="panels.save"
          @reset="panels.reset('right')"
        />
        <aside
          id="website-inspector"
          ref="inspectorPane"
          class="inspector builder-controls"
          aria-label="Content editor"
          tabindex="-1"
        >
          <BuilderSelectionContext
            :kind="
              settingsPanel === 'site'
                ? 'Site settings'
                : selectedWidgets.length > 1
                  ? selectedWidgets.length + ' widgets'
                  : selectionDetail?.label ||
                    (section ? 'Widget' : editingLayout ? 'Layout' : 'Page')
            "
            :scope="
              settingsPanel === 'site'
                ? 'Entire website'
                : editingLayout
                  ? 'Shared layout'
                  : page?.title || 'Page'
            "
            :shared="settingsPanel === 'site' || editingLayout"
            :title="editingLayout ? 'Changes apply to every page using this layout.' : undefined"
          />
          <nav
            v-if="section && !codeMode"
            class="selection-path"
            aria-label="Selection path"
            data-selection-inspector
          >
            <button type="button" :disabled="locked" @click="chooseSection('')">
              {{ editingLayout ? 'Shared layout' : page?.title || 'Page' }}
            </button>
            <template v-for="(entry, index) in selectionPath" :key="entry.id">
              <span aria-hidden="true">/</span>
              <button
                type="button"
                :disabled="locked"
                :aria-current="
                  !selectionDetail && index === selectionPath.length - 1 ? 'location' : undefined
                "
                :aria-label="`Select parent ${entry.label}`"
                @click="chooseSection(entry.id)"
              >
                {{ entry.label }}
              </button>
            </template>
            <template v-if="selectionDetail?.item"
              ><span aria-hidden="true">/</span><span>{{ selectionDetail.item }}</span></template
            >
            <template v-if="selectionDetail"
              ><span aria-hidden="true">/</span
              ><strong aria-current="location">{{ selectionDetail.label }}</strong></template
            >
          </nav>
          <section
            v-if="designMode && selectedWidgets.length > 1"
            ref="arrangementPanel"
            class="arrangement-panel"
            aria-label="Arrange widgets"
            tabindex="-1"
          >
            <div class="pane-title">
              <h2>Arrange selection</h2>
              <button aria-label="Clear widget selection" @click="setSelection([])">Clear</button>
            </div>
            <div class="arrangement-actions">
              <button
                v-for="option in arrangementOptions"
                :key="option.id"
                :disabled="
                  !geometryEditable || selectedLayoutLocked || !Object.keys(option.layouts).length
                "
                @click="arrangeWidgets(option.id)"
              >
                {{ option.label }}
              </button>
            </div>
            <small>
              Align within the selection. Spacing needs three widgets and enough room. Match sizes
              to {{ section?.title || 'the primary widget' }}.
            </small>
          </section>
          <p v-if="designMode && selectedWidgets.length > 1" class="subtle">
            {{ selectedWidgets.length }} widgets selected. Drag or use arrow keys to move them
            together. Fields below edit the primary widget.
          </p>
          <template v-if="settingsPanel === 'site'">
            <div class="inspector-header settings-header">
              <h2><i class="pi pi-cog" aria-hidden="true" /> Site settings</h2>
              <p class="selection-name">Shared across your website</p>
            </div>
            <label>Website name<input v-model="site.name" maxlength="100" /></label>
            <WebsitePageCode
              v-if="codeMode"
              shared
              :css="site.css"
              :js="site.js"
              @css="site.css = $event"
              @js="site.js = $event"
            />
            <label v-if="designMode"
              >Accent color<input v-model="site.accent" type="color"
            /></label>
            <WebsiteThemeFields
              v-if="designMode"
              :theme="site.theme"
              :accent="site.accent"
              @apply="
                history.change(() => {
                  site!.theme = $event.theme
                  site!.accent = $event.accent
                })
              "
              @update="
                history.change(() => {
                  if ($event) site!.theme = $event
                  else delete site!.theme
                })
              "
            />
            <WebsiteBrandingFields
              v-if="site.branding"
              :branding="site.branding"
              :hide-footer="page?.chrome === 'widgets'"
              @update="site.branding = $event"
              @uploading="uploading = $event"
            />

            <p v-if="!designMode" class="subtle">
              Switch to Design to change shared colors, typography and spacing.
            </p>
          </template>
          <template v-else-if="codeMode && page">
            <h2>{{ section ? sectionLabels[section.type] + ' code' : 'Page code' }}</h2>
            <label v-if="section"
              >CSS class<input
                v-model="section.styleClass"
                placeholder="custom-feature"
                maxlength="40"
                pattern="custom-[a-z][a-z0-9-]{0,32}"
            /></label>
            <WebsitePageCode
              :page="page"
              :shared="editingLayout"
              :css="editingLayout ? site.css : page.css"
              :js="editingLayout ? site.js : page.js"
              @html="
                (value) => {
                  if (value === undefined) delete page!.html
                  else page!.html = value
                }
              "
              @css="
                (value) => {
                  if (editingLayout) site!.css = value
                  else page!.css = value
                }
              "
              @js="
                (value) => {
                  if (editingLayout) site!.js = value
                  else page!.js = value
                }
              "
            />
          </template>
          <WebsiteImageEditor
            v-else-if="selectedImage && imageTarget"
            data-selection-inspector
            :key="`${imageTarget.sectionId}:${imageTarget.itemId}`"
            :item="selectedImage"
            :ratio="imageRatio"
            :contain="imageContain"
            :disabled="locked"
            @update="updateImage"
            @uploading="uploading = $event"
            @done="endImage"
          />
          <section
            v-else-if="designMode && selectedText && selectedElementItem"
            class="selected-element-editor"
            data-selection-inspector
            aria-label="Selected element editor"
          >
            <h2>{{ elementNames[selectedText.field] || 'Element' }}</h2>
            <p class="element-scope">
              Content is shared across screen sizes. Placement follows the selected device.
            </p>
            <WebsiteElementContent
              :key="`${selectedText.id}:${selectedText.key || ''}:${selectedText.field}`"
              :item="selectedElementDisplay!"
              :field="selectedText.field as ElementField"
              :disabled="locked"
              @update="updateElementContent"
              @uploading="uploading = $event"
              @crop="cropSelectedElement"
              @format="endInline()"
            />
            <WebsiteElementFields
              :value="elementBox"
              :overrides="elementOverrides"
              :device="device"
              :disabled="locked || sectionFixed"
              :label="
                (
                  { title: 'Heading', text: 'Text', image: 'Image', button: 'Button' } as Record<
                    string,
                    string
                  >
                )[selectedText.field] || 'Element'
              "
              :image="selectedText.field === 'image'"
              :width="selectedElement?.element.offsetWidth"
              :height="selectedElement?.element.offsetHeight"
              @change="changeElement($event)"
              @reset="changeElement({}, $event)"
            />
          </section>
          <template v-else-if="section">
            <div class="inspector-header">
              <div class="pane-title">
                <div>
                  <h2>{{ sectionLabels[section.type] }}</h2>
                  <p v-if="section.title" class="selection-name">{{ section.title }}</p>
                </div>
                <button
                  @click="chooseSection('')"
                  aria-label="Close widget editor"
                  title="Return to page settings"
                >
                  ×
                </button>
              </div>
              <p v-if="editingLayout" class="edit-scope">
                Shared layout · Changes appear on every page using this layout.
              </p>
              <p v-else-if="editorMode === 'content'" class="edit-scope">
                Editing content on {{ page?.title }}. Save the draft when ready.
              </p>
              <WebsiteInspectorTabs
                v-if="designMode && section.type !== 'page-content'"
                :model-value="inspectorTab"
                @update:model-value="chooseInspectorTab"
              />
              <p v-if="designMode && section.type !== 'page-content'" class="setting-scope">
                <strong>{{
                  inspectorTab === 'content'
                    ? 'All screen sizes'
                    : device === 'desktop'
                      ? 'Desktop · Base styles'
                      : device === 'mobile'
                        ? 'Phone · Overrides'
                        : 'Tablet · Overrides'
                }}</strong>
                <span>{{
                  inspectorTab === 'content'
                    ? 'Text and images are shared across desktop, tablet and phone.'
                    : device === 'desktop'
                      ? 'Tablet and phone follow these styles unless overridden.'
                      : 'Desktop values stay linked. Override values apply here only. Reset to follow desktop.'
                }}</span>
              </p>
            </div>
            <div
              id="widget-panel-content"
              v-show="!designMode || inspectorTab === 'content'"
              class="inspector-fields"
              :role="designMode && section.type !== 'page-content' ? 'tabpanel' : undefined"
              :aria-labelledby="
                designMode && section.type !== 'page-content' ? 'widget-tab-content' : undefined
              "
            >
              <div v-if="focusedItem" class="edit-scope">
                <strong>Editing {{ focusedItem.title || 'selected item' }}</strong>
                <button type="button" @click="focusedItemId = undefined">
                  Show all widget content
                </button>
              </div>
              <WebsiteNavigationFields
                v-if="section.type === 'navigation' || section.type === 'footer'"
                :value="section.navigation"
                :footer="section.type === 'footer'"
                :site-name="site.name"
                @update="
                  history.change(() => {
                    section!.navigation = $event
                  })
                "
              />
              <WebsiteBlockFields
                v-if="designMode && !focusedItem"
                :kind="section.type"
                :value="section.blockOptions"
                @update="
                  history.change(() => {
                    section!.blockOptions = $event
                  })
                "
              />
              <WebsiteFormSettings
                v-if="section.type === 'form' && selectedForm"
                :form="selectedForm"
                @update="updateWebsiteForm"
              />
              <WebsiteCustomLibrary
                v-else-if="section.type === 'custom' && editorMode === 'content'"
                inline
                mode="content"
                :site="site"
                :selected="section"
                :disabled="locked"
                :can-capture="false"
                :remaining="0"
                @value="setCustomValue"
                @uploading="uploading = $event"
              />
              <div v-else-if="section.type === 'custom'" class="subtle">
                <p>Use the widget's exposed settings to update this placement.</p>
                <button @click="openBuilderTool(editorMode === 'content' ? 'pages' : 'widgets')">
                  Edit custom widget
                </button>
              </div>
              <p v-else-if="section.type === 'page-content'" class="subtle">
                This space displays each page's content. Choose a page under Pages to edit it.
              </p>
              <p
                v-else-if="section.type === 'container' && editorMode === 'content'"
                class="subtle"
              >
                This group holds other widgets. Select a widget inside it to edit its content.
              </p>
              <label v-else-if="section.type === 'container'"
                >Heading<input v-model="section.title" maxlength="160"
              /></label>
              <WebsiteItemFields
                v-else
                v-show="!focusedItem"
                :key="section.id"
                :item="section"
                :design-tools="designMode"
                :kind="section.type"
                :content-only="
                  ['accordion', 'tabs', 'downloads', ...blockCollections].includes(section.type)
                "
                :image-only="section.type === 'image'"
                :menu-only="section.type === 'navigation' || section.type === 'footer'"
                @update="updateSection"
                @uploading="uploading = $event"
              />
              <template
                v-if="
                  [
                    'cards',
                    'gallery',
                    'accordion',
                    'tabs',
                    'downloads',
                    ...blockCollections,
                  ].includes(section.type)
                "
                ><h3>
                  {{
                    section.type === 'gallery'
                      ? 'Photos'
                      : section.type === 'cards'
                        ? 'Cards'
                        : 'Items'
                  }}
                </h3>
                <div
                  v-for="(item, index) in section.items"
                  :key="item.id"
                  class="item-editor"
                  v-show="!focusedItem || focusedItem.id === item.id"
                >
                  <details :open="focusedItem?.id === item.id ? true : undefined">
                    <summary>{{ item.title || `Item ${index + 1}` }}</summary>
                    <WebsiteItemFields
                      :item="item"
                      :design-tools="designMode"
                      collection-item
                      :kind="section.type"
                      @update="Object.assign(item, $event)"
                      @uploading="uploading = $event"
                    />
                  </details>
                  <div class="item-actions">
                    <button
                      :disabled="index === 0"
                      :aria-label="`Move item ${index + 1} up`"
                      @click="move(section.items, index, -1)"
                    >
                      ↑</button
                    ><button
                      :disabled="index === section.items.length - 1"
                      :aria-label="`Move item ${index + 1} down`"
                      @click="move(section.items, index, 1)"
                    >
                      ↓</button
                    ><button @click="history.change(() => section!.items.splice(index, 1))">
                      Remove item
                    </button>
                  </div>
                </div>
                <button
                  :disabled="section.items.length >= 12"
                  @click="history.change(() => section!.items.push(newItem()))"
                >
                  + Add item
                </button></template
              >
            </div>
            <template v-if="designMode && section.type !== 'page-content'">
              <div
                id="widget-panel-appearance"
                v-show="inspectorTab === 'appearance'"
                role="tabpanel"
                aria-labelledby="widget-tab-appearance"
                class="inspector-fields"
              >
                <WebsiteAppearanceFields
                  :key="section.id"
                  standalone
                  :value="effectiveSection?.appearance"
                  :kind="section.type"
                  :automatic="
                    device !== 'desktop' && (editingLayout || isFlow(page?.layout, device))
                  "
                  :has-image="!!section.imageId || section.items.some((item) => !!item.imageId)"
                  :inherited="device !== 'desktop'"
                  :overrides="
                    device === 'desktop' ? undefined : section.devices?.[device]?.appearance
                  "
                  :layout-locked="sectionFixed"
                  @update="setDesign('appearance', $event)"
                />
              </div>
              <div
                id="widget-panel-layout"
                v-show="inspectorTab === 'layout'"
                role="tabpanel"
                aria-labelledby="widget-tab-layout"
                class="inspector-fields"
              >
                <p class="subtle">
                  Visibility, locking and parent container apply to all screen sizes.
                </p>
                <label class="check"
                  ><input v-model="section.locked" type="checkbox" /> Lock position, size and
                  rotation</label
                >
                <label class="check"
                  ><input v-model="section.hidden" type="checkbox" /> Hide widget</label
                >
                <label
                  >Container
                  <select
                    aria-label="Container"
                    :disabled="sectionFixed"
                    :value="section.parentId || ''"
                    @change="moveIntoContainer"
                  >
                    <option value="">Page grid</option>
                    <option v-for="parent in containerOptions" :key="parent.id" :value="parent.id">
                      {{ parent.title || 'Container' }}
                    </option>
                  </select>
                </label>
                <template v-if="device !== 'desktop'">
                  <label class="check"
                    ><input
                      type="checkbox"
                      :checked="section.devices?.[device]?.hidden"
                      @change="setDesign('hidden', ($event.target as HTMLInputElement).checked)"
                    />
                    Hide on {{ device }}</label
                  >
                  <button :disabled="sectionFixed" @click="resetDevice">
                    Reset {{ device }} overrides
                  </button>
                </template>
                <WebsiteLayoutFields
                  v-if="section.type === 'container' || section.parentId || !geometryEditable"
                  :container="effectiveSection?.container"
                  :sizing="effectiveSection?.sizing"
                  :inherited="device !== 'desktop'"
                  :automatic="
                    device !== 'desktop' && (editingLayout || isFlow(page?.layout, device))
                  "
                  :sizing-overrides="
                    device === 'desktop' ? undefined : section.devices?.[device]?.sizing
                  "
                  :is-container="section.type === 'container'"
                  :contained="!!section.parentId"
                  :disabled="sectionFixed"
                  @container="setDesign('container', $event)"
                  @sizing="setDesign('sizing', $event)"
                />
                <button v-if="section.type === 'container'" @click="unwrapContainer">
                  Ungroup container
                </button>
                <p v-if="section.parentId" class="subtle">
                  Position and size follow the container's row or column. Outline arrows change the
                  child order.
                </p>
                <template v-if="geometryEditable && section.layout && !section.parentId">
                  <h3>Size</h3>
                  <div class="geometry-fields">
                    <label v-for="field in ['w', 'h'] as const" :key="field"
                      >{{ { w: 'Width', h: 'Height' }[field] }}
                      <input
                        type="number"
                        step="any"
                        :value="geometryValue(field)"
                        :aria-label="`Widget ${field}`"
                        :disabled="sectionFixed"
                        @input="holdGeometry(field, $event)"
                        @change="setGeometry(field, $event)"
                        @blur="geometryInput = undefined"
                      />
                    </label>
                  </div>
                  <details class="precision-settings">
                    <summary>Position and layer</summary>
                    <div class="geometry-fields">
                      <label v-for="field in ['x', 'y', 'z'] as const" :key="field">
                        {{
                          { x: 'Horizontal position', y: 'Vertical position', z: 'Layer' }[field]
                        }}
                        <input
                          type="number"
                          :step="field === 'z' ? 1 : 'any'"
                          :value="geometryValue(field)"
                          :aria-label="`Widget ${field}`"
                          :disabled="sectionFixed"
                          @input="holdGeometry(field, $event)"
                        @change="setGeometry(field, $event)"
                        @blur="geometryInput = undefined"
                        />
                      </label>
                    </div>
                    <small
                      >Drag widgets to move them, or use these fields for precise placement. Higher
                      layers appear in front. Grid units are 45 px wide and 32 px tall.</small
                    >
                  </details>
                </template>
              </div>
            </template>
            <div v-if="designMode && section.type !== 'page-content'" class="widget-actions">
              <button
                v-if="designMode"
                :disabled="!page || page.sections.length >= 30"
                @click="duplicateSection"
              >
                Duplicate widget
              </button>

              <button class="danger remove-section" @click="removeSection">Remove widget</button>
            </div>
          </template>
          <template v-else-if="page">
            <div class="inspector-header settings-header">
              <h2><i class="pi pi-file" aria-hidden="true" /> Page settings</h2>
              <p class="selection-name">{{ page.title }}</p>
            </div>
            <p v-if="page.chrome !== 'widgets'" class="notice">
              This legacy page needs room for its navigation and footer widgets. Keep at most 28
              other widgets, leave eight grid rows free at the bottom, then save and reload to
              convert it.
            </p>
            <template v-if="designMode">
              <fieldset>
                <legend>Responsive page layout</legend>
                <label v-for="target in ['desktop', 'tablet', 'mobile'] as const" :key="target"
                  >{{ target === 'mobile' ? 'Phone' : target === 'tablet' ? 'Tablet' : 'Desktop' }}
                  layout
                  <select
                    :aria-label="target + ' layout'"
                    :value="page.layout?.[target] || (target === 'desktop' ? 'grid' : 'flow')"
                    @change="
                      history.change(() => {
                        page!.layout = {
                          ...page!.layout,
                          [target]: ($event.target as HTMLSelectElement).value,
                        }
                      })
                    "
                  >
                    <option :value="target === 'desktop' ? 'grid' : 'scale'">
                      {{ target === 'desktop' ? 'Free grid' : 'Scale desktop grid' }}
                    </option>
                    <option value="flow">
                      {{
                        target === 'desktop' ? 'Flow with content' : 'Responsive flow (automatic)'
                      }}
                    </option>
                  </select>
                </label>
                <small
                  >Responsive flow wraps tablet columns and stacks phone content, adapting spacing
                  and height automatically. Device overrides take priority. Scale desktop grid keeps
                  the exact desktop arrangement.</small
                >
                <div class="builder-field-grid">
                  <label v-for="field in ['gap', 'padding'] as const" :key="field"
                    >Flow {{ field }} (px)<input
                      type="number"
                      min="0"
                      max="160"
                      :value="page.layout?.[field] ?? 16"
                      @change="setPageSpacing(field, $event)"
                  /></label>
                </div>
              </fieldset>
              <fieldset class="grid-settings">
                <legend>Canvas grid</legend>
                <template v-if="page.grid">
                  <label class="check"
                    ><input v-model="page.grid.visible" type="checkbox" /> Show grid</label
                  >
                  <label class="check"
                    ><input v-model="page.grid.snap" type="checkbox" /> Snap to grid</label
                  >
                  <div class="builder-field-grid">
                    <label
                      >Horizontal spacing<select
                        v-model.number="page.grid.spacingX"
                        aria-label="Horizontal grid spacing"
                      >
                        <option
                          v-for="spacing in [0.25, 0.5, 1, 2, 4]"
                          :key="spacing"
                          :value="spacing"
                        >
                          {{ spacing }}
                        </option>
                      </select></label
                    >
                    <label
                      >Vertical spacing<select
                        v-model.number="page.grid.spacingY"
                        aria-label="Vertical grid spacing"
                      >
                        <option
                          v-for="spacing in [0.25, 0.5, 1, 2, 4]"
                          :key="spacing"
                          :value="spacing"
                        >
                          {{ spacing }}
                        </option>
                      </select></label
                    >
                  </div>
                </template>
              </fieldset>
            </template>
            <label v-if="!editingLayout && designMode"
              >Site layout<select
                :value="page.useSiteLayout ? 'default' : 'none'"
                aria-label="Page site layout"
                @change="
                  history.change(() => {
                    page!.useSiteLayout = ($event.target as HTMLSelectElement).value === 'default'
                  })
                "
              >
                <option value="none">No layout</option>
                <option value="default" :disabled="!site.sharedLayout">Default layout</option>
              </select></label
            >
            <p v-if="page.useSiteLayout" class="subtle">
              The shared layout surrounds this page. Existing page navigation/footer widgets are
              kept; remove duplicates in Design if needed.
            </p>
            <label>Page title<input v-model="page.title" maxlength="100" /></label
            ><label
              >Page URL<input
                v-model="page.slug"
                maxlength="64"
                :disabled="editingLayout || !designMode || page.id === homePageId" /></label
            ><small>{{ pageUrl(page.slug) }}</small
            ><label
              >Page description<textarea
                v-model="page.description"
                maxlength="300"
                rows="3"
              /></label
            ><label class="check"
              ><input v-model="page.inNavigation" type="checkbox" /> Show in navigation</label
            ><button
              v-if="designMode && !editingLayout"
              :disabled="site.pages.length >= 30"
              @click="duplicatePage"
            >
              Duplicate page
            </button>
            <button
              v-if="designMode"
              :disabled="page.id === homePageId"
              class="danger"
              @click="removePage"
            >
              Remove page
            </button>
            <hr />
            <p class="subtle">
              Select a widget in the preview or outline to edit its content.
            </p></template
          >
        </aside>
      </fieldset>
      <div v-if="message" class="builder-status">
        <p role="status" :title="message">{{ message }}</p>
        <button
          type="button"
          aria-label="Dismiss status message"
          title="Dismiss status message"
          @click="message = ''"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>
      <ExplorerContextMenu
        v-if="menu"
        :x="menu.x"
        :y="menu.y"
        label="Widget actions"
        :actions="menuActions"
        @action="selectionAction"
        @close="closeMenu"
      />
    </div>
  </AppShell>
</template>
<style scoped>
.recovery-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.recovery-notice button,
.recovery-notice select {
  font-size: inherit;
  padding: 0.25rem 0.45rem;
}
.selection-path {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  font-size: 0.75rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border);
}
.selection-path button {
  max-width: 100%;
  padding: 0.2rem 0.3rem;
  font-size: inherit;
  overflow-wrap: anywhere;
  text-align: left;
}
.selection-path strong {
  overflow-wrap: anywhere;
}
.selected-element-editor {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}
.selected-element-editor h2 {
  font-size: 1rem;
  margin: 0;
}
.element-scope {
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0;
}
.setting-scope {
  display: grid;
  gap: 0.2rem;
  margin: 0.4rem 0;
  padding: 0.45rem 0.55rem;
  border-left: 2px solid var(--border);
  background: var(--field);
  font-size: 0.75rem;
}
.setting-scope span {
  color: var(--text-muted);
}
.precision-settings {
  border-block: 1px solid var(--border);
  padding: 0.6rem 0;
}
.precision-settings summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.precision-settings[open] summary {
  margin-bottom: 0.6rem;
}
.editor-modes {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
[data-editor-mode='content'] .outline-row,
[data-editor-mode='code'] .outline-row {
  grid-template-columns: minmax(0, 1fr);
}
.outline-switcher {
  display: flex;
  gap: 0.3rem;
}
.outline-switcher button {
  flex: 1;
  padding: 0.4rem;
  font-size: 0.8rem;
}
.outline-switcher [aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--surface-2);
}
.website-builder {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.builder-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.35rem;
  align-items: center;
  flex: 0 0 auto;
  padding: 0.2rem 0.35rem 0.35rem;
}
.builder-heading {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}
.builder-title {
  min-width: 0;
}
.builder-navigation {
  display: none;
}
.builder-header h1 {
  font-size: 1.05rem;
  line-height: 1.2;
  margin: 0;
}
.subtle {
  color: var(--text-muted);
  font-size: 0.8rem;
}
.builder-header .subtle {
  margin: 0;
  font-size: 0.7rem;
  max-width: 18rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pane-switcher {
  display: none;
}
.builder-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}
.view-website {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
}
.builder-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
  min-width: 0;
}
.builder-status p {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0.2rem 0.4rem;
  font-size: 0.75rem;
  line-height: 1.3;
  max-height: 2.5rem;
  overflow: auto;
}
.builder-status button {
  padding: 0.25rem;
  background: transparent;
  border: 0;
}
@media (max-width: 1180px) {
  .builder-navigation {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    min-height: 40px;
  }
  .builder-actions .desktop-label {
    display: none;
  }
}
@media (max-width: 600px) {
  .builder-header {
    gap: 0.25rem;
    padding: 0 0 0.25rem;
  }
  .builder-header h1 {
    font-size: 0.95rem;
  }
  .builder-header .subtle {
    max-width: 8rem;
  }
  .builder-actions {
    gap: 0.25rem;
    width: 100%;
    justify-content: flex-end;
  }
  .builder-actions button,
  .view-website {
    padding: 0.5rem;
    min-height: 40px;
    min-width: 40px;
  }
  .desktop-label {
    display: none;
  }
  .editor-modes button {
    padding: 0.35rem;
    min-height: 40px;
  }
  .editor-modes {
    gap: 0.15rem;
  }
}
button {
  font: inherit;
  font-size: 0.8rem;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem 0.65rem;
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button.active,
button[aria-pressed='true'] {
  background: var(--bg-accent);
  border-color: var(--accent);
}
.primary {
  background: #174878;
  color: #fff;
}
.danger {
  color: var(--danger);
}
a {
  color: var(--accent);
  font-size: 0.85rem;
}
.notice {
  padding: 0.7rem;
  border-left: 3px solid var(--accent);
  background: var(--bg-soft);
  flex: 0 0 auto;
  max-height: 5rem;
  overflow: auto;
  margin: 0 0 0.5rem;
}
.error {
  border-color: var(--danger);
}
.builder-grid {
  display: grid;
  grid-template-columns: var(--builder-left-width, 248px) 6px minmax(0, 1fr) 6px var(
      --builder-right-width,
      300px
    );
  grid-template-rows: minmax(0, 1fr);
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.outline,
.inspector {
  padding: 0.85rem;
  background: var(--bg-panel);
  overflow: auto;
  min-width: 0;
  min-height: 0;
  overscroll-behavior: contain;
}
.outline {
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}
.builder-tools {
  display: flex;
  flex-shrink: 0;
  padding: 0.35rem;
  border-bottom: 1px solid var(--border);
  gap: 0.2rem;
}
.builder-tools button {
  flex: 1;
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 0.65rem 0.15rem;
  font-size: 0.68rem;
  border-color: transparent;
  background: transparent;
}
.builder-tools button[aria-pressed='true'] {
  border-color: var(--border);
  background: var(--surface-2);
  color: var(--accent);
}
.builder-tools button {
  position: relative;
}
.publishing-count {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  padding: 0 3px;
  border-radius: 8px;
  background: var(--danger);
  color: #fff;
  font-size: 0.65rem;
  line-height: 16px;
}
.outline-content {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0.7rem;
}
.workspace-context {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--border);
}
.workspace-context span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.85rem;
  font-weight: 600;
}
.workspace-context button {
  font-size: 0.65rem;
  padding: 0.3rem;
}
.on-page-heading {
  margin: 1.2rem 0 0.65rem;
}
.add-widget-shortcut {
  width: 100%;
  margin-top: 0.7rem;
}
.icon-tool {
  min-width: 30px;
  min-height: 30px;
}
.canvas-empty {
  max-width: 390px;
  margin: 2rem auto;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text);
  background: var(--bg-panel);
  border: 1px dashed var(--border);
  border-radius: 10px;
}
.canvas-empty > i {
  color: var(--accent);
  font-size: 1.6rem;
}
.canvas-empty h2 {
  margin-top: 1rem;
  font-size: 1.1rem;
}
.canvas-empty p {
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.6;
}
.inspector-header {
  position: sticky;
  top: -0.85rem;
  z-index: 3;
  padding-top: 0.6rem;
  margin-top: -0.6rem;
  background: var(--bg-panel);
}
.selection-name {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.edit-scope {
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
  margin: 0 0 0.6rem;
  padding: 0.5rem;
  border-left: 2px solid var(--accent);
  background: var(--field);
}
.inspector-fields {
  display: grid;
  gap: 0.8rem;
}
.widget-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  border-top: 1px solid var(--border);
  margin-top: auto;
  padding-top: 0.8rem;
}
.widget-actions button {
  flex: 1;
  margin-top: 0;
}
@media (min-width: 901px) {
  .outline {
    grid-column: 1;
    grid-row: 1;
  }
  .left-resize {
    grid-column: 2;
    grid-row: 1;
  }
  .preview-pane {
    grid-column: 3;
    grid-row: 1;
  }
  .right-resize {
    grid-column: 4;
    grid-row: 1;
  }
  .inspector {
    grid-column: 5;
    grid-row: 1;
  }
  .builder-grid.left-closed {
    grid-template-columns: 0 0 minmax(0, 1fr) 6px var(--builder-right-width, 300px);
  }
  .builder-grid.right-closed {
    grid-template-columns: var(--builder-left-width, 248px) 6px minmax(0, 1fr) 0 0;
  }
  .builder-grid.left-closed.right-closed {
    grid-template-columns: 0 0 minmax(0, 1fr) 0 0;
  }
  .builder-grid.left-closed > .outline,
  .builder-grid.right-closed > .inspector {
    visibility: hidden;
    padding: 0;
    border: 0;
  }
}
.inspector {
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.inspector > * {
  flex-shrink: 0;
}
h2 {
  font-size: 0.9rem;
  margin: 0.25rem 0;
}
h3 {
  font-size: 0.9rem;
}
.pane-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin: 0.3rem 0 0.75rem;
}
.pane-title button {
  font-size: 0.7rem;
  padding: 0.3rem;
}
.outline-row {
  display: flex;
  gap: 0.15rem;
  margin-bottom: 0.3rem;
}
.outline-row:not(.widget-outline-row) > button:first-child {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}
.outline-row:not(.widget-outline-row) > button:not(:first-child) {
  padding: 0.2rem;
  border: none;
  background: transparent;
}
.outline-row small {
  display: block;
  color: var(--text-muted);
  font-size: 0.65rem;
  margin-top: 0.2rem;
}
label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.8rem;
}
input,
textarea,
select {
  font: inherit;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: var(--field);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.5rem;
  border-radius: 4px;
}
.check {
  display: flex;
  align-items: center;
}
.check input {
  width: auto;
}
.tool-panel > label {
  margin-top: 1rem;
}
.tool-panel > button {
  margin-top: 0.4rem;
  width: 100%;
}
.history-actions {
  margin-top: 0;
  display: grid;
  gap: 0.5rem;
}
.history-actions p {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.publishing-checks ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}
.publishing-checks button {
  width: 100%;
  text-align: left;
  line-height: 1.4;
}
.publishing-checks .check-error {
  border-left: 3px solid var(--danger);
}
.inspector:focus {
  outline: none;
}
.preview-pane {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #344355;
}
.preview-toolbar {
  flex-wrap: wrap;
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem;
  background: var(--bg-panel);
  font-size: 0.8rem;
  border-bottom: 1px solid var(--border);
}
.canvas-tool-group {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}
.canvas-tool-group + .canvas-tool-group {
  border-left: 1px solid var(--border);
  padding-left: 0.25rem;
}
.canvas-tool-group button,
.selection-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  min-height: 32px;
  padding: 0.25rem;
}
.canvas-tool-group button:not([aria-pressed='true']),
.selection-toolbar button {
  background: transparent;
  border-color: transparent;
}
.canvas-tool-group button:hover:not(:disabled),
.selection-toolbar button:hover:not(:disabled) {
  background: var(--field-hover);
  border-color: var(--border);
}
.canvas-tool-group .zoom-value {
  min-width: 44px;
  font-variant-numeric: tabular-nums;
}
.preview-dimensions {
  padding-inline: 5px;
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.preview-toolbar button:focus-visible,
.selection-toolbar button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.code-preview-action {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}
.selection-toolbar {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.15rem 0.4rem;
  flex: 0 0 auto;
  background: var(--bg-panel);
  font-size: 0.7rem;
  border-bottom: 1px solid var(--border);
}
.selection-toolbar span {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-muted);
}
.selection-toolbar button {
  flex: 0 0 auto;
  font-size: 0.7rem;
}
.preview-toolbar button {
  padding: 0.35rem;
}
.preview-scroll {
  overflow-y: scroll;
  overflow-x: auto;
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 0.75rem;
}
.preview-scale {
  position: relative;
  flex-shrink: 0;
  margin: auto;
  box-shadow: 0 6px 25px #0004;
}
.preview-clip {
  position: absolute;
  inset: calc(-1 * var(--preview-handle-space));
  padding: var(--preview-handle-space);
  overflow: clip;
}
.preview-frame {
  transform-origin: top left;
}
.preview-viewport {
  position: relative;
  top: calc(-1 * var(--device-handle-space));
  left: calc(-1 * var(--device-handle-space));
  box-sizing: border-box;
  width: calc(100% + 2 * var(--device-handle-space));
  height: calc(100% + 2 * var(--device-handle-space));
  padding: var(--device-handle-space);
  overflow: auto;
  overscroll-behavior: contain;
  /* Keep the authored device width on systems with non-overlay scrollbars. */
  scrollbar-width: none;
}
.preview-viewport::-webkit-scrollbar {
  display: none;
}
.geometry-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.arrangement-panel {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.arrangement-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem;
  margin-bottom: 0.5rem;
}
.arrangement-actions button {
  padding: 0.4rem;
  font-size: 0.75rem;
}
.pan-tool {
  cursor: grab;
}
.remove-section {
  margin-top: 1rem;
}
.template-tools {
  margin: 0.8rem 0;
  font-size: 0.8rem;
}
.widget-outline {
  min-height: 45px;
}
.widget-outline-row {
  display: grid;
  position: relative;
  grid-template-columns: 22px minmax(0, 1fr) 22px 22px;
}
.widget-outline-row > button:nth-child(2) {
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
  padding: 0.45rem;
}
.widget-outline-row > button:not(:nth-child(2)) {
  padding: 0;
  border: 0;
  background: transparent;
}
.widget-outline-row .widget-grip {
  padding: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.widget-outline-row.drop-before {
  box-shadow: 0 -3px #168bd4;
}
.widget-outline-row.drop-after {
  box-shadow: 0 3px #168bd4;
}
.widget-outline.is-dragging {
  outline: 1px dashed var(--accent);
}
.widget-library {
  margin: 1rem 0;
  font-size: 0.8rem;
}
.widget-library-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.35rem;
}
.widget-library-filters {
  position: sticky;
  top: -0.7rem;
  z-index: 2;
  display: grid;
  gap: 0.5rem;
  padding: 0.7rem 0 0.35rem;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
}
.widget-result-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  min-height: 28px;
}
.widget-result-count button {
  padding: 0.25rem;
  font-size: 0.7rem;
}
.widget-library-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-align: left;
  padding: 0.65rem;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.widget-library-item > i {
  color: var(--accent);
  font-size: 1.2rem;
  flex: 0 0 1.3rem;
  text-align: center;
}
.widget-library-item > span {
  min-width: 0;
  font-weight: 600;
}
.widget-library-item small {
  display: block;
  font-size: 0.7rem;
  line-height: 1.35;
  font-weight: 400;
  margin-top: 0.2rem;
}
.widget-library-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.widget-drag-ghost {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  background: #174878;
  color: #fff;
  border: 1px solid #9ccfff;
  padding: 0.5rem 0.7rem;
  border-radius: 5px;
  font-size: 0.8rem;
  max-width: 240px;
}
.template-tools button {
  margin-top: 0.5rem;
  width: 100%;
}
small {
  overflow-wrap: anywhere;
  color: var(--text-muted);
}
.item-editor {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
}
.item-actions {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.5rem;
}
summary {
  cursor: pointer;
  margin-bottom: 0.7rem;
}
hr {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--border);
}
@media (max-width: 900px) {
  .canvas-tool-group.panel-tools {
    display: none;
  }
  .canvas-tool-group.zoom-tools {
    border-left: 0;
    padding-left: 0;
  }
  .canvas-tool-group button,
  .selection-toolbar button {
    min-width: 36px;
    min-height: 40px;
  }
  .desktop-tool {
    display: none;
  }
  .pane-switcher {
    display: flex;
    gap: 0.35rem;
    flex: 0 0 auto;
    padding-bottom: 0.25rem;
  }
  .pane-switcher button {
    flex: 1;
    min-height: 40px;
  }
  .builder-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .builder-grid > * {
    grid-area: 1 / 1;
  }
  .builder-grid:not([data-active-pane='outline']) > .outline,
  .builder-grid:not([data-active-pane='preview']) > .preview-pane,
  .builder-grid:not([data-active-pane='inspector']) > .inspector {
    display: none;
  }
  .outline,
  .inspector {
    border: 0;
  }
  .preview-scroll {
    padding: 0.4rem;
  }
  .preview-toolbar {
    flex-wrap: wrap;
  }
}
</style>

<style src="../styles/website-builder.css"></style>
