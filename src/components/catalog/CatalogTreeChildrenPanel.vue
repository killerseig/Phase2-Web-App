<script setup lang="ts">
interface Props {
  nodeId: string
  hasChildren: boolean
  isExpanded: boolean
  animateExpansion: boolean
}

const props = defineProps<Props>()

function asHTMLElement(el: Element): HTMLElement | null {
  return el instanceof HTMLElement ? el : null
}

function setAccordionEnter(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.maxHeight = '0px'
  node.style.overflow = 'hidden'
}

function runAccordionEnter(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  const target = `${node.scrollHeight}px`
  node.style.transition = 'max-height 0.3s ease-in-out'
  requestAnimationFrame(() => {
    node.style.maxHeight = target
  })
}

function cleanupAccordion(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.maxHeight = ''
  node.style.transition = ''
  node.style.overflow = ''
}

function setAccordionLeave(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.maxHeight = `${node.scrollHeight}px`
  node.style.overflow = 'hidden'
}

function runAccordionLeave(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.transition = 'max-height 0.3s ease-in-out'
  requestAnimationFrame(() => {
    node.style.maxHeight = '0px'
  })
}
</script>

<template>
  <Transition
    v-if="props.animateExpansion"
    name="accordion"
    @before-enter="setAccordionEnter"
    @enter="runAccordionEnter"
    @after-enter="cleanupAccordion"
    @before-leave="setAccordionLeave"
    @leave="runAccordionLeave"
    @after-leave="cleanupAccordion"
  >
    <div
      v-if="props.hasChildren"
      v-show="props.isExpanded"
      :id="`collapse-${props.nodeId}`"
      class="accordion-collapse"
      role="region"
      :aria-labelledby="`btn-${props.nodeId}`"
    >
      <div class="accordion-body p-0">
        <div class="accordion">
          <slot />
        </div>
      </div>
    </div>
  </Transition>

  <div
    v-else-if="props.hasChildren && props.isExpanded"
    :id="`collapse-${props.nodeId}`"
    class="accordion-collapse"
    role="region"
    :aria-labelledby="`btn-${props.nodeId}`"
  >
    <div class="accordion-body p-0">
      <div class="accordion">
        <slot />
      </div>
    </div>
  </div>
</template>
