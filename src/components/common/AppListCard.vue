<script setup lang="ts">
import { computed, useSlots } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'

defineOptions({
  name: 'AppListCard',
})

interface Props {
  title: string
  icon?: string
  subtitle?: string
  badgeLabel?: string | number | null
  badgeVariantClass?: string
  bodyClass?: string
  headerClass?: string
  muted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  icon: '',
  subtitle: '',
  badgeLabel: null,
  badgeVariantClass: '',
  bodyClass: 'p-0',
  headerClass: '',
  muted: false,
})

const slots = useSlots()

const hasHeaderActions = computed(() => {
  return props.badgeLabel !== null && props.badgeLabel !== undefined || Boolean(slots['header-actions'])
})

const cardClasses = computed(() => [
  'app-list-card',
  props.muted ? 'panel-muted' : '',
].filter(Boolean))
</script>

<template>
  <AppSectionCard
    :class="cardClasses"
    :body-class="bodyClass"
    :header-class="headerClass"
  >
    <template #header>
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div>
          <h5 class="app-section-card__title mb-0">
            <i v-if="icon" :class="[icon, 'me-2']" aria-hidden="true" />
            {{ title }}
          </h5>
          <small v-if="subtitle" class="app-section-card__subtitle d-block mt-1">{{ subtitle }}</small>
        </div>
        <div v-if="hasHeaderActions" class="d-flex align-items-center gap-2">
          <AppBadge v-if="badgeLabel !== null && badgeLabel !== undefined" :label="badgeLabel" :variant-class="badgeVariantClass" />
          <slot name="header-actions" />
        </div>
      </div>
    </template>

    <slot />
  </AppSectionCard>
</template>
