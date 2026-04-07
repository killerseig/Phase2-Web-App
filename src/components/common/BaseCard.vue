<script setup lang="ts">
import { computed, useSlots } from 'vue'

defineOptions({
  name: 'BaseCard',
})

interface Props {
  cardClass?: string
  headerClass?: string
  bodyClass?: string
  footerClass?: string
  hover?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  cardClass: '',
  headerClass: '',
  bodyClass: '',
  footerClass: '',
  hover: false,
})

const slots = useSlots()

const hasHeader = computed(() => Boolean(slots.header))
const hasFooter = computed(() => Boolean(slots.footer))

const cardClasses = computed(() => [
  'card',
  props.hover ? 'card-hover' : '',
  props.cardClass,
].filter(Boolean))

const headerClasses = computed(() => ['card-header', 'panel-header', props.headerClass].filter(Boolean))
const bodyClasses = computed(() => ['card-body', props.bodyClass].filter(Boolean))
const footerClasses = computed(() => ['card-footer', 'panel-footer', props.footerClass].filter(Boolean))
</script>

<template>
  <div :class="cardClasses">
    <div v-if="hasHeader" :class="headerClasses">
      <slot name="header" />
    </div>

    <div :class="bodyClasses">
      <slot />
    </div>

    <div v-if="hasFooter" :class="footerClasses">
      <slot name="footer" />
    </div>
  </div>
</template>
