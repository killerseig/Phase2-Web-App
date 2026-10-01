<script setup lang="ts">
import type { ImageSettings } from '../../../functions/src/websiteContent'
defineProps<{ settings?: ImageSettings }>()
</script>
<template>
  <div
    v-if="settings?.overlayOpacity"
    class="media-overlay"
    aria-hidden="true"
    :style="{
      background:
        settings.overlayMode === 'linear'
          ? `linear-gradient(${settings.overlayAngle ?? 90}deg, ${settings.overlay || '#000000'}, transparent)`
          : settings.overlay || '#000000',
      opacity: settings.overlayOpacity / 100,
    }"
  />
</template>
<style scoped>
.media-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
