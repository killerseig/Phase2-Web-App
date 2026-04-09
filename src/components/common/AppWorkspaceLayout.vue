<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots } from 'vue'

defineOptions({
  name: 'AppWorkspaceLayout',
})

const props = withDefaults(defineProps<{
  compactBreakpoint?: number
  openControlsLabel?: string
  closeControlsLabel?: string
  railTitle?: string
}>(), {
  compactBreakpoint: 1200,
  openControlsLabel: 'Open Controls',
  closeControlsLabel: 'Close Controls',
  railTitle: 'Controls',
})

const slots = useSlots()
const compactLayout = ref(false)
const mobileRailOpen = ref(false)
let mediaQueryList: MediaQueryList | null = null

const hasSummary = computed(() => Boolean(slots.summary))

function syncCompactLayout(nextValue: boolean) {
  compactLayout.value = nextValue
  if (!nextValue) {
    mobileRailOpen.value = false
  }
}

function updateFromMediaQuery(event?: MediaQueryListEvent) {
  const nextMatches = event?.matches ?? mediaQueryList?.matches ?? false
  syncCompactLayout(nextMatches)
}

function toggleMobileRail() {
  mobileRailOpen.value = !mobileRailOpen.value
}

function closeMobileRail() {
  mobileRailOpen.value = false
}

onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  mediaQueryList = window.matchMedia(`(max-width: ${props.compactBreakpoint}px)`)
  updateFromMediaQuery()

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', updateFromMediaQuery)
    return
  }

  mediaQueryList.addListener(updateFromMediaQuery)
})

onBeforeUnmount(() => {
  if (!mediaQueryList) return

  if (typeof mediaQueryList.removeEventListener === 'function') {
    mediaQueryList.removeEventListener('change', updateFromMediaQuery)
    return
  }

  mediaQueryList.removeListener(updateFromMediaQuery)
})
</script>

<template>
  <div class="app-workspace-layout">
    <section class="app-workspace-layout__main">
      <slot />
    </section>

    <aside v-if="!compactLayout" class="app-workspace-layout__rail">
      <slot name="sidebar" />

      <slot v-if="hasSummary" name="summary" />
    </aside>

    <div v-else class="app-workspace-layout__mobile-controls">
      <button
        type="button"
        class="btn btn-sm btn-primary app-workspace-layout__mobile-toggle"
        @click="toggleMobileRail"
      >
        <i class="bi" :class="mobileRailOpen ? 'bi-x-lg' : 'bi-sliders2-vertical'"></i>
        {{ mobileRailOpen ? closeControlsLabel : openControlsLabel }}
      </button>

      <transition name="app-workspace-layout-mobile">
        <div
          v-if="mobileRailOpen"
          class="app-workspace-layout__mobile-backdrop"
          @click="closeMobileRail"
        ></div>
      </transition>

      <transition name="app-workspace-layout-mobile">
        <aside v-if="mobileRailOpen" class="app-workspace-layout__mobile-rail">
          <div class="app-workspace-layout__mobile-rail-header">
            <div class="fw-semibold">{{ railTitle }}</div>
            <button type="button" class="btn btn-sm btn-outline-light" @click="closeMobileRail">
              {{ closeControlsLabel }}
            </button>
          </div>

          <div class="app-workspace-layout__mobile-rail-body">
            <slot name="sidebar" />
            <slot v-if="hasSummary" name="summary" />
          </div>
        </aside>
      </transition>
    </div>
  </div>
</template>
