<script setup lang="ts">
defineOptions({
  name: 'ControllerStatCard',
})

interface Props {
  label: string
  value: string | number
  helperText?: string
  valueClass?: string
}

withDefaults(defineProps<Props>(), {
  helperText: '',
  valueClass: '',
})
</script>

<template>
  <div class="card controller-stat-card h-100">
    <div class="card-body">
      <div class="text-muted small text-uppercase fw-semibold">{{ label }}</div>
      <div :class="['stat-value', valueClass]">{{ value }}</div>
      <div class="small text-muted">{{ helperText }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.controller-stat-card {
  background: linear-gradient(180deg, rgba($primary, 0.1) 0%, rgba($primary, 0.04) 100%);
  border: 1px solid rgba($primary, 0.18);
  color: $body-color;
}

.stat-value {
  font-size: clamp(1.55rem, 3vw, 2rem);
  font-weight: 700;
  line-height: 1.1;
  margin: 0.35rem 0 0.15rem;
}
</style>
