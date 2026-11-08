import { getCurrentScope, onScopeDispose, watch, type Ref } from 'vue'
import { sdsErrorMessage, uploadDocument } from '@/services/sds'

type StagedUpload = Awaited<ReturnType<typeof uploadDocument>>
type UploadMetadata = Omit<StagedUpload, 'cleanup'>

/** Owns staging and request status; callers check current() after their command awaits. */
export function useLibraryMutation(state: {
  busy: Ref<boolean>
  error: Ref<string>
  progress: Ref<number | null>
  context?: () => string
}) {
  let generation = 0
  let disposed = false
  function invalidate() {
    generation++
    state.busy.value = false
    state.error.value = ''
    state.progress.value = null
  }
  const stop = state.context ? watch(state.context, invalidate, { flush: 'sync' }) : undefined
  function dispose() {
    if (disposed) return
    disposed = true
    stop?.()
    invalidate()
  }
  if (getCurrentScope()) onScopeDispose(dispose)
  async function runMutation(
    operation: (stageFile: (file: File) => Promise<UploadMetadata>, current: () => boolean) => Promise<void>,
  ) {
    if (disposed || state.busy.value) return
    const request = ++generation
    const current = () => !disposed && request === generation
    state.busy.value = true
    state.error.value = ''
    let staged: StagedUpload | undefined
    try {
      await operation(async file => {
        if (!current()) throw new Error('Document operation expired.')
        staged = await uploadDocument(file, percent => {
          if (current()) state.progress.value = percent
        })
        if (!current()) throw new Error('Document operation expired.')
        return staged
      }, current)
    } catch (error) {
      if (current()) state.error.value = sdsErrorMessage(error)
    } finally {
      try {
        await staged?.cleanup()
      } catch (error) {
        if (current() && !state.error.value) state.error.value = sdsErrorMessage(error)
      } finally {
        if (current()) {
          state.busy.value = false
          state.progress.value = null
        }
      }
    }
  }

  return { runMutation, dispose }
}
