import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTimecardPendingNavigation } from './useTimecardPendingNavigation'

const routes = vi.hoisted(() => ({ leave: vi.fn<(guard: () => Promise<boolean>) => void>(), update: vi.fn<(guard: () => Promise<boolean>) => void>() }))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: routes.leave, onBeforeRouteUpdate: routes.update }))
const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.clearAllMocks() })
function fixture() {
  const context = ref('a'), pending = ref(true), blocked = ref(false)
  const save = vi.fn<() => Promise<void>>().mockImplementation(async () => { pending.value = false })
  const discard = vi.fn<() => void>().mockImplementation(() => { pending.value = false })
  const confirmDiscard = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)
  const cancelConfirmation = vi.fn<() => void>(), onError = vi.fn<(error: unknown) => void>()
  let navigation!: ReturnType<typeof useTimecardPendingNavigation>
  const wrapper = mount(defineComponent({ setup() {
    navigation = useTimecardPendingNavigation({ context: () => context.value, blocked: () => blocked.value,
      hasPending: () => pending.value, save, discard, confirmDiscard, cancelConfirmation, onError })
    return () => null
  } }))
  cleanups.push(() => wrapper.unmount())
  return { ...navigation, context, pending, blocked, save, discard, confirmDiscard, cancelConfirmation, onError, wrapper }
}
describe('timecard departure preparation', () => {
  it('uses the same flush for leaving, changing route and signing out', async () => {
    const state = fixture()
    expect(routes.leave).toHaveBeenCalledWith(state.prepareNavigation)
    expect(routes.update).toHaveBeenCalledWith(state.prepareNavigation)
    expect(await state.prepareNavigation()).toBe(true)
    expect(state.save).toHaveBeenCalledOnce()
    expect(state.confirmDiscard).not.toHaveBeenCalled()
  })
  it('keeps failed work until the user explicitly discards it', async () => {
    const state = fixture()
    state.save.mockRejectedValue(new Error('Offline'))
    expect(await state.prepareNavigation()).toBe(false)
    expect(state.pending.value).toBe(true)
    expect(state.discard).not.toHaveBeenCalled()
    state.confirmDiscard.mockResolvedValueOnce(true)
    expect(await state.prepareNavigation()).toBe(true)
    expect(state.discard).toHaveBeenCalledOnce()
  })
  it('rejects a second departure while a save is pending', async () => {
    const state = fixture()
    let done!: () => void
    state.save.mockImplementationOnce(() => new Promise<void>(resolve => { done = resolve }))
    const first = state.prepareNavigation()
    expect(await state.prepareNavigation()).toBe(false)
    state.pending.value = false
    done()
    expect(await first).toBe(true)
    expect(state.save).toHaveBeenCalledOnce()
  })
  it('does not discard a replacement context after a late confirmation', async () => {
    const state = fixture()
    let answer!: (value: boolean) => void
    state.save.mockRejectedValueOnce(new Error('Offline'))
    state.confirmDiscard.mockImplementationOnce(() => new Promise(resolve => { answer = resolve }))
    const departure = state.prepareNavigation()
    await vi.waitFor(() => expect(state.confirmDiscard).toHaveBeenCalledOnce())
    state.context.value = 'b'
    state.context.value = 'a'
    answer(true)
    expect(await departure).toBe(false)
    expect(state.discard).not.toHaveBeenCalled()
  })
  it('warns on browser exit with pending work and removes its listener on unmount', () => {
    const state = fixture()
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
    state.wrapper.unmount()
    const gone = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(gone)
    expect(gone.defaultPrevented).toBe(false)
  })
})
