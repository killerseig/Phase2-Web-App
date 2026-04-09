<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import { ROLES, type Role } from '@/constants/app'

defineOptions({
  name: 'RoleBadge',
})

const roleMap: Record<Role, { label: string; class: string }> = {
  [ROLES.NONE]: { label: 'None', class: 'text-bg-secondary' },
  [ROLES.FOREMAN]: { label: 'Foreman', class: 'text-bg-warning' },
  [ROLES.CONTROLLER]: { label: 'Controller', class: 'text-bg-primary' },
  [ROLES.ADMIN]: { label: 'Admin', class: 'text-bg-danger' },
}

interface Props {
  role: Role | string
  uppercase?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  uppercase: false,
})

const badgeInfo = computed(() => (
  roleMap[props.role as Role] ?? { label: props.role, class: 'text-bg-secondary' }
))
</script>

<template>
  <AppBadge
    :label="badgeInfo.label"
    :variant-class="badgeInfo.class"
    :uppercase="uppercase"
  />
</template>
