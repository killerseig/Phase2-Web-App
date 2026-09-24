<script setup lang="ts">
import { websiteRuntimeKey } from '@/features/website/runtimeServices'
import { inject, ref, watch } from 'vue'
import { websiteCommand } from '@/services/website'
import type { ImageSettings } from '../../../functions/src/websiteContent'
const props = defineProps<{
  id: string
  alt: string
  preview?: boolean
  thumbnail?: boolean
  contain?: boolean
  priority?: boolean
  settings?: ImageSettings
}>()
const runtime = inject(websiteRuntimeKey, undefined)
const source = ref('')
const failed = ref(false)
watch(
  () => [props.id, props.preview, props.thumbnail],
  async (_, __, cleanup) => {
    let active = true
    cleanup(() => {
      active = false
    })
    failed.value = false
    source.value = ''
    if (!props.id) return
    if (runtime) {
      source.value = runtime.images[props.id] || ''
      failed.value = !source.value
      return
    }
    if (!props.preview) {
      source.value = `/website-image?id=${encodeURIComponent(props.id)}`
      return
    }
    try {
      const image = await websiteCommand<{ base64: string }>('getImage', {
        id: props.id,
        thumbnail: props.thumbnail === true,
      })
      if (active) source.value = `data:image/webp;base64,${image.base64}`
    } catch {
      if (active) failed.value = true
    }
  },
  { immediate: true },
)
</script>
<template>
  <img
    v-if="source && !failed"
    :src="source"
    :alt="alt"
    :class="{ contain }"
    :style="
      settings
        ? {
            objectPosition: `${settings.focusX ?? 50}% ${settings.focusY ?? 50}%`,
            transform: `scale(${settings.zoom ?? 1})`,
            transformOrigin: `${settings.focusX ?? 50}% ${settings.focusY ?? 50}%`,
          }
        : {}
    "
    :loading="priority && !preview ? 'eager' : 'lazy'"
    :fetchpriority="priority && !preview ? 'high' : 'auto'"
    decoding="async"
    @error="failed = true"
  />
  <div v-else class="image-placeholder" role="img" :aria-label="alt || 'Image'">
    {{ failed ? 'Image unavailable' : 'Loading image…' }}
  </div>
</template>
<style scoped>
img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-placeholder {
  min-height: 160px;
  display: grid;
  place-items: center;
  background: #e2e8ef;
  color: #32445a;
  padding: 1rem;
}
img.contain {
  object-fit: contain;
}
</style>
