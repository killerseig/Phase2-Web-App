<script setup lang="ts">
import { computed, useSlots } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import BaseCard from '@/components/common/BaseCard.vue'

defineOptions({
  name: 'AppSectionCard',
})

interface Props {
  title?: string
  subtitle?: string
  icon?: string
  bodyClass?: string
  headerClass?: string
  footerClass?: string
  loading?: boolean
  error?: string
  titleTag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div'
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  icon: '',
  bodyClass: '',
  headerClass: '',
  footerClass: '',
  loading: false,
  error: '',
  titleTag: 'h5',
})

const slots = useSlots()

const hasHeader = computed(() => Boolean(slots.header || props.title || props.subtitle))
const hasFooter = computed(() => Boolean(slots.footer))
</script>

<template>
  <BaseCard
    card-class="app-section-card"
    :body-class="bodyClass"
    :header-class="headerClass"
    :footer-class="footerClass"
  >
    <template v-if="hasHeader" #header>
      <slot name="header">
        <component :is="titleTag" class="mb-0">
          <i v-if="icon" :class="[icon, 'me-2']" aria-hidden="true" />
          {{ title }}
        </component>
        <small v-if="subtitle" class="text-muted d-block mt-1">{{ subtitle }}</small>
      </slot>
    </template>

    <AppAlert v-if="error" variant="danger" class="mb-3" :message="error" />
    <AppLoadingState v-else-if="loading" message="" />
    <slot v-else />

    <template v-if="hasFooter" #footer>
      <slot name="footer" />
    </template>
  </BaseCard>
</template>
