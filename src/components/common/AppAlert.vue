<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'danger' | 'warning' | 'info' | 'success' | 'secondary'
  title?: string
  message?: string
  icon?: string
  iconClass?: string
  bodyClass?: string
  dismissible?: boolean
  closeLabel?: string
  role?: string
}>(), {
  variant: 'info',
  title: '',
  message: '',
  icon: '',
  iconClass: '',
  bodyClass: '',
  dismissible: false,
  closeLabel: 'Dismiss alert',
  role: 'alert',
})

const emit = defineEmits<{
  close: []
}>()

const slots = useSlots()
const hasBody = computed(() => Boolean(props.message || slots.default))
const hasIcon = computed(() => Boolean(props.icon))
</script>

<template>
  <div
    :class="[
      'alert',
      `alert-${variant}`,
      dismissible ? 'alert-dismissible fade show' : '',
    ]"
    :role="role"
  >
    <div :class="[hasIcon ? 'd-flex align-items-start gap-2' : '', bodyClass]">
      <i v-if="hasIcon" :class="[icon, iconClass]" aria-hidden="true" />
      <div class="app-alert-content">
        <template v-if="title">
          <strong>{{ title }}</strong>
          <span v-if="hasBody" aria-hidden="true">&nbsp;</span>
        </template>
        <slot>
          {{ message }}
        </slot>
      </div>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="btn-close"
      :aria-label="closeLabel"
      @click="emit('close')"
    />
  </div>
</template>
