import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
  type ComponentPublicInstance,
  type Ref,
} from 'vue'

export function useCollapseMeasure(open: Ref<boolean>) {
  const contentRef = ref<HTMLElement | null>(null)
  const contentHeight = ref(0)
  let resizeObserver: ResizeObserver | null = null

  function stopObserving() {
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  function startObserving() {
    stopObserving()
    if (!contentRef.value || typeof ResizeObserver === 'undefined') return

    resizeObserver = new ResizeObserver(() => {
      measure()
    })
    resizeObserver.observe(contentRef.value)
  }

  function setContentRef(el: Element | ComponentPublicInstance | null) {
    contentRef.value = el instanceof HTMLElement ? el : null
    startObserving()
    measure()
  }

  function measure() {
    if (!contentRef.value) return
    contentHeight.value = contentRef.value.scrollHeight || 0
  }

  const style = computed(() => {
    const h = contentHeight.value || contentRef.value?.scrollHeight || 0
    return {
      maxHeight: open.value ? `${h}px` : '0px',
      opacity: open.value ? '1' : '0',
    }
  })

  onMounted(() => {
    nextTick(measure)
  })

  onBeforeUnmount(() => {
    stopObserving()
  })

  watch(open, val => {
    if (val) nextTick(measure)
  })

  return {
    setContentRef,
    measure,
    collapseStyle: style,
  }
}
