import { computed, inject, ref, type Ref } from 'vue'
import { textBoxValueKey, type ElementTarget } from './textBox'
export function useTextBox(_root: Ref<HTMLElement | undefined>, target: Ref<ElementTarget>) {
  const read = inject(textBoxValueKey, undefined)
  const value = computed(() => read?.(target.value))
  const style = computed(() => value.value ? {
    position: 'relative' as const,
    width: value.value.width === undefined ? undefined : `${value.value.width}px`,
    height: value.value.height === undefined ? undefined : `${value.value.height}px`,
    maxWidth: 'none', boxSizing: 'border-box' as const,
    padding: value.value.padding === undefined ? undefined : `${value.value.padding}px`,
    transform: `translate(${value.value.x || 0}px, ${value.value.y || 0}px) rotate(${value.value.rotation || 0}deg)`,
    transformOrigin: 'center',
  } : undefined)
  const noop = () => {}
  return { enabled: computed(() => false), selected: computed(() => false), style, guides: ref([]), rotationPreview: ref<number>(), rotationSnapped: ref(false), select: noop, start: noop, key: noop, consumeClick: () => false }
}
