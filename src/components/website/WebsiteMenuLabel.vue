<script setup lang="ts">
import { computed, inject } from 'vue'
import { inlineEditingKey } from '@/features/website/inlineEditing'
import type { NavigationEntry } from '@/features/website/navigation'
import WebsiteInlineText from './WebsiteInlineText.vue'
import WebsiteRichText from './WebsiteRichText.vue'
const props = defineProps<{
  entry: NavigationEntry
  sectionId: string
  preview?: boolean
  summary?: boolean
  current?: boolean
}>()
const editing = inject(inlineEditingKey, undefined)
const editable = computed(
  () =>
    props.preview && editing?.enabled({ id: props.sectionId, field: 'menu', key: props.entry.key }),
)
</script>
<template>
  <WebsiteInlineText
    v-if="editable"
    class="menu-label"
    :id="sectionId"
    field="menu"
    :target-key="entry.key"
    tag="div"
    :text="entry.label"
    :rich="entry.labelRichText"
    :preview="preview"
  />
  <component
    v-else
    :is="summary ? 'span' : 'a'"
    class="menu-label"
    :href="summary ? undefined : entry.url"
    :aria-current="current ? 'page' : undefined"
    @click="!summary && preview && $event.preventDefault()"
  >
    <WebsiteRichText
      v-if="entry.labelRichText"
      :value="entry.labelRichText"
      heading
      :fallback="entry.label"
      :preview="preview"
    />
    <template v-else>{{ entry.label }}</template>
  </component>
</template>
<style scoped>
.menu-label {
  display: block;
  min-width: 0;
  margin: 0;
  padding: 0.35em 0.15em;
  color: inherit;
  font: inherit;
  text-decoration: none;
  border-radius: 4px;
}
a:hover,
[aria-current] {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
a:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
</style>
