<script setup lang="ts">
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  label: string
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost'
}>(), {
  loading: false,
  loadingLabel: '',
  disabled: false,
  type: 'submit',
  variant: 'primary',
})
</script>

<template>
  <AppLoadingButton
    v-bind="$attrs"
    class="auth-card__button"
    :label="label"
    :loading="loading"
    :loading-label="loadingLabel"
    :disabled="disabled"
    :type="type"
    :variant="variant"
  />
</template>
