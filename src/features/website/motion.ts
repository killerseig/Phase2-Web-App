import { watch, type Ref } from 'vue'
import type { WebsiteMotion } from '../../../functions/src/websiteMotion'
export function playWebsiteMotion(element: HTMLElement, motion?: WebsiteMotion) {
  if (
    !motion ||
    motion.effect === 'none' ||
    !element.animate ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return
  const base = getComputedStyle(element)
  const transform = {
    fade: 'none',
    rise: 'translateY(24px)',
    slide: 'translateX(-24px)',
    zoom: 'scale(0.96)',
  }[motion.effect]
  return element.animate(
    [
      { opacity: 0, transform },
      { opacity: base.opacity, transform: base.transform },
    ],
    {
      duration: motion.duration ?? 600,
      delay: motion.delay ?? 0,
      easing: motion.easing ?? 'ease-out',
      fill: 'backwards',
      iterations: 1,
    },
  )
}
export function useWebsiteMotion(
  element: Ref<HTMLElement | undefined>,
  settings: () => WebsiteMotion | undefined,
  editing: () => boolean,
) {
  watch(
    [element, settings, editing],
    ([target, motion, preview], _, cleanup) => {
      if (!target || preview || !motion || motion.effect === 'none') return
      const reduce = matchMedia('(prefers-reduced-motion: reduce)')
      let animation: Animation | undefined
      let observer: IntersectionObserver | undefined
      const cancel = () => {
        animation?.cancel()
        observer?.disconnect()
      }
      const play = () => {
        observer?.disconnect()
        animation = playWebsiteMotion(target, motion)
      }
      if (!reduce.matches) {
        if (typeof IntersectionObserver === 'undefined') play()
        else {
          observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) play()
          })
          observer.observe(target)
        }
      }
      const preference = () => {
        if (reduce.matches) cancel()
      }
      reduce.addEventListener('change', preference)
      cleanup(() => {
        cancel()
        reduce.removeEventListener('change', preference)
      })
    },
    { flush: 'post' },
  )
}
