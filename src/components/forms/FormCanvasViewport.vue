<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ device: 'desktop' | 'tablet' | 'phone' }>()
const frame = ref<HTMLElement>(),
  content = ref<HTMLElement>(),
  fit = ref(true),
  zoom = ref(1),
  height = ref(600)
const width = computed(() =>
  props.device === 'phone' ? 390 : props.device === 'tablet' ? 640 : 768,
)
let observer: ResizeObserver | undefined,
  scheduled = 0
async function measure() {
  await nextTick()
  cancelAnimationFrame(scheduled)
  scheduled = requestAnimationFrame(() => {
    if (fit.value && frame.value)
      zoom.value = Math.min(1, Math.max(0.2, (frame.value.clientWidth - 24) / width.value))
    height.value = content.value?.scrollHeight || 600
  })
}
function manual(value: number) {
  fit.value = false
  zoom.value = Math.max(0.25, Math.min(2, value))
}
function fitting() {
  fit.value = true
  void measure()
}
watch([() => props.device, width], measure, { flush: 'post' })
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (frame.value) observer.observe(frame.value)
  if (content.value) observer.observe(content.value)
  void measure()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(scheduled)
})
</script>
<template>
  <section class="canvas-viewport" aria-label="Form viewport">
    <div class="viewport-toolbar">
      <div role="group" aria-label="Canvas zoom">
        <button aria-label="Zoom out" @click="manual(zoom - 0.1)">−</button
        ><output aria-label="Zoom percentage">{{ Math.round(zoom * 100) }}%</output
        ><button aria-label="Zoom in" @click="manual(zoom + 0.1)">+</button
        ><button :aria-pressed="fit" @click="fitting">
          <i class="pi pi-arrows-alt" aria-hidden="true" />Fit
        </button>
      </div>
      <slot name="devices" />
    </div>
    <div ref="frame" class="viewport-scroll" data-widget-scroll>
      <div
        class="scaled-space"
        :style="{ width: width * zoom + 'px', height: height * zoom + 'px' }"
      >
        <div
          ref="content"
          class="canvas-document"
          :style="{ width: width + 'px', transform: 'scale(' + zoom + ')' }"
        >
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>
<style scoped>
.canvas-viewport {
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 20rem;
  background: #0c1d29;
}
.viewport-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.3rem 0.5rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.viewport-toolbar [role='group'] {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.viewport-toolbar button {
  padding: 0.35rem 0.6rem;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 0.3rem;
}
.viewport-toolbar button[aria-pressed='true'] {
  border-color: var(--brand-sky, #58bae9);
}
.viewport-scroll {
  overflow: auto;
  flex: 1;
  min-height: 0;
  padding: 12px;
}
.scaled-space {
  position: relative;
  margin: 0 auto;
}
.canvas-document {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  box-sizing: border-box;
  background: var(--surface);
  box-shadow: 0 2px 12px #0004;
  min-height: 20rem;
}
</style>
