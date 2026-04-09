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
      'app-master-detail-workspace--no-browser': !hasBrowser,
      'app-master-detail-workspace--no-controls': !hasControls,
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
