import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAppToast } from '@/composables/useAppToast'
import { useToastMessages } from '@/composables/useToastMessages'

const toastAdd = vi.hoisted(() => vi.fn())

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: toastAdd,
  }),
}))

async function flushMicrotasks() {
  await Promise.resolve()
}

describe('useAppToast', () => {
  afterEach(() => {
    toastAdd.mockClear()
  })

  it('shows trimmed messages with default severity, summary, and lifetime', () => {
    const toast = useAppToast()

    toast.show({ detail: '  Saved successfully.  ' })

    expect(toastAdd).toHaveBeenCalledWith({
      group: 'app',
      severity: 'info',
      summary: 'Info Message',
      detail: 'Saved successfully.',
      life: 4200,
    })
  })

  it('honors custom summaries and lifetimes', () => {
    const toast = useAppToast()

    toast.show({
      severity: 'error',
      summary: 'Shop Orders',
      detail: 'Could not submit order.',
      life: 9000,
    })

    expect(toastAdd).toHaveBeenCalledWith({
      group: 'app',
      severity: 'error',
      summary: 'Shop Orders',
      detail: 'Could not submit order.',
      life: 9000,
    })
  })

  it('falls back to severity summaries for blank custom summaries', () => {
    const toast = useAppToast()

    toast.show({
      severity: 'warn',
      summary: '   ',
      detail: 'Check this record.',
    })

    expect(toastAdd).toHaveBeenCalledWith({
      group: 'app',
      severity: 'warn',
      summary: 'Warning Message',
      detail: 'Check this record.',
      life: 4200,
    })
  })

  it('does not show empty detail messages', () => {
    const toast = useAppToast()

    toast.error('   ', 'Daily Logs')

    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('provides convenience helpers for severity-specific messages', () => {
    const toast = useAppToast()

    toast.success('Created.', 'Create User')
    toast.error('Failed.', 'Users')

    expect(toastAdd).toHaveBeenNthCalledWith(1, {
      group: 'app',
      severity: 'success',
      summary: 'Create User',
      detail: 'Created.',
      life: 4200,
    })
    expect(toastAdd).toHaveBeenNthCalledWith(2, {
      group: 'app',
      severity: 'error',
      summary: 'Users',
      detail: 'Failed.',
      life: 5200,
    })
  })
})

describe('useToastMessages', () => {
  afterEach(() => {
    toastAdd.mockClear()
  })

  it('watches message refs, shows matching toasts, and clears consumed messages', async () => {
    const source = ref('')
    const scope = effectScope()

    scope.run(() => {
      useToastMessages([
        {
          source,
          severity: 'success',
          summary: 'Daily Logs',
          life: 6100,
        },
      ])
    })

    source.value = '  Draft saved.  '
    await nextTick()
    await flushMicrotasks()

    expect(toastAdd).toHaveBeenCalledWith({
      group: 'app',
      severity: 'success',
      summary: 'Daily Logs',
      detail: 'Draft saved.',
      life: 6100,
    })
    expect(source.value).toBe('')

    scope.stop()
  })

  it('does not show unchanged, blank, or filtered messages', async () => {
    const source = ref('')
    const scope = effectScope()

    scope.run(() => {
      useToastMessages([
        {
          source,
          severity: 'error',
          summary: 'Jobs',
          clear: false,
          when: (message) => message.includes('show'),
        },
      ])
    })

    source.value = '   '
    await nextTick()
    source.value = 'hide this'
    await nextTick()

    expect(toastAdd).not.toHaveBeenCalled()

    source.value = 'show this'
    await nextTick()
    await flushMicrotasks()

    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      summary: 'Jobs',
      detail: 'show this',
    }))

    source.value = 'show this'
    await nextTick()

    expect(toastAdd).toHaveBeenCalledTimes(1)

    scope.stop()
  })

  it('can leave source messages in place when clear is disabled', async () => {
    const source = ref('')
    const scope = effectScope()

    scope.run(() => {
      useToastMessages([
        {
          source,
          summary: 'Login',
          clear: false,
        },
      ])
    })

    source.value = 'Welcome back.'
    await nextTick()
    await flushMicrotasks()

    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      summary: 'Login',
      detail: 'Welcome back.',
    }))
    expect(source.value).toBe('Welcome back.')

    scope.stop()
  })
})
