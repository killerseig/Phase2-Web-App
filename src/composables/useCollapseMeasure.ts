import { computed, nextTick, onMounted, ref, watch, type Ref } from 'vue'

export function useCollapseMeasure(open: Ref<boolean>) {
  const contentRef = ref<HTMLElement | null>(null)
  const contentHeight = ref(0)

  function setContentRef(el: HTMLElement | null) {
    contentRef.value = el
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

  watch(open, val => {
    if (val) nextTick(measure)
  })

  return {
    setContentRef,
    measure,
    collapseStyle: style,
  }
}
