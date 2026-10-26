<script setup lang="ts">
import WebsiteItemFields from './WebsiteItemFields.vue'
import type { SectionType, WebsiteItem } from '@/features/website/types'
defineProps<{ items: WebsiteItem[]; kind: SectionType; designTools: boolean; focusedId?: string }>()
const emit = defineEmits<{
  update: [change: { index: number; value: WebsiteItem }]
  move: [change: { index: number; direction: number }]
  remove: [index: number]
  add: []
  uploading: [busy: boolean]
}>()
</script>
<template>
  <h3>{{ kind === 'gallery' ? 'Photos' : kind === 'cards' ? 'Cards' : 'Items' }}</h3>
  <div v-for="(item, index) in items" :key="item.id" v-show="!focusedId || focusedId === item.id" class="item-editor">
    <details :open="focusedId === item.id ? true : undefined">
      <summary>{{ item.title || `Item ${index + 1}` }}</summary>
      <WebsiteItemFields :item="item" :design-tools="designTools" collection-item :kind="kind" @update="emit('update', { index, value: $event })" @uploading="emit('uploading', $event)" />
    </details>
    <div class="item-actions">
      <button :disabled="index === 0" :aria-label="`Move item ${index + 1} up`" @click="emit('move', { index, direction: -1 })">↑</button>
      <button :disabled="index === items.length - 1" :aria-label="`Move item ${index + 1} down`" @click="emit('move', { index, direction: 1 })">↓</button>
      <button @click="emit('remove', index)">Remove item</button>
    </div>
  </div>
  <button :disabled="items.length >= 12" @click="emit('add')">+ Add item</button>
</template>
<style scoped>
.item-editor { padding: .5rem; border: 1px solid var(--border); border-radius: 4px; }
.item-actions { display: flex; gap: .3rem; margin-top: .5rem; }
summary { cursor: pointer; margin-bottom: .7rem; }
</style>
