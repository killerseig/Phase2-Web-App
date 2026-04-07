<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots } from 'vue'

defineOptions({
  name: 'AppMasterDetailWorkspace',
})

const props = withDefaults(defineProps<{
  browserBreakpoint?: number
  controlsBreakpoint?: number
  browserColumn?: string
  controlsColumn?: string
  browseLabel?: string
  controlsLabel?: string
  closeLabel?: string
  browserTitle?: string
  controlsTitle?: string
}>(), {
  browserBreakpoint: 1080,
  controlsBreakpoint: 1420,
  browserColumn: 'minmax(280px, 320px)',
  controlsColumn: 'minmax(320px, 390px)',
  browseLabel: 'Browse',
  controlsLabel: 'Controls',
  closeLabel: 'Close',
  browserTitle: 'Browse',
  controlsTitle: 'Controls',
})

type DrawerPane = 'browser' | 'controls'

const slots = useSlots()
const browserInDrawer = ref(false)
const controlsInDrawer = ref(false)
const drawerOpen = ref(false)
const activePane = ref<DrawerPane>('controls')

let browserMediaQuery: MediaQueryList | null = null
let controlsMediaQuery: MediaQueryList | null = null

const hasBrowser = computed(() => Boolean(slots.browser))
const hasControls = computed(() => Boolean(slots.controls))
const drawerAvailable = computed(() => browserInDrawer.value || controlsInDrawer.value)

function syncDrawerState() {
  if (!drawerAvailable.value) {
    drawerOpen.value = false
    return
  }

  if (activePane.value === 'browser' && !browserInDrawer.value) {
    activePane.value = controlsInDrawer.value ? 'controls' : 'browser'
  }

  if (activePane.value === 'controls' && !controlsInDrawer.value) {
    activePane.value = browserInDrawer.value ? 'browser' : 'controls'
  }
}

function updateBrowserDrawer(event?: MediaQueryListEvent) {
  browserInDrawer.value = event?.matches ?? browserMediaQuery?.matches ?? false
  syncDrawerState()
}

function updateControlsDrawer(event?: MediaQueryListEvent) {
  controlsInDrawer.value = event?.matches ?? controlsMediaQuery?.matches ?? false
  syncDrawerState()
}

function openPane(pane: DrawerPane) {
  if (pane === 'browser' && !browserInDrawer.value) return
  if (pane === 'controls' && !controlsInDrawer.value) return
  activePane.value = pane
  drawerOpen.value = true
}

function togglePane(pane: DrawerPane) {
  if (!drawerOpen.value || activePane.value !== pane) {
    openPane(pane)
    return
  }

  drawerOpen.value = false
}

function closeDrawer() {
  drawerOpen.value = false
}

const slotBindings = computed(() => ({
  browserInDrawer: browserInDrawer.value,
  controlsInDrawer: controlsInDrawer.value,
  activePane: activePane.value,
  closeDrawer,
  openPane,
}))

const workspaceStyle = computed(() => ({
  '--app-master-detail-browser-column': props.browserColumn,
  '--app-master-detail-controls-column': props.controlsColumn,
}))

onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  browserMediaQuery = window.matchMedia(`(max-width: ${props.browserBreakpoint}px)`)
  controlsMediaQuery = window.matchMedia(`(max-width: ${props.controlsBreakpoint}px)`)

  updateBrowserDrawer()
  updateControlsDrawer()

  if (typeof browserMediaQuery.addEventListener === 'function') {
    browserMediaQuery.addEventListener('change', updateBrowserDrawer)
    controlsMediaQuery.addEventListener('change', updateControlsDrawer)
    return
  }

  browserMediaQuery.addListener(updateBrowserDrawer)
  controlsMediaQuery.addListener(updateControlsDrawer)
})

onBeforeUnmount(() => {
  if (browserMediaQuery) {
    if (typeof browserMediaQuery.removeEventListener === 'function') {
      browserMediaQuery.removeEventListener('change', updateBrowserDrawer)
    } else {
      browserMediaQuery.removeListener(updateBrowserDrawer)
    }
  }

  if (controlsMediaQuery) {
    if (typeof controlsMediaQuery.removeEventListener === 'function') {
      controlsMediaQuery.removeEventListener('change', updateControlsDrawer)
    } else {
      controlsMediaQuery.removeListener(updateControlsDrawer)
    }
  }
})
</script>

<template>
  <div
    class="app-master-detail-workspace"
    :class="{
      'app-master-detail-workspace--controls-drawer': controlsInDrawer,
      'app-master-detail-workspace--browser-drawer': browserInDrawer,
    }"
    :style="workspaceStyle"
  >
    <aside
      v-if="hasBrowser && !browserInDrawer"
      class="app-master-detail-workspace__browser"
    >
      <slot name="browser" v-bind="slotBindings" />
    </aside>

    <section class="app-master-detail-workspace__detail">
      <slot v-bind="slotBindings" />
    </section>

    <aside
      v-if="hasControls && !controlsInDrawer"
      class="app-master-detail-workspace__controls"
    >
      <slot name="controls" v-bind="slotBindings" />
    </aside>

    <div
      v-if="drawerAvailable"
      class="app-master-detail-workspace__drawer-actions"
    >
      <div class="app-master-detail-workspace__drawer-actions-label">
        Quick Panels
      </div>

      <div class="app-master-detail-workspace__drawer-actions-buttons">
        <button
          v-if="browserInDrawer && hasBrowser"
          type="button"
          class="btn btn-sm app-master-detail-workspace__drawer-action app-master-detail-workspace__drawer-action--browser"
          :class="{ 'app-master-detail-workspace__drawer-action--active': drawerOpen && activePane === 'browser' }"
          :aria-label="browseLabel"
          :title="browseLabel"
          @click="togglePane('browser')"
        >
          <i class="bi bi-layout-sidebar-inset"></i>
          <span class="app-master-detail-workspace__drawer-action-label">
            {{ browseLabel }}
          </span>
        </button>

        <button
          v-if="controlsInDrawer && hasControls"
          type="button"
          class="btn btn-sm app-master-detail-workspace__drawer-action app-master-detail-workspace__drawer-action--controls"
          :class="{ 'app-master-detail-workspace__drawer-action--active': drawerOpen && activePane === 'controls' }"
          :aria-label="controlsLabel"
          :title="controlsLabel"
          @click="togglePane('controls')"
        >
          <i class="bi bi-sliders2-vertical"></i>
          <span class="app-master-detail-workspace__drawer-action-label">
            {{ controlsLabel }}
          </span>
        </button>
      </div>
    </div>

    <transition name="app-master-detail-workspace-fade">
      <div
        v-if="drawerOpen"
        class="app-master-detail-workspace__backdrop"
        @click="closeDrawer"
      ></div>
    </transition>

    <transition name="app-master-detail-workspace-drawer">
      <aside v-if="drawerOpen" class="app-master-detail-workspace__drawer">
        <div class="app-master-detail-workspace__drawer-header">
          <div class="app-master-detail-workspace__drawer-title">
            {{ activePane === 'browser' ? browserTitle : controlsTitle }}
          </div>

          <button
            type="button"
            class="btn btn-sm app-master-detail-workspace__drawer-close"
            :aria-label="closeLabel"
            :title="closeLabel"
            @click="closeDrawer"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="app-master-detail-workspace__drawer-body">
          <div
            v-if="browserInDrawer && hasBrowser && activePane === 'browser'"
            class="app-master-detail-workspace__drawer-pane"
          >
            <slot name="browser" v-bind="slotBindings" />
          </div>

          <div
            v-if="controlsInDrawer && hasControls && activePane === 'controls'"
            class="app-master-detail-workspace__drawer-pane"
          >
            <slot name="controls" v-bind="slotBindings" />
          </div>
        </div>
      </aside>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.app-master-detail-workspace {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-areas: 'browser detail controls';
  grid-template-columns:
    var(--app-master-detail-browser-column, minmax(280px, 320px))
    minmax(0, 1fr)
    var(--app-master-detail-controls-column, minmax(320px, 390px));
}

.app-master-detail-workspace--controls-drawer {
  grid-template-areas: 'browser detail';
  grid-template-columns:
    var(--app-master-detail-browser-column, minmax(280px, 320px))
    minmax(0, 1fr);
}

.app-master-detail-workspace--browser-drawer.app-master-detail-workspace--controls-drawer,
.app-master-detail-workspace--browser-drawer:not(.app-master-detail-workspace--controls-drawer) {
  grid-template-areas: 'detail';
  grid-template-columns: minmax(0, 1fr);
}

.app-master-detail-workspace__browser,
.app-master-detail-workspace__controls,
.app-master-detail-workspace__detail {
  min-width: 0;
}

.app-master-detail-workspace__browser {
  grid-area: browser;
}

.app-master-detail-workspace__detail {
  grid-area: detail;
}

.app-master-detail-workspace__controls {
  grid-area: controls;
}

.app-master-detail-workspace__browser,
.app-master-detail-workspace__controls {
  display: grid;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

.app-master-detail-workspace__drawer-actions {
  align-items: center;
  bottom: 1rem;
  display: flex;
  gap: 0.75rem;
  position: fixed;
  right: 1rem;
  z-index: 1045;
}

.app-master-detail-workspace__drawer-actions-label {
  color: rgba(238, 241, 255, 0.82);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.app-master-detail-workspace__drawer-actions-buttons {
  display: flex;
  gap: 0.5rem;
}

.app-master-detail-workspace__drawer-action {
  align-items: center;
  border-radius: 999px;
  box-shadow: 0 0.65rem 1.4rem rgba(0, 0, 0, 0.28);
  color: #f4f6ff;
  display: inline-flex;
  font-weight: 600;
  gap: 0.45rem;
}

.app-master-detail-workspace__drawer-action-label {
  white-space: nowrap;
}

.app-master-detail-workspace__drawer-action--browser {
  background: #3a43a6;
  border: 1px solid #7f8cff;
  color: #f6f7ff;
}

.app-master-detail-workspace__drawer-action--browser:hover,
.app-master-detail-workspace__drawer-action--browser:focus-visible {
  background: #4a54c4;
  border-color: #a7b0ff;
  color: #ffffff;
}

.app-master-detail-workspace__drawer-action--controls {
  background: #6d73ff;
  border: 1px solid rgba(143, 151, 255, 0.8);
  color: #0d1024;
}

.app-master-detail-workspace__drawer-action--controls:hover,
.app-master-detail-workspace__drawer-action--controls:focus-visible {
  background: #8085ff;
  border-color: rgba(186, 191, 255, 0.9);
  color: #090c1c;
}

.app-master-detail-workspace__drawer-action--active {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.app-master-detail-workspace__backdrop {
  background: rgba(7, 10, 24, 0.58);
  inset: 0;
  position: fixed;
  z-index: 1040;
}

.app-master-detail-workspace__drawer {
  background: #171b46;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  bottom: 0;
  box-shadow: -1rem 0 2rem rgba(0, 0, 0, 0.35);
  color: #fff;
  position: fixed;
  right: 0;
  top: 0;
  width: min(92vw, 390px);
  z-index: 1041;
}

.app-master-detail-workspace__drawer-header {
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  padding: 0.95rem 1rem 0.85rem;
}

.app-master-detail-workspace__drawer-title {
  font-size: 1rem;
  font-weight: 700;
}

.app-master-detail-workspace__drawer-close {
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(180, 188, 255, 0.34);
  border-radius: 999px;
  color: #eef1ff;
  display: inline-flex;
  font-weight: 700;
  justify-content: center;
  min-height: 2.35rem;
  min-width: 2.35rem;
  padding: 0;
}

.app-master-detail-workspace__drawer-close:hover,
.app-master-detail-workspace__drawer-close:focus-visible {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(200, 207, 255, 0.52);
  color: #ffffff;
}

.app-master-detail-workspace__drawer-body {
  height: calc(100% - 4.5rem);
  overflow-y: auto;
  padding: 1rem;
}

.app-master-detail-workspace__drawer-pane {
  display: grid;
  gap: 1rem;
}

.app-master-detail-workspace-fade-enter-active,
.app-master-detail-workspace-fade-leave-active,
.app-master-detail-workspace-drawer-enter-active,
.app-master-detail-workspace-drawer-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.app-master-detail-workspace-fade-enter-from,
.app-master-detail-workspace-fade-leave-to,
.app-master-detail-workspace-drawer-enter-from,
.app-master-detail-workspace-drawer-leave-to {
  opacity: 0;
}

.app-master-detail-workspace-drawer-enter-from,
.app-master-detail-workspace-drawer-leave-to {
  transform: translateX(1.25rem);
}

@media (max-width: 767px) {
  .app-master-detail-workspace {
    padding-bottom: 4.75rem;
  }

  .app-master-detail-workspace__drawer-actions {
    background: rgba(16, 20, 54, 0.92);
    border-top: 1px solid rgba(163, 171, 255, 0.22);
    box-shadow: 0 -0.45rem 1.25rem rgba(0, 0, 0, 0.22);
    bottom: 0;
    flex-direction: row;
    gap: 0.45rem;
    justify-content: space-between;
    left: 3.5rem;
    min-height: 3.35rem;
    padding: 0.35rem 0.55rem calc(0.35rem + env(safe-area-inset-bottom));
    right: 0;
    z-index: 1046;
  }

  .app-master-detail-workspace__drawer-actions-label {
    font-size: 0.68rem;
    padding-left: 0.1rem;
  }

  .app-master-detail-workspace__drawer-actions-buttons {
    gap: 0.35rem;
    margin-left: auto;
  }

  .app-master-detail-workspace__drawer-action {
    justify-content: center;
    min-height: 2.45rem;
    min-width: 2.45rem;
    padding-inline: 0.72rem;
  }

  .app-master-detail-workspace__drawer-action i {
    font-size: 1rem;
    margin: 0;
  }

  .app-master-detail-workspace__drawer-action-label {
    display: none;
  }

  .app-master-detail-workspace__drawer {
    max-width: calc(100vw - 4.25rem);
    width: min(94vw, 360px);
  }

  .app-master-detail-workspace__drawer-header {
    padding: 0.8rem 0.9rem 0.75rem;
  }

  .app-master-detail-workspace__drawer-body {
    padding: 0.85rem 0.85rem calc(6rem + env(safe-area-inset-bottom));
    scroll-padding-bottom: calc(6rem + env(safe-area-inset-bottom));
  }
}

@media (max-width: 575px) {
  .app-master-detail-workspace__drawer-actions {
    left: 3.5rem;
  }

  .app-master-detail-workspace__drawer-actions-label {
    font-size: 0.62rem;
  }
}
</style>
