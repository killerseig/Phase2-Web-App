import { shallowRef, type ComponentPublicInstance } from 'vue'

export type TemplateElementRefValue = Element | ComponentPublicInstance | null

export function isElement(element: Element): element is Element {
  return element instanceof Element
}

export function isHtmlDivElement(element: Element): element is HTMLDivElement {
  return element instanceof HTMLDivElement
}

export function isHtmlInputElement(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement
}

export function resolveTemplateElementRef<TElement extends Element>(
  element: TemplateElementRefValue,
  isTargetElement: (element: Element) => element is TElement,
) {
  return element instanceof Element && isTargetElement(element) ? element : null
}

export function useTemplateElementRef<TElement extends Element>(
  isTargetElement: (element: Element) => element is TElement,
) {
  const elementRef = shallowRef<TElement | null>(null)

  function setElementRef(element: TemplateElementRefValue) {
    elementRef.value = resolveTemplateElementRef(element, isTargetElement)
  }

  return {
    elementRef,
    setElementRef,
  }
}
