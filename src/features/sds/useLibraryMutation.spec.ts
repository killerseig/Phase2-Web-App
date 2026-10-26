import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sdsErrorMessage } from '@/services/sds'
import { useLibraryMutation } from './useLibraryMutation'

const fake = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/services/sds', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/sds')>(),
  uploadDocument: fake.upload,
}))

function fixture() {
  const state = { busy: ref(false), error: ref('Previous error'), progress: ref<number | null>(null) }
  return { ...state, ...useLibraryMutation(state) }
}
const file = new File(['synthetic contents'], 'document.txt', { type: 'text/plain' })

describe('Library mutation staging lifetime', () => {
  beforeEach(() => { fake.upload.mockReset() })

  it('keeps metadata-only edits and folder saves free of file uploads', async () => {
    const state = fixture()
    const command = vi.fn(async () => {
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
      uploadId: 'staged-id', uploadExtension: 'txt', originalName: file.name,
      cleanup: vi.fn(() => new Promise<void>(resolve => {
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
      expect(metadata).toMatchObject({ uploadId: 'staged-id', uploadExtension: 'txt', originalName: file.name })
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
    const state = fixture(), save = vi.fn()
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
    const state = fixture(), cleanup = vi.fn().mockResolvedValue(undefined)
    fake.upload.mockResolvedValue({ uploadId: 'staged-id', uploadExtension: 'txt', originalName: file.name, cleanup })
    await state.runMutation(async stageFile => {
      await stageFile(file)
      throw new Error(`${phase} failed`)
    })
    expect(cleanup).toHaveBeenCalledOnce()
    expect(state.error.value).toBe(`${phase} failed`)
    expect(state.busy.value).toBe(false)
    expect(state.progress.value).toBeNull()
  })
})
