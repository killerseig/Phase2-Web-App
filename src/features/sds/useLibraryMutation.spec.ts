import { ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sdsErrorMessage } from '@/services/sds'
import { useLibraryMutation } from './useLibraryMutation'

const fake = vi.hoisted(() => ({ upload: vi.fn<typeof import('@/services/sds').uploadDocument>() }))
vi.mock('@/services/sds', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/sds')>(),
  uploadDocument: fake.upload,
}))

function fixture(context?: Ref<string>) {
  const state = { busy: ref(false), error: ref('Previous error'), progress: ref<number | null>(null), context: context ? () => context.value : undefined }
  return { ...state, ...useLibraryMutation(state) }
}
const uploadId = '00000000-0000-4000-8000-000000000001' as const
const file = new File(['synthetic contents'], 'document.txt', { type: 'text/plain' })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('Library mutation staging lifetime', () => {
  beforeEach(() => { fake.upload.mockReset() })

  it('keeps metadata-only edits and folder saves free of file uploads', async () => {
    const state = fixture()
    const command = vi.fn<() => Promise<void>>(async () => {
      expect(state.busy.value).toBe(true)
      expect(state.error.value).toBe('')
    })
    await state.runMutation(command)
    expect(command).toHaveBeenCalledOnce()
    expect(fake.upload).not.toHaveBeenCalled()
    expect(state.busy.value).toBe(false)
    expect(state.progress.value).toBeNull()
  })

  it('reports validation errors before staging and leaves no upload to clean', async () => {
    const state = fixture()
    await state.runMutation(async () => { throw new Error('Choose a file before saving.') })
    expect(fake.upload).not.toHaveBeenCalled()
    expect(state.error.value).toBe('Choose a file before saving.')
    expect(state.busy.value).toBe(false)
  })

  it('keeps the upload alive through save and refresh, then awaits cleanup', async () => {
    const state = fixture(), events: string[] = []
    let finishCleanup!: () => void
    const staged = {
      uploadId, uploadExtension: 'txt' as const, originalName: file.name,
      cleanup: vi.fn<() => Promise<void>>(() => new Promise<void>(resolve => {
        events.push('cleanup'); finishCleanup = resolve
      })),
    }
    fake.upload.mockImplementation(async (picked: File, progress: (percent: number) => void) => {
      expect(picked).toBe(file)
      progress(65)
      events.push('upload')
      return staged
    })
    const pending = state.runMutation(async stageFile => {
      const metadata = await stageFile(file)
      expect(metadata).toMatchObject({ uploadId, uploadExtension: 'txt', originalName: file.name })
      expect(state.progress.value).toBe(65)
      expect(staged.cleanup).not.toHaveBeenCalled()
      events.push('save', 'refresh')
    })
    await vi.waitFor(() => expect(staged.cleanup).toHaveBeenCalledOnce())
    expect(events).toEqual(['upload', 'save', 'refresh', 'cleanup'])
    expect(state.busy.value).toBe(true)
    finishCleanup()
    await pending
    expect(state.busy.value).toBe(false)
    expect(state.progress.value).toBeNull()
    expect(state.error.value).toBe('')
  })

  it('does not save after a failed upload and clears busy/progress for retry', async () => {
    const state = fixture(), save = vi.fn<() => void>()
    const failure = { code: 'functions/unavailable' }
    fake.upload.mockImplementation(async (_file: File, progress: (percent: number) => void) => {
      progress(30)
      throw failure
    })
    await state.runMutation(async stageFile => { await stageFile(file); save() })
    expect(save).not.toHaveBeenCalled()
    expect(state.error.value).toBe(sdsErrorMessage(failure))
    expect(state.busy.value).toBe(false)
    expect(state.progress.value).toBeNull()
  })

  it.each(['save', 'refresh'])('cleans staging after a failed %s without swallowing its message', async phase => {
    const state = fixture(), cleanup = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    fake.upload.mockResolvedValue({ uploadId, uploadExtension: 'txt', originalName: file.name, cleanup })
    await state.runMutation(async stageFile => {
      await stageFile(file)
      throw new Error(`${phase} failed`)
    })
    expect(cleanup).toHaveBeenCalledOnce()
    expect(state.error.value).toBe(`${phase} failed`)
    expect(state.busy.value).toBe(false)
    expect(state.progress.value).toBeNull()
  })

  it('rejects staging across context ABA and preserves the newer operation through old cleanup', async () => {
    const context = ref('admin-a'), state = fixture(context)
    const upload = deferred<Awaited<ReturnType<typeof fake.upload>>>()
    const cleanup = deferred<void>(), nextCommand = deferred<void>()
    const clean = vi.fn<() => Promise<void>>(() => cleanup.promise), save = vi.fn<() => void>()
    let progress!: (value: number) => void
    fake.upload.mockImplementation((_file, update) => { progress = update; return upload.promise })
    const old = state.runMutation(async stage => { await stage(file); save() })
    progress(20)
    context.value = 'none'; context.value = 'admin-a'
    const newer = state.runMutation(async () => { await nextCommand.promise })
    state.progress.value = 80
    progress(50)
    upload.resolve({ uploadId, uploadExtension: 'txt', originalName: file.name, cleanup: clean })
    await vi.waitFor(() => expect(clean).toHaveBeenCalledOnce())
    expect(save).not.toHaveBeenCalled()
    expect(state.busy.value).toBe(true)
    expect(state.progress.value).toBe(80)
    cleanup.reject(new Error('Old cleanup failed'))
    await old
    expect(state.busy.value).toBe(true)
    expect(state.error.value).toBe('')
    nextCommand.resolve(); await newer
    expect(state.busy.value).toBe(false)
    state.dispose()
  })

  it('ignores an old command error after disposal and rejects later operations', async () => {
    const state = fixture(), command = deferred<void>(), followup = vi.fn<() => Promise<void>>(async () => undefined)
    const pending = state.runMutation(async () => { await command.promise })
    state.dispose(); state.dispose()
    command.reject(new Error('Old failure')); await pending
    await state.runMutation(followup)
    expect(followup).not.toHaveBeenCalled()
    expect(state.error.value).toBe('')
    expect(state.busy.value).toBe(false)
  })

  it('does not start overlapping commands and releases busy after cleanup failure', async () => {
    const state = fixture(), command = deferred<void>(), duplicate = vi.fn<() => Promise<void>>(async () => undefined)
    fake.upload.mockResolvedValue({ uploadId, uploadExtension: 'txt', originalName: file.name, cleanup: vi.fn<() => Promise<void>>(async () => { throw new Error('Cleanup failed') }) })
    const pending = state.runMutation(async stage => { await stage(file); await command.promise })
    await state.runMutation(duplicate)
    expect(duplicate).not.toHaveBeenCalled()
    command.resolve(); await pending
    expect(state.error.value).toBe('Cleanup failed')
    expect(state.busy.value).toBe(false)
    expect(state.progress.value).toBeNull()
  })
})
