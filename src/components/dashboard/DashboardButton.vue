<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
defineProps<{ label: string; severity?: 'secondary'; size?: 'small' }>()
</script>
<template>
  <AppButton
    :variant="severity === 'secondary' ? 'default' : 'primary'"
    :class="{ 'dashboard-button--small': size === 'small' }"
    >{{ label }}</AppButton
  >
</template>
<style scoped>
.dashboard-button--small {
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
}
</style>
