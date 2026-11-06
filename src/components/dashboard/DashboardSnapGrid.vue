<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  spacing?: { x: number; y: number; majorEvery?: number }
  layout: unknown
}>()
const id = useId()
const element = ref<SVGSVGElement>()
const exclusions = ref<{ x: number; y: number; width: number; height: number }[]>([])
const grid = computed(() => ({
  x: Number.isFinite(props.spacing?.x) && props.spacing!.x > 0 ? props.spacing!.x : 1,
  y: Number.isFinite(props.spacing?.y) && props.spacing!.y > 0 ? props.spacing!.y : 1,
  major:
    Number.isInteger(props.spacing?.majorEvery) && props.spacing!.majorEvery! > 0
      ? props.spacing!.majorEvery!
      : 4,
}))
let observer: ResizeObserver | undefined
let observedContainers: HTMLElement[] = []
let frame = 0
function measure() {
  frame = 0
  const host = element.value?.parentElement
  if (!host) return
  const bounds = host.getBoundingClientRect()
  const scale = bounds.width / host.offsetWidth || 1
  // Containers draw their own local grid. Do not put a second, unrelated grid
  // over them, including legacy layouts whose positions come from CSS flow.
  const containers = [...host.querySelectorAll<HTMLElement>(':scope > .is-container')]
  exclusions.value = containers.map((container) => {
    const rect = container.getBoundingClientRect()
    return {
      x: (rect.left - bounds.left) / scale,
      y: (rect.top - bounds.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }
  })
  observedContainers
    .filter((container) => !containers.includes(container))
    .forEach((container) => observer?.unobserve(container))
  containers
    .filter((container) => !observedContainers.includes(container))
    .forEach((container) => observer?.observe(container))
  observedContainers = containers
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(measure)
}
onMounted(() => {
  observer = new ResizeObserver(schedule)
  if (element.value?.parentElement) observer.observe(element.value.parentElement)
  measure()
})
watch(() => props.layout, schedule, { deep: true, flush: 'post' })
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <svg ref="element" class="dashboard-snap-grid" aria-hidden="true" focusable="false">
    <defs>
      <pattern
        :id="`${id}-minor`"
        patternUnits="userSpaceOnUse"
        :width="`${(grid.x / 24) * 100}%`"
        :height="grid.y * 32"
        x="-2"
        y="-2"
      >
        <circle cx="2" cy="2" r="1.25" fill="#68c7ef" fill-opacity="0.55" />
      </pattern>
      <pattern
        :id="`${id}-major`"
        patternUnits="userSpaceOnUse"
        :width="`${((grid.x * grid.major) / 24) * 100}%`"
        :height="grid.y * grid.major * 32"
        x="-2"
        y="-2"
      >
        <circle cx="2" cy="2" r="1.8" fill="#68f0ff" fill-opacity="0.85" />
      </pattern>
      <mask
        :id="`${id}-mask`"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="100%"
        height="100%"
        style="mask-type: luminance"
      >
        <rect width="100%" height="100%" fill="white" />
        <rect v-for="(rect, index) in exclusions" :key="index" v-bind="rect" fill="black" />
      </mask>
    </defs>
    <g :mask="`url(#${id}-mask)`">
      <rect width="100%" height="100%" :fill="`url(#${id}-minor)`" />
      <rect width="100%" height="100%" :fill="`url(#${id}-major)`" />
    </g>
  </svg>
</template>

<style scoped>
.dashboard-snap-grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  pointer-events: none;
  overflow: hidden;
}
</style>
