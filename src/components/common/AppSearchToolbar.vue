<script setup lang="ts">
import { computed, useSlots } from 'vue'
import BaseSearchField from '@/components/common/BaseSearchField.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'

defineOptions({
  name: 'AppSearchToolbar',
})

interface Props {
  modelValue: string | null | undefined
  placeholder?: string
  clearable?: boolean
  showIcon?: boolean
  inputClass?: string
  groupClass?: string
  searchWrapperClass?: string
  searchColClass?: string
  fieldGridClass?: string
  bodyClass?: string
  headerClass?: string
  eyebrow?: string
  title?: string
  subtitle?: string
  note?: string
  inputAriaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  clearable: false,
  showIcon: false,
  inputClass: 'form-control',
  groupClass: 'input-group',
  searchWrapperClass: 'mb-0',
  searchColClass: 'col-12',
  fieldGridClass: 'row g-3',
  bodyClass: '',
  headerClass: '',
  eyebrow: '',
  title: '',
  subtitle: '',
  note: '',
  inputAriaLabel: '',
})

const slots = useSlots()

const hasHeader = computed(() =>
  Boolean(
    props.eyebrow ||
    props.title ||
    props.subtitle ||
    props.note ||
    slots.header ||
    slots['header-actions'],
  ),
)

const toolbarBodyClass = computed(() => ['app-search-toolbar__body', props.bodyClass].filter(Boolean).join(' '))

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()
</script>

<template>
  <AppToolbarCard :body-class="toolbarBodyClass" :header-class="headerClass">
    <template v-if="hasHeader" #header>
      <slot name="header">
        <div class="app-toolbar-split app-toolbar-split--center w-100">
          <AppToolbarMeta
            v-if="eyebrow || title || subtitle"
            :eyebrow="eyebrow"
            :title="title"
            :subtitle="subtitle"
            title-tag="h5"
            title-class="mb-0"
          />

          <div v-if="note || slots['header-actions']" class="app-toolbar-actions app-toolbar-actions--end">
            <slot name="header-actions">
              <div class="app-toolbar-note">{{ note }}</div>
            </slot>
          </div>
        </div>
      </slot>
    </template>

    <div :class="fieldGridClass">
      <div :class="searchColClass">
        <BaseSearchField
          :model-value="modelValue"
          :placeholder="placeholder"
          :clearable="clearable"
          :show-icon="showIcon"
          :input-class="inputClass"
          :group-class="groupClass"
          :wrapper-class="searchWrapperClass"
          :input-aria-label="inputAriaLabel"
          @update:model-value="emit('update:modelValue', $event)"
          @clear="emit('clear')"
        />
      </div>

      <slot />
    </div>
  </AppToolbarCard>
</template>
