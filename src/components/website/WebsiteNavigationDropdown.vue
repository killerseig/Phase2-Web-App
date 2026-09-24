<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { inlineEditingKey } from '@/features/website/inlineEditing'
import type { NavigationEntry } from '@/features/website/navigation'
import WebsiteMenuLabel from './WebsiteMenuLabel.vue'
const props = defineProps<{ entry: NavigationEntry; sectionId: string; preview?: boolean }>()
const editing = inject(inlineEditingKey, undefined)
const editable = computed(
  () =>
    props.preview && editing?.enabled({ id: props.sectionId, field: 'menu', key: props.entry.key }),
)
const open = ref(false)
const root = ref<HTMLElement>()
const toggle = ref<HTMLButtonElement>()
const panelId = useId()
function outside(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (!root.value?.contains(target) && !target.closest('.inline-text-toolbar')) open.value = false
}
function escape(event: KeyboardEvent) {
  if (!open.value) return
  event.stopPropagation()
  open.value = false
  toggle.value?.focus()
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
<template>
  <div ref="root" class="navigation-dropdown" @pointerdown.stop @keydown.esc="escape">
    <div class="dropdown-heading">
      <WebsiteMenuLabel
        v-if="editable"
        :entry="entry"
        :section-id="sectionId"
        :preview="preview"
        summary
      />
      <button
        ref="toggle"
        type="button"
        class="dropdown-toggle"
        :aria-expanded="open"
        :aria-controls="panelId"
        :aria-label="`${open ? 'Close' : 'Open'} ${entry.label || 'Menu'} submenu`"
        @click.stop="open = !open"
      >
        <WebsiteMenuLabel v-if="!editable" :entry="entry" :section-id="sectionId" summary />
        <span class="chevron" aria-hidden="true" />
      </button>
    </div>
    <div v-show="open" :id="panelId" class="dropdown-links">
      <a v-if="entry.url && !preview" :href="entry.url">{{ entry.label }}</a>
      <WebsiteMenuLabel
        v-for="child in entry.children"
        :key="child.key"
        :entry="child"
        :section-id="sectionId"
        :preview="preview"
      />
    </div>
  </div>
</template>
<style scoped>
.navigation-dropdown {
  position: relative;
}
.dropdown-heading,
.dropdown-toggle {
  display: flex;
  align-items: center;
}
.dropdown-toggle {
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  padding: 0.4em;
  gap: 0.5em;
  cursor: pointer;
  min-height: 32px;
  min-width: 32px;
  justify-content: center;
  border-radius: 4px;
}
.dropdown-toggle:hover {
  background: #78899a20;
}
.dropdown-toggle:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.chevron {
  width: 0.4em;
  height: 0.4em;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
}
[aria-expanded='true'] .chevron {
  transform: rotate(225deg);
}
.dropdown-links {
  position: absolute;
  right: 0;
  top: 100%;
  min-width: 160px;
  z-index: 10;
  display: grid;
  gap: 0.5rem;
  padding: 0.6rem;
  color: #172c40;
  background: #fff;
  border: 1px solid #172c4026;
  border-radius: 8px;
  box-shadow: 0 8px 24px #172c4026;
}
a {
  color: inherit;
}
</style>
