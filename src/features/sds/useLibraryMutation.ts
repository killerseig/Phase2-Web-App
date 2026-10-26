import type { Ref } from 'vue'
import { sdsErrorMessage, uploadDocument } from '@/services/sds'

type StagedUpload = Awaited<ReturnType<typeof uploadDocument>>
type UploadMetadata = Omit<StagedUpload, 'cleanup'>

/** Shares the staging lifetime; callers still own validation, commands and UI changes. */
export function useLibraryMutation(state: {
  busy: Ref<boolean>
  error: Ref<string>
  progress: Ref<number | null>
}) {
  async function runMutation(
    operation: (stageFile: (file: File) => Promise<UploadMetadata>) => Promise<void>,
  ) {
    state.busy.value = true
    state.error.value = ''
    let staged: StagedUpload | undefined
    try {
      await operation(async file => {
        staged = await uploadDocument(file, percent => {
          state.progress.value = percent
        })
        return staged
      })
    } catch (error) {
      state.error.value = sdsErrorMessage(error)
    } finally {
      await staged?.cleanup()
      state.busy.value = false
      state.progress.value = null
    }
  }

  return { runMutation }
}
