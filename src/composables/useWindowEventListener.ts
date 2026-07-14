import { onBeforeUnmount, onMounted } from 'vue'

export function useWindowEventListener<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
) {
  onMounted(() => {
    window.addEventListener(type, listener, options)
  })

  onBeforeUnmount(() => {
    window.removeEventListener(type, listener, options)
  })
}
