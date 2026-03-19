<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import { ROLES, type Role } from '@/constants/app'

defineOptions({
  name: 'RoleBadge',
})

const roleMap: Record<Role, { label: string; class: string }> = {
  [ROLES.NONE]: { label: 'None', class: 'bg-secondary' },
  [ROLES.FOREMAN]: { label: 'Foreman', class: 'bg-warning text-dark' },
  [ROLES.CONTROLLER]: { label: 'Controller', class: 'bg-primary' },
  [ROLES.ADMIN]: { label: 'Admin', class: 'bg-danger' },
}

interface Props {
  role: Role | string
  uppercase?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  uppercase: false,
})

const badgeInfo = computed(() => (
  roleMap[props.role as Role] ?? { label: props.role, class: 'bg-secondary' }
))
</script>

<template>
  <AppBadge
    :label="badgeInfo.label"
    :variant-class="badgeInfo.class"
    :uppercase="uppercase"
  />
</template>
