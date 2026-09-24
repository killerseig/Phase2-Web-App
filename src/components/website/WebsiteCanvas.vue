<script setup lang="ts">
import WebsiteHtmlLayout from './WebsiteHtmlLayout.vue'
import { defaultTheme } from '../../../functions/src/websiteTheme'
import { themeStyle } from '@/features/website/theme'
import { computed, onMounted, onBeforeUnmount, ref, useId } from 'vue'
import WebsiteImage from './WebsiteImage.vue'
import WebsiteWidget from './WebsiteWidget.vue'
import WebsitePageStyles from './WebsitePageStyles.vue'
import { deviceForWidth, isFlow, responsiveSection } from '@/features/website/responsive'
import { visibleSections } from '@/features/website/containers'
import { visualGeometry } from '@/features/website/appearance'
import { pageUrl, type WebsiteSite, type WebsiteDevice } from '@/features/website/types'
import {
  materializeGrid,
  gridExtent,
  geometryStyle,
  defaultGrid,
  type WidgetGeometry,
  type WidgetAction,
  type GridDraft,
} from '@/features/website/grid'
const props = defineProps<{
  site: WebsiteSite
  pageId: string
  layoutEditor?: boolean
  layoutShell?: boolean
  standalone?: boolean
  contentPageId?: string
  preview?: boolean
  designTools?: boolean
  selectedId?: string
  selectedIds?: string[]
  marquee?: WidgetGeometry
  mobile?: boolean
  device?: WebsiteDevice
  gridDraft?: GridDraft
  locked?: boolean
}>()
const emit = defineEmits<{
  select: [id: string, event?: MouseEvent]
  'select-layout': [id: string]
  page: [id: string]
  'drag-widget': [event: PointerEvent, id: string, action: WidgetAction]
  'geometry-key': [event: KeyboardEvent, id: string]
  'marquee-start': [event: PointerEvent]
  'widget-menu': [event: MouseEvent, id: string]
}>()
const page = computed(() =>
  props.layoutEditor || props.layoutShell
    ? props.site.sharedLayout
    : props.site.pages.find((page) => page.id === props.pageId),
)
const composed = computed(
  () =>
    !!props.site.sharedLayout &&
    !!page.value?.useSiteLayout &&
    !props.standalone &&
    !props.layoutEditor &&
    !props.layoutShell,
)
const nestedCanvas = ref<{ getSurface: () => HTMLElement | undefined }>()
const rootIds = computed(() =>
  (page.value?.sections || []).filter((section) => !section.parentId).map((section) => section.id),
)
const slotId = computed(
  () => page.value?.sections.find((section) => section.type === 'page-content')?.id,
)
const root = ref<HTMLElement>()
const viewport = ref<HTMLElement>()
const cssScope = useId().replace(/[^a-zA-Z0-9_-]/g, '-')
const surface = ref<HTMLElement>()
const measuredWidth = ref(1080)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(() => {
    measuredWidth.value = viewport.value?.clientWidth || 1080
  })
  if (viewport.value) observer.observe(viewport.value)
})
onBeforeUnmount(() => observer?.disconnect())
defineExpose({
  getSurface: (): HTMLElement | undefined => nestedCanvas.value?.getSurface() || surface.value,
})
const device = computed(() =>
  props.preview
    ? props.device || (props.mobile ? 'mobile' : 'desktop')
    : deviceForWidth(measuredWidth.value),
)
const flow = computed(
  () => !!props.layoutShell || !!props.layoutEditor || isFlow(page.value?.layout, device.value),
)
const gridMode = computed(
  () => !flow.value && (props.preview || page.value?.sections.some((section) => section.layout)),
)
const sections = computed(() =>
  materializeGrid(page.value?.sections || []).map((section) =>
    responsiveSection(section, device.value),
  ),
)
const visible = computed(() => visibleSections(sections.value))
const settings = computed(() => page.value?.grid || defaultGrid())
function layoutFor(id: string) {
  if (props.gridDraft?.layouts?.[id]) return props.gridDraft.layouts[id]!
  return props.gridDraft?.id === id
    ? props.gridDraft.layout
    : sections.value.find((section) => section.id === id)!.layout!
}
const extent = computed(() =>
  gridExtent(
    [
      ...visible.value
        .filter((section) => !section.parentId)
        .map((section) =>
          visualGeometry(
            layoutFor(section.id),
            props.gridDraft?.id === section.id && props.gridDraft.rotation !== undefined
              ? props.gridDraft.rotation
              : section.appearance?.rotation,
          ),
        ),
      ...(props.gridDraft ? [props.gridDraft.layout] : []),
    ].filter(Boolean),
  ),
)
const scale = computed(() =>
  props.preview && device.value === 'desktop' ? 1 : measuredWidth.value / extent.value.width,
)
const surfaceStyle = computed(() =>
  gridMode.value
    ? {
        width: `${extent.value.width}px`,
        height: `${extent.value.height}px`,
        transform: `scale(${scale.value})`,
        '--grid-x': `${settings.value.spacingX * 45}px`,
        '--grid-y': `${settings.value.spacingY * 32}px`,
        '--major-x': `${settings.value.spacingX * 45 * 4}px`,
        '--major-y': `${settings.value.spacingY * 32 * 4}px`,
      }
    : flow.value
      ? {
          gap: `${page.value?.layout?.gap ?? (props.site.theme ? (props.site.theme.spacing ?? defaultTheme.spacing) : 16)}px`,
          padding: `${page.value?.layout?.padding ?? (props.site.theme ? (props.site.theme.spacing ?? defaultTheme.spacing) : 16)}px`,
        }
      : {},
)
function navigate(event: MouseEvent, id: string) {
  if (props.preview) {
    event.preventDefault()
    emit('page', id)
  }
}
function previewLink(event: MouseEvent) {
  if (props.preview) event.preventDefault()
}
function backgroundPointer(event: PointerEvent) {
  if (
    props.preview &&
    props.designTools !== false &&
    device.value === 'desktop' &&
    !flow.value &&
    !props.locked &&
    !(event.target as HTMLElement).closest('.grid-widget')
  )
    emit('marquee-start', event)
}
function contextMenu(event: MouseEvent, id = '') {
  if (!props.preview || props.designTools === false) return
  event.preventDefault()
  event.stopPropagation()
  emit('widget-menu', event, id)
}
</script>
<template>
  <WebsiteCanvas
    v-if="composed"
    ref="nestedCanvas"
    :site="site"
    :page-id="pageId"
    layout-shell
    :content-page-id="pageId"
    :preview="preview"
    :device="device"
    :design-tools="designTools"
    :selected-id="selectedId"
    :selected-ids="selectedIds"
    :grid-draft="gridDraft"
    :marquee="marquee"
    :locked="locked"
    @select="(id, event) => emit('select', id, event)"
    @select-layout="(id) => emit('select-layout', id)"
    @page="(id) => emit('page', id)"
    @drag-widget="(event, id, action) => emit('drag-widget', event, id, action)"
    @geometry-key="(event, id) => emit('geometry-key', event, id)"
    @marquee-start="(event) => emit('marquee-start', event)"
    @widget-menu="(event, id) => emit('widget-menu', event, id)"
  />
  <div v-else ref="viewport" class="website-viewport">
    <WebsitePageStyles :css="site.css" :scope="cssScope" />
    <WebsitePageStyles :key="pageId" :css="page?.css" :scope="cssScope" />
    <div
      ref="root"
      class="website-canvas"
      :data-page-scope="cssScope"
      :data-device="device"
      :class="{ 'is-mobile': mobile, 'has-shared-design': !!site.theme }"
      :style="{ '--website-accent': site.accent, ...themeStyle(site.theme) }"
    >
      <header v-if="page?.chrome !== 'widgets'" class="website-header page-header">
        <a
          :href="pageUrl('home')"
          class="website-brand page-brand"
          @click="navigate($event, site.pages.find((page) => page.slug === 'home')?.id || '')"
          ><span v-if="site.branding?.logoId" class="brand-logo"
            ><WebsiteImage
              :id="site.branding.logoId"
              :alt="site.branding.logoAlt"
              :preview="preview"
              contain /></span
          >{{ site.name }}</a
        >
        <nav class="page-navigation" aria-label="Website navigation">
          <a
            v-for="entry in site.pages.filter((page) => page.inNavigation)"
            :key="entry.id"
            :href="pageUrl(entry.slug)"
            :aria-current="entry.id === pageId ? 'page' : undefined"
            @click="navigate($event, entry.id)"
            >{{ entry.title }}</a
          >
          <a href="/login" @click="previewLink">Employee Login</a>
        </nav>
      </header>
      <div class="grid-stage" :style="gridMode ? { height: `${extent.height * scale}px` } : {}">
        <div
          v-if="page"
          ref="surface"
          class="website-content page-content"
          :class="{
            'grid-surface': gridMode,
            'show-grid': preview && designTools !== false && settings.visible,
            'flow-surface': flow,
          }"
          :style="surfaceStyle"
          @pointerdown="backgroundPointer"
          @contextmenu="contextMenu($event)"
        >
          <p v-if="!page.sections.some((section) => !section.hidden)" class="canvas-empty">
            Add a section to start building this page.
          </p>
          <WebsiteHtmlLayout :preview="preview" :html="page.html" :ids="rootIds" :slot-id="slotId">
            <template #widget="{ id }">
              <WebsiteCanvas
                v-if="id === slotId && contentPageId"
                ref="nestedCanvas"
                :site="site"
                :page-id="contentPageId"
                standalone
                :preview="preview"
                :device="device"
                :design-tools="designTools"
                :selected-id="selectedId"
                :selected-ids="selectedIds"
                :grid-draft="gridDraft"
                :marquee="marquee"
                :locked="locked"
                @select="(id, event) => emit('select', id, event)"
                @page="(id) => emit('page', id)"
                @drag-widget="(event, id, action) => emit('drag-widget', event, id, action)"
                @geometry-key="(event, id) => emit('geometry-key', event, id)"
                @marquee-start="(event) => emit('marquee-start', event)"
                @widget-menu="(event, id) => emit('widget-menu', event, id)"
              />
              <template v-else>
                <WebsiteWidget
                  v-for="section in visible.filter((entry) => entry.id === id)"
                  :key="section.id"
                  :section="section"
                  :sections="visible"
                  :site="site"
                  :page-id="pageId"
                  :grid-mode="gridMode"
                  :flow="flow"
                  :geometry-editable="device === 'desktop' && !flow"
                  :preview="preview"
                  :selected-id="selectedId"
                  :selected-ids="selectedIds"
                  :grid-draft="layoutShell ? undefined : gridDraft"
                  :locked="locked"
                  :design-tools="designTools !== false && !layoutShell"
                  @select="
                    (id, event) =>
                      layoutShell ? emit('select-layout', id) : emit('select', id, event)
                  "
                  @widget-menu="(event, id) => emit('widget-menu', event, id)"
                  @drag-widget="(event, id, action) => emit('drag-widget', event, id, action)"
                  @geometry-key="(event, id) => emit('geometry-key', event, id)"
                />
              </template>
            </template>
          </WebsiteHtmlLayout>
          <div
            v-if="preview && gridDraft?.type"
            class="grid-drop-preview"
            :style="geometryStyle(gridDraft.layout)"
            aria-hidden="true"
          >
            Drop widget
          </div>
          <div
            v-if="preview && marquee"
            class="grid-marquee"
            :style="geometryStyle(marquee)"
            aria-hidden="true"
          />
        </div>
      </div>
      <footer v-if="page?.chrome !== 'widgets'" class="page-footer">
        <div>
          <strong>{{ site.name }}</strong>
          <p v-if="site.branding?.footerText" class="footer-text">{{ site.branding.footerText }}</p>
        </div>
        <nav v-if="site.branding?.footerLinks.length" aria-label="Footer navigation">
          <a
            v-for="link in site.branding.footerLinks.filter((link) => link.label && link.url)"
            :key="link.id"
            :href="link.url"
            @click="previewLink"
            >{{ link.label }}</a
          >
        </nav>
      </footer>
    </div>
  </div>
</template>
<style scoped>
.website-viewport {
  container-type: inline-size;
  container-name: website-page;
  width: 100%;
  min-width: 0;
}
.website-content.flow-surface {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.website-canvas {
  --website-accent: #174878;
  color: #172c40;
  background: #fff;
  font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
  width: 100%;
  min-width: 0;
  container-type: inline-size;
}
.grid-stage {
  position: relative;
}
.grid-marquee {
  position: absolute;
  border: 1px solid #168bd4;
  background: #168bd422;
  z-index: 10002 !important;
  pointer-events: none;
  box-sizing: border-box;
}
.grid-surface {
  display: block !important;
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}
.grid-surface.show-grid {
  background-image:
    radial-gradient(circle, #526f91 1.5px, transparent 1.5px),
    radial-gradient(circle, #9bb2cc 1px, transparent 1px);
  background-size:
    var(--major-x) var(--major-y),
    var(--grid-x) var(--grid-y);
  background-position:
    calc(var(--major-x) / -2) calc(var(--major-y) / -2),
    calc(var(--grid-x) / -2) calc(var(--grid-y) / -2);
  background-color: #eef2f7;
}
.grid-drop-preview {
  position: absolute;
  pointer-events: none;
  background: #168bd433;
  border: 2px dashed #168bd4;
  box-sizing: border-box;
  z-index: 10001 !important;
}
.website-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.4rem 5%;
  border-bottom: 1px solid #e4e8ec;
}
.website-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 1.8rem;
  font-weight: 800;
  text-decoration: none;
}
.brand-logo {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  overflow: hidden;
}
.footer-text {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
  max-width: 55ch;
}
footer nav a {
  color: #fff;
}
a {
  color: var(--website-accent);
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  font-size: 0.9rem;
}
nav a {
  text-decoration: none;
}
nav a[aria-current] {
  text-decoration: underline;
  text-underline-offset: 6px;
}
.website-section {
  padding: 3rem 6%;
  position: relative;
  border: 2px solid transparent;
  box-sizing: border-box;
  height: 100%;
}
.website-content {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  min-height: 100px;
}
.widget-frame {
  grid-column: span var(--widget-span, 12);
  min-width: 0;
  position: relative;
  container-type: inline-size;
}
.widget-frame.drop-before::before,
.widget-frame.drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: #168bd4;
  z-index: 3;
  pointer-events: none;
}
.widget-frame.drop-before::before {
  top: 0;
}
.widget-frame.drop-after::after {
  bottom: 0;
}
.is-dragging {
  outline: 2px dashed #168bd4;
  outline-offset: -2px;
}
.canvas-empty {
  grid-column: 1 / -1;
}
.website-section.selected {
  border-color: #168bd4;
}
h1,
h2,
h3 {
  color: inherit;
  line-height: 1.13;
  margin: 0 0 1rem;
  overflow-wrap: anywhere;
}
h1 {
  font-size: clamp(2rem, 5cqw, 4rem);
  max-width: 18ch;
}
h2 {
  font-size: clamp(1.5rem, 3cqw, 2.5rem);
}
h3 {
  font-size: 1.2rem;
}
p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.65;
  margin: 0 0 1.25rem;
}
.section-hero {
  background: #eaf0f5;
  min-height: 330px;
  display: flex;
  align-items: center;
  gap: 2rem;
}
.section-hero .section-copy {
  order: -1;
  flex: 1;
}
.section-image {
  min-width: 0;
  flex: 1;
  height: 290px;
  border-radius: 4px;
  overflow: hidden;
}
.section-image + .section-copy {
  flex: 1;
}
.section-image:only-child {
  width: 100%;
}
.section-image {
  margin-bottom: 1rem;
}
.section-image-text {
  display: flex;
  gap: 2rem;
  align-items: center;
}
.section-text .section-copy {
  max-width: 800px;
  margin: auto;
}
.website-cta {
  display: inline-block;
  border: 2px solid var(--website-accent);
  padding: 0.75rem 1.2rem;
  font-weight: 700;
  text-decoration: none;
  background: #fff;
}
.website-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}
.website-cards article {
  border: 1px solid #dce3e9;
}
.card-image {
  height: 190px;
}
.card-copy {
  padding: 1rem;
}
.section-contact {
  background: #eaf0f5;
  text-align: center;
}
footer {
  padding: 2rem 6%;
  background: #172c40;
  color: #fff;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
}
footer span {
  font-size: 0.8rem;
}
.canvas-empty {
  padding: 3rem;
}
@container (max-width: 580px) {
  .widget-frame {
    grid-column: 1 / -1;
  }
  .website-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .section-hero,
  .section-image-text {
    flex-direction: column;
    align-items: stretch;
  }
  .section-image {
    flex: none;
    height: 220px;
  }
  .website-cards {
    grid-template-columns: 1fr;
  }
  .website-section {
    padding: 2rem 5%;
  }
}
</style>

<style scoped>
.has-shared-design {
  background: var(--site-background);
  color: var(--site-text);
  font-family: var(--site-body-font);
  font-size: var(--site-font-size);
  line-height: var(--site-line-height);
}
.has-shared-design .flow-surface {
  max-width: var(--site-content-width);
  width: 100%;
  margin-inline: auto;
  box-sizing: border-box;
}
.has-shared-design :deep(.website-section) {
  background: var(--site-surface);
  color: inherit;
}
.has-shared-design :deep(.widget-title) {
  font-family: var(--widget-font, var(--site-heading-font));
  line-height: 1.15;
}
.has-shared-design :deep(h1.widget-title) {
  font-size: var(--heading-size, clamp(2.25rem, 5cqw, 4.5rem));
}
.has-shared-design :deep(h2.widget-title) {
  font-size: var(--heading-size, clamp(1.35rem, 3cqw, 2rem));
}
.has-shared-design :deep(.subtitle) {
  color: var(--site-muted);
  opacity: 1;
}
.has-shared-design :deep(.widget-button) {
  border-radius: var(--site-radius);
}
.has-shared-design :deep(.website-cta),
.has-shared-design :deep(.solid .block-button) {
  background: var(--website-accent);
  color: var(--site-button-text);
  border-radius: var(--site-radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  box-sizing: border-box;
}
.has-shared-design :deep(a:focus-visible),
.has-shared-design :deep(button:focus-visible),
.has-shared-design :deep(summary:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}
.has-shared-design :deep(input),
.has-shared-design :deep(select),
.has-shared-design :deep(textarea),
.has-shared-design :deep(td),
.has-shared-design :deep(th) {
  border-color: var(--site-border);
}
.has-shared-design :deep(.widget p) {
  line-height: var(--site-line-height);
}
</style>
