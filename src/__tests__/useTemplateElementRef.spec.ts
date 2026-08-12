import { describe, expect, it } from 'vitest'

import {
  isElement,
  isHtmlDivElement,
  isHtmlInputElement,
  resolveTemplateElementRef,
  useTemplateElementRef,
  type TemplateElementRefValue,
} from '@/composables/useTemplateElementRef'

describe('useTemplateElementRef', () => {
  it('stores matching DOM elements from Vue template refs', () => {
    const div = document.createElement('div')
    const span = document.createElement('span')
    const { elementRef, setElementRef } = useTemplateElementRef(isHtmlDivElement)

    setElementRef(div)
    expect(elementRef.value).toBe(div)

    setElementRef(span)
    expect(elementRef.value).toBeNull()
  })

  it('clears component instances and null refs', () => {
    const div = document.createElement('div')
    const componentInstance = {} as TemplateElementRefValue
    const { elementRef, setElementRef } = useTemplateElementRef(isHtmlDivElement)

    setElementRef(div)
    setElementRef(componentInstance)
    expect(elementRef.value).toBeNull()

    setElementRef(div)
    setElementRef(null)
    expect(elementRef.value).toBeNull()
  })

  it('supports shared HTML input guards for inline input refs', () => {
    const input = document.createElement('input')
    const div = document.createElement('div')
    const { elementRef, setElementRef } = useTemplateElementRef(isHtmlInputElement)

    setElementRef(input)
    expect(elementRef.value).toBe(input)

    setElementRef(div)
    expect(elementRef.value).toBeNull()
  })

  it('resolves template refs without storing state', () => {
    const div = document.createElement('div')
    const input = document.createElement('input')
    const componentInstance = {} as TemplateElementRefValue

    expect(resolveTemplateElementRef(div, isHtmlDivElement)).toBe(div)
    expect(resolveTemplateElementRef(input, isHtmlDivElement)).toBeNull()
    expect(resolveTemplateElementRef(componentInstance, isHtmlDivElement)).toBeNull()
    expect(resolveTemplateElementRef(null, isHtmlDivElement)).toBeNull()
  })

  it('supports generic DOM element refs when consumers do their own element-type checks', () => {
    const div = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const componentInstance = {} as TemplateElementRefValue

    expect(resolveTemplateElementRef(div, isElement)).toBe(div)
    expect(resolveTemplateElementRef(svg, isElement)).toBe(svg)
    expect(resolveTemplateElementRef(componentInstance, isElement)).toBeNull()
  })
})
