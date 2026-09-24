import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useWebsiteHistory } from './useWebsiteHistory'
import type { WebsiteSite } from './types'

afterEach(() => vi.useRealTimers())
function setup(limit = 30) {
  vi.useFakeTimers()
  const scope = effectScope()
  const site = ref<WebsiteSite>()
  const history = scope.run(() => useWebsiteHistory(site, limit))!
  history.reset({ name: 'Initial', accent: '#174878', pages: [] })
  return { site, history, scope }
}
describe('local website draft history', () => {
  it('keeps an inline editing session together even across pauses and focus changes', () => {
    const { site, history, scope } = setup()
    history.beginGroup()
    site.value!.name = 'First word'
    vi.advanceTimersByTime(800)
    history.checkpoint()
    site.value!.name = 'First word and second word'
    history.endGroup()
    history.undo()
    expect(site.value!.name).toBe('Initial')
    history.redo()
    expect(site.value!.name).toBe('First word and second word')
    scope.stop()
  })
  it('groups typing and supports immediate undo and redo before the timer fires', () => {
    const { site, history, scope } = setup()
    site.value!.name = 'F'
    vi.advanceTimersByTime(200)
    site.value!.name = 'Final'
    expect(history.canUndo.value).toBe(true)
    history.undo()
    expect(site.value!.name).toBe('Initial')
    history.redo()
    expect(site.value!.name).toBe('Final')
    vi.advanceTimersByTime(1000)
    history.undo()
    expect(site.value!.name).toBe('Initial')
    expect(history.canUndo.value).toBe(false)
    scope.stop()
  })
  it('separates structural edits from typing and drops redo after a new edit', () => {
    const { site, history, scope } = setup()
    site.value!.name = 'Typed'
    history.change(() => {
      site.value!.accent = '#ffffff'
    })
    history.undo()
    expect(site.value!.name).toBe('Typed')
    expect(site.value!.accent).toBe('#174878')
    site.value!.name = 'New branch'
    expect(history.canRedo.value).toBe(false)
    vi.advanceTimersByTime(400)
    history.redo()
    expect(site.value!.accent).toBe('#174878')
    scope.stop()
  })
  it('bounds history, resets on reload, and cancels pending timers on disposal', () => {
    const { site, history, scope } = setup(2)
    for (const name of ['One', 'Two', 'Three'])
      history.change(() => {
        site.value!.name = name
      })
    history.undo()
    history.undo()
    expect(site.value!.name).toBe('One')
    expect(history.canUndo.value).toBe(false)
    site.value!.name = 'Pending'
    history.reset({ name: 'Reloaded', accent: '#000000', pages: [] })
    vi.advanceTimersByTime(1000)
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
    site.value!.name = 'Pending again'
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
