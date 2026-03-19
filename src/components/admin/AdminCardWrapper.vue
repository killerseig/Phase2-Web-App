<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'

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
  <div class="card app-section-card">
    <!-- Header -->
    <div class="card-header panel-header">
      <h5 class="mb-0">
        <i v-if="icon" :class="`bi bi-${icon} me-2`"></i>{{ title }}
      </h5>
      <small v-if="subtitle" class="text-muted d-block mt-1">{{ subtitle }}</small>
    </div>

    <!-- Body -->
    <div class="card-body">
      <!-- Error Alert -->
      <AppAlert v-if="error" variant="danger" class="mb-3" :message="error" />

      <!-- Loading Spinner -->
      <AppLoadingState v-if="loading" message="" />

      <!-- Content -->
      <div v-else>
        <slot />
      </div>
    </div>
  </div>
</template>
