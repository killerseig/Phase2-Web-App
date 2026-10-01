import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { useBuilderPanels } from './useBuilderPanels'

const scopes: EffectScope[] = []
function setup(account = 'website:project:admin-a') {
  const accountId = ref(account)
  const scope = effectScope()
  scopes.push(scope)
  const panels = scope.run(() =>
    useBuilderPanels({
      scope: () => accountId.value,
      root: ref<HTMLElement>(),
      leftOpen: ref(true),
      rightOpen: ref(true),
    }),
  )!
  return { panels, accountId }
}
beforeEach(() => localStorage.clear())
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  vi.restoreAllMocks()
})

it('keeps each account preferences separate and does not save a cancelled resize', async () => {
  const { panels, accountId } = setup()
  panels.set('left', 340)
  panels.save()
  panels.begin()
  panels.set('left', 400)
  panels.cancel()
  expect(panels.widths.value.left).toBe(340)
  accountId.value = 'website:project:admin-b'
  await nextTick()
  expect(panels.widths.value.left).toBe(248)
  panels.set('right', 380)
  panels.save()
  accountId.value = 'website:project:admin-a'
  await nextTick()
  expect(panels.widths.value).toEqual({ left: 340, right: 300 })
  accountId.value = ''
  await nextTick()
  expect(panels.widths.value).toEqual({ left: 248, right: 300 })
})

it('recovers from malformed preferences and stays usable when storage is blocked', () => {
  localStorage.setItem('builder-panels:website:project:admin-a', '{invalid')
  const { panels } = setup()
  expect(panels.widths.value).toEqual({ left: 248, right: 300 })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked')
  })
  panels.set('right', 380)
  expect(() => panels.save()).not.toThrow()
  expect(panels.widths.value.right).toBe(380)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked')
  })
  expect(setup().panels.widths.value).toEqual({ left: 248, right: 300 })
})
