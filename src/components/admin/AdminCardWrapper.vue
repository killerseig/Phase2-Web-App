<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title: string
  icon?: string
  loading?: boolean
  error?: string
  subtitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: '',
  subtitle: '',
  icon: 'info-circle',
})
</script>

<template>
  <div class="card">
    <!-- Header -->
    <div class="card-header bg-light">
      <h5 class="mb-0">
        <i v-if="icon" :class="`bi bi-${icon} me-2`"></i>{{ title }}
      </h5>
      <small v-if="subtitle" class="text-muted d-block mt-1">{{ subtitle }}</small>
    </div>

    <!-- Body -->
    <div class="card-body">
      <!-- Error Alert -->
      <div v-if="error" class="alert alert-danger mb-3" role="alert">
        {{ error }}
      </div>

      <!-- Loading Spinner -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading…</span>
        </div>
      </div>

      <!-- Content -->
      <div v-else>
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-header h5 {
  font-style: italic;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}
</style>
