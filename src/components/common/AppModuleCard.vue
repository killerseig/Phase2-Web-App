<script setup lang="ts">
import BaseCard from '@/components/common/BaseCard.vue'
import type { RouteLocationRaw } from 'vue-router'

withDefaults(defineProps<{
  title: string
  description: string
  icon: string
  iconClass?: string
  to: RouteLocationRaw
  actionLabel?: string
}>(), {
  iconClass: '',
  actionLabel: 'Open',
})
</script>

<template>
  <BaseCard card-class="h-100 app-module-card">
    <h5 class="card-title mb-2">
      <i :class="[icon, iconClass, 'me-2']" aria-hidden="true" />{{ title }}
    </h5>
    <p class="text-muted small mb-3">{{ description }}</p>
    <router-link class="btn btn-primary btn-sm" :to="to">
      <i class="bi bi-arrow-right me-1" aria-hidden="true" />{{ actionLabel }}
    </router-link>
  </BaseCard>
</template>
