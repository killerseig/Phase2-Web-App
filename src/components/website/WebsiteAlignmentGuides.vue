<script setup lang="ts">
import type { AlignmentGuide } from '@/features/website/alignment'
defineProps<{ guides: AlignmentGuide[] }>()
</script>
<template>
  <Teleport to="body">
    <div
      v-for="(guide, index) in guides"
      :key="index"
      class="alignment-guide"
      aria-hidden="true"
      :style="
        guide.axis === 'x'
          ? {
              left: guide.at + 'px',
              top: guide.from + 'px',
              width: '1px',
              height: guide.to - guide.from + 'px',
            }
          : {
              left: guide.from + 'px',
              top: guide.at + 'px',
              height: '1px',
              width: guide.to - guide.from + 'px',
            }
      "
    />
  </Teleport>
</template>
<style scoped>
.alignment-guide {
  position: fixed;
  z-index: 9990;
  background: #da4bdd;
  pointer-events: none;
}
</style>
