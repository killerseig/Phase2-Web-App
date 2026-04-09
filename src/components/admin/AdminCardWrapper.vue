<script setup lang="ts">
import { useSlots } from 'vue'
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

const slots = useSlots()
</script>

<template>
  <AppSectionCard
    :title="title"
    :subtitle="subtitle"
    :icon="icon ? `bi bi-${icon}` : ''"
    :loading="loading"
    :error="error"
  >
    <template v-if="slots.header || slots['header-actions']" #header>
      <slot name="header">
        <div class="admin-card-wrapper__header">
          <div class="admin-card-wrapper__copy">
            <div class="app-section-card__title mb-0">
              <i v-if="icon" :class="`bi bi-${icon}`" class="me-2" aria-hidden="true" />
              {{ title }}
            </div>
            <div v-if="subtitle" class="app-section-card__subtitle mt-1">{{ subtitle }}</div>
          </div>

          <div v-if="slots['header-actions']" class="admin-card-wrapper__actions">
            <slot name="header-actions" />
          </div>
        </div>
      </slot>
    </template>

    <slot />
  </AppSectionCard>
</template>
