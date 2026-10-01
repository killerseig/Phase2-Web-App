import { computed, ref, watch, type Ref } from 'vue'

type Side = 'left' | 'right'
const defaults = { left: 248, right: 300 }
const minimum = { left: 180, right: 230 }
const maximum = { left: 420, right: 480 }

export function useBuilderPanels(options: {
  scope: () => string
  root: Ref<HTMLElement | undefined>
  leftOpen: Ref<boolean>
  rightOpen: Ref<boolean>
}) {
  const preferred = ref({ ...defaults })
  let beforeDrag = { ...defaults }
  function begin() {
    beforeDrag = { ...preferred.value }
  }
  function cancel() {
    preferred.value = { ...beforeDrag }
  }
  const available = ref(1200)
  const key = computed(() => (options.scope() ? `builder-panels:${options.scope()}` : ''))
  watch(
    key,
    (value) => {
      preferred.value = { ...defaults }
      if (!value) return
      try {
        const stored = JSON.parse(localStorage.getItem(value) || 'null')
        for (const side of ['left', 'right'] as const) {
          if (typeof stored?.[side] === 'number' && Number.isFinite(stored[side]))
            preferred.value[side] = Math.max(minimum[side], Math.min(maximum[side], stored[side]))
        }
      } catch {
        /* Preferences are optional; the editor remains usable. */
      }
    },
    { immediate: true },
  )
  watch(options.root, (root, _previous, cleanup) => {
    if (!root) return
    const measure = () => {
      available.value = root.clientWidth
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    cleanup(() => observer.disconnect())
  })
  const widths = computed(() => {
    const left = options.leftOpen.value ? preferred.value.left : 0
    const right = options.rightOpen.value ? preferred.value.right : 0
    const minLeft = left ? minimum.left : 0
    const minRight = right ? minimum.right : 0
    const budget = Math.max(minLeft + minRight, available.value - 172)
    const extra = left + right - minLeft - minRight
    const scale = extra ? Math.max(0, Math.min(1, (budget - minLeft - minRight) / extra)) : 1
    return {
      left: minLeft + (left - minLeft) * scale,
      right: minRight + (right - minRight) * scale,
    }
  })
  const limits = computed(() => ({
    left: Math.max(
      minimum.left,
      Math.min(maximum.left, available.value - widths.value.right - 172),
    ),
    right: Math.max(
      minimum.right,
      Math.min(maximum.right, available.value - widths.value.left - 172),
    ),
  }))
  function set(side: Side, value: number) {
    preferred.value[side] = Math.max(minimum[side], Math.min(limits.value[side], value))
  }
  function save() {
    if (!key.value) return
    try {
      localStorage.setItem(key.value, JSON.stringify(preferred.value))
    } catch {
      /* Optional. */
    }
  }
  function reset(side: Side) {
    preferred.value[side] = defaults[side]
    save()
  }
  const style = computed(() => ({
    '--builder-left-width': `${widths.value.left}px`,
    '--builder-right-width': `${widths.value.right}px`,
  }))
  return { widths, limits, minimum, style, set, save, reset, begin, cancel }
}
