<script setup lang="ts">
import { computed, inject, onBeforeUnmount } from 'vue'
import { inlineEditingKey, navigationPreviewKey } from '@/features/website/inlineEditing'
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
const emit = defineEmits<{ navigate: [] }>()
const editing = inject(inlineEditingKey, undefined)
const navigation = inject(navigationPreviewKey, undefined)
const target = computed(() => ({
  id: props.sectionId,
  field: 'menu' as const,
  key: props.entry.key,
}))
const destination = computed(() => {
  if (!props.preview || !navigation) return undefined
  const id = navigation.pageId(props.entry.url)
  if (id) return () => navigation.navigate(id)
  if (props.entry.url === '/login') return navigation.openAppLogin
  return undefined
})
const active = computed(
  () =>
    editing?.active.value?.id === props.sectionId &&
    editing.active.value.field === 'menu' &&
    editing.active.value.key === props.entry.key,
)
let followTimer: ReturnType<typeof setTimeout> | undefined
function cancelFollow() {
  clearTimeout(followTimer)
  followTimer = undefined
}
function follow(event: MouseEvent) {
  if (!props.preview) {
    if (!props.summary) emit('navigate')
    return
  }
  event.preventDefault()
  if (!destination.value) return
  event.stopPropagation()
  cancelFollow()
  const destinationVisit = destination.value
  const visit = () => {
    destinationVisit()
    emit('navigate')
  }
  // Give a double-click time to request label editing without changing pages first.
  if (event.detail === 0) visit()
  else followTimer = setTimeout(visit, 250)
}
function edit(event: Event) {
  if (!destination.value) return
  event.preventDefault()
  event.stopPropagation()
  cancelFollow()
  navigation?.edit(target.value)
}
onBeforeUnmount(cancelFollow)
const editable = computed(
  () =>
    props.preview && editing?.enabled({ id: props.sectionId, field: 'menu', key: props.entry.key }),
)
</script>
<template>
  <WebsiteInlineText
    v-if="editable && (!destination || active)"
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
    :is="summary && !destination ? 'span' : 'a'"
    class="menu-label"
    :href="summary && !destination ? undefined : entry.url"
    :aria-current="current ? 'page' : undefined"
    :title="
      destination
        ? `${entry.url === '/login' ? 'Click to open app login' : 'Click to visit page'} · Double-click or press F2 to edit label`
        : undefined
    "
    @pointerdown="destination && $event.stopPropagation()"
    @click="follow"
    @dblclick="edit"
    @keydown.f2="edit"
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
