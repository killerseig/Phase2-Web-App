<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import { parseFormSignature, signatureCaption, SIGNATURE_MAX_POINTS } from '../../../functions/src/formSignatures'
const props = defineProps<{ modelValue: string; label: string; id?: string; readonly?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const surface = ref<SVGSVGElement>(), current = ref<number[][]>([]), problem = ref('')
let pointer: number | undefined
const saved = computed(() => { try { return parseFormSignature(props.modelValue) } catch { return undefined } })
const caption = computed(() => { try { return signatureCaption(props.modelValue) } catch { return 'Signature could not be displayed. Clear it and sign again.' } })
const paths = computed(() => [...(saved.value?.strokes || []), ...(current.value.length ? [current.value] : [])]
  .map(stroke => stroke.map((point, index) => `${index ? 'L' : 'M'}${point[0]! * 600},${point[1]! * 180}`).join(' ')))
function point(event: PointerEvent) {
  const bounds = surface.value!.getBoundingClientRect()
  return [Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 1000) / 1000,
    Math.round(Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) * 1000) / 1000]
}
function begin(event: PointerEvent) {
  if (props.readonly || props.disabled || pointer !== undefined || event.button !== 0) return
  pointer = event.pointerId; problem.value = ''; current.value = [point(event)]
  surface.value?.setPointerCapture?.(pointer)
}
function move(event: PointerEvent) {
  if (pointer !== event.pointerId || props.readonly || props.disabled) return
  const next = point(event), last = current.value.at(-1)!
  if (Math.hypot(next[0]! - last[0]!, next[1]! - last[1]!) < .003) return
  if ((saved.value?.strokes.reduce((n, stroke) => n + stroke.length, 0) || 0) + current.value.length >= SIGNATURE_MAX_POINTS) {
    problem.value = 'Signature is too long. Clear it and sign again.'; return
  }
  current.value.push(next)
}
function finish(event: PointerEvent) {
  if (pointer !== event.pointerId) return
  move(event)
  surface.value?.releasePointerCapture?.(pointer)
  pointer = undefined
  if (!problem.value && current.value.length >= 2 && !props.disabled && !props.readonly) {
    try {
      const value = JSON.stringify({ strokes: [...(saved.value?.strokes || []), current.value] })
      parseFormSignature(value); emit('update:modelValue', value)
    } catch (error) { problem.value = (error as Error).message }
  }
  current.value = []
}
function cancel() { pointer = undefined; current.value = [] }
function clear() { cancel(); problem.value = ''; emit('update:modelValue', '') }
watch(() => [props.disabled, props.readonly], () => { if (props.disabled || props.readonly) cancel() })
watch(() => props.modelValue, cancel)
</script>
<template>
  <div class="signature-pad">
    <p v-if="!readonly" :id="id + '-instructions'" class="signature-pad__help">Draw with a finger, pen or mouse. Your signing time is recorded when saved.</p>
    <svg ref="surface" :id="id" viewBox="0 0 600 180" role="img" :aria-label="label"
      :aria-describedby="!readonly ? id + '-instructions' : undefined"
      :class="{ 'signature-pad__surface--readonly': readonly }" class="signature-pad__surface"
      @pointerdown="begin" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @lostpointercapture="cancel">
      <path v-for="(path, index) in paths" :key="index" :d="path" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <div class="signature-pad__actions">
      <AppButton v-if="!readonly" type="button" :disabled="disabled || !modelValue" :aria-label="'Clear ' + label" @click="clear">Clear signature</AppButton>
      <span aria-live="polite">{{ caption }}</span>
    </div>
    <p v-if="problem" role="alert">{{ problem }}</p>
  </div>
</template>
<style scoped>
.signature-pad { display: grid; gap: var(--space-2, .5rem); min-width: 0; }
.signature-pad__surface { display: block; width: 100%; max-width: 42rem; aspect-ratio: 10 / 3; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--field); color: var(--text); touch-action: none; user-select: none; }
.signature-pad__surface--readonly { touch-action: auto; }
.signature-pad__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2, .5rem); }
.signature-pad__help, .signature-pad__actions span { color: var(--text-muted); font-size: var(--font-size-sm, .9rem); }
</style>
