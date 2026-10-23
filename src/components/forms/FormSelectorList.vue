<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppListButton from '@/components/common/AppListButton.vue'
defineProps<{
  options: readonly { key: string; label: string; meta: string; disabled: boolean; templateId?: string }[]
  selectedKey: string
  createDisabled: boolean
}>()
const emit = defineEmits<{ create: []; select: [key: string] }>()
</script>
<template>
  <section class="form-selector" aria-label="Form selector">
    <AppButton class="form-selector__create" :disabled="createDisabled" @click="emit('create')"><i class="pi pi-plus" aria-hidden="true" /> New form</AppButton>
    <ul class="form-selector__list" aria-label="Forms and starters">
      <li v-for="option in options" :key="option.key" :data-template-id="option.templateId">
        <AppListButton class="library-target" :active="selectedKey === option.key" :aria-label="option.label" :aria-pressed="selectedKey === option.key" :disabled="option.disabled" @click="emit('select', option.key)">
          <strong>{{ option.label }}</strong><small>{{ option.meta }}</small>
        </AppListButton>
      </li>
    </ul>
  </section>
</template>
<style scoped>
.form-selector { display: flex; flex-direction: column; gap: .4rem; width: 100%; min-width: 0; min-height: 0; height: 100%; box-sizing: border-box; }
.form-selector__create { width: 100%; }
.form-selector__list { display: grid; gap: 0; align-content: start; flex: 1; min-height: 0; max-height: 28rem; overflow: auto; overscroll-behavior: contain; margin: 0; padding: 0 .15rem 0 0; list-style: none; }
.form-selector__list li { min-width: 0; }
.form-selector .library-target { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; --app-list-button-gap: .5rem; --app-list-button-padding: .5rem .45rem; --app-list-button-radius: 0; min-height: 2.5rem; font: inherit; text-align: left; overflow-wrap: anywhere; }
.library-target strong { font-size: .8rem; font-weight: 500; line-height: 1.3; }
.library-target small { color: var(--text-muted); font-size: .65rem; white-space: nowrap; }
@media(max-width:760px) { .form-selector__list { max-height: 10rem; } }
</style>
