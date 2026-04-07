<script setup lang="ts">
import AppSectionCard from '@/components/common/AppSectionCard.vue'

interface Props {
  title: string
  icon?: string
  loading?: boolean
  error?: string
  subtitle?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  error: '',
  subtitle: '',
  icon: 'info-circle',
})
</script>

<template>
  <AppSectionCard
    :title="title"
    :subtitle="subtitle"
    :icon="icon ? `bi bi-${icon}` : ''"
    :loading="loading"
    :error="error"
  >
    <slot />
  </AppSectionCard>
</template>
