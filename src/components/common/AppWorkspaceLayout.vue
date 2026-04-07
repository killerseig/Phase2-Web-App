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

<style scoped lang="scss">
.app-workspace-layout {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-areas: 'main rail';
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 360px);
}

.app-workspace-layout__main,
.app-workspace-layout__rail {
  min-width: 0;
}

.app-workspace-layout__main {
  grid-area: main;
}

.app-workspace-layout__rail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  grid-area: rail;
}

.app-workspace-layout__mobile-controls {
  display: none;
}

.app-workspace-layout__mobile-toggle {
  align-items: center;
  border-radius: 999px;
  bottom: 1rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.35);
  display: inline-flex;
  gap: 0.5rem;
  position: fixed;
  right: 1rem;
  z-index: 1045;
}

.app-workspace-layout__mobile-backdrop {
  background: rgba(9, 11, 31, 0.55);
  inset: 0;
  position: fixed;
  z-index: 1040;
}

.app-workspace-layout__mobile-rail {
  background: #171b46;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem 1rem 0 0;
  bottom: 0;
  box-shadow: 0 -1rem 2rem rgba(0, 0, 0, 0.35);
  color: #fff;
  left: 0;
  max-height: min(72vh, 42rem);
  position: fixed;
  right: 0;
  z-index: 1041;
}

.app-workspace-layout__mobile-rail-header {
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  padding: 0.85rem 1rem;
}

.app-workspace-layout__mobile-rail-body {
  display: grid;
  gap: 1rem;
  max-height: calc(min(72vh, 42rem) - 4rem);
  overflow-y: auto;
  padding: 1rem;
}

.app-workspace-layout-mobile-enter-active,
.app-workspace-layout-mobile-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.app-workspace-layout-mobile-enter-from,
.app-workspace-layout-mobile-leave-to {
  opacity: 0;
}

.app-workspace-layout-mobile-enter-from.app-workspace-layout__mobile-rail,
.app-workspace-layout-mobile-leave-to.app-workspace-layout__mobile-rail {
  transform: translateY(1.25rem);
}

@media (max-width: 1200px) {
  .app-workspace-layout {
    grid-template-columns: 1fr;
  }

  .app-workspace-layout__rail {
    display: none;
  }

  .app-workspace-layout__mobile-controls {
    display: contents;
  }
}

@media (max-width: 992px) {
  .app-workspace-layout {
    gap: 0.75rem;
  }
}
</style>
