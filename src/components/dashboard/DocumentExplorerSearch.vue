<script setup lang="ts">
withDefaults(defineProps<{ modelValue: string; sidebar?: boolean }>(), { sidebar: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <label class="document-explorer-search document-explorer__search" :class="{ 'document-explorer-search--sidebar': sidebar }">
    <span class="sr-only">Search files</span><i class="pi pi-search" aria-hidden="true" />
    <input type="search" :value="modelValue" placeholder="Search files…" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  </label>
</template>
<style scoped>
.document-explorer-search { position: relative; flex: 0 1 230px; min-width: 90px; margin-left: auto; }
.document-explorer-search > i { position: absolute; left: .5rem; top: 50%; transform: translateY(-50%); font-size: .8rem; pointer-events: none; }
input { box-sizing: border-box; width: 100%; padding: .35rem .4rem .35rem 1.8rem; border: 1px solid var(--border); border-radius: 4px; font: inherit; font-size: .85rem; background: transparent; color: inherit; }
input:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
.document-explorer-search--sidebar { display: block; flex: none; width: 100%; min-width: 0; margin: 0; }
.document-explorer-search--sidebar input { min-height: 2.25rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
