<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'

defineOptions({
  name: 'JobAccessBadge',
})

interface Props {
  isForeman?: boolean
  isAdmin?: boolean
  isOnRoster?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isForeman: false,
  isAdmin: false,
  isOnRoster: false,
})

const badgeInfo = computed(() => {
  if (props.isForeman) {
    return {
      icon: 'bi bi-person-badge',
      label: 'You are Foreman',
      variantClass: 'bg-success',
    }
  }

  if (props.isAdmin) {
    return {
      icon: 'bi bi-shield-check',
      label: 'Admin',
      variantClass: 'bg-primary',
    }
  }

  if (props.isOnRoster) {
    return {
      icon: 'bi bi-person',
      label: 'On Roster',
      variantClass: 'bg-info',
    }
  }

  return null
})
</script>

<template>
  <AppBadge
    v-if="badgeInfo"
    :variant-class="badgeInfo.variantClass"
  >
    <i :class="[badgeInfo.icon, 'me-1']"></i>{{ badgeInfo.label }}
  </AppBadge>
</template>
