import { httpsCallable } from 'firebase/functions'
import { ref as storageRef, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { requireFirebaseServices } from '@/firebase'
import { uploadExtension, documentMime } from '@/features/documents/formats'
import type { SdsLibrary } from '@/features/sds/types'

export function sdsErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (
    [
      'functions/internal',
      'functions/not-found',
      'functions/unavailable',
      'functions/deadline-exceeded',
    ].includes(code)
  ) {
    return 'The document service could not be reached. Refresh to try again. If this continues, contact Admin.'
  }
  return error instanceof Error ? error.message : 'The document request failed. Please try again.'
}

export async function sdsCommand<T = { ok: boolean }>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const { functions } = requireFirebaseServices()
  const call = httpsCallable<Record<string, unknown>, T>(functions, 'sdsWorkspace', {
    timeout: 120000,
  })
  return (await call({ ...data, action })).data
}
export function loadSds(jobId = '') {
  return sdsCommand<SdsLibrary>('load', { jobId })
}

export async function uploadDocument(file: File, progress: (percent: number) => void) {
  const extension = uploadExtension(file)
  const { auth, storage } = requireFirebaseServices()
  if (!auth.currentUser) throw new Error('Sign in before uploading a file.')
  const uploadId = crypto.randomUUID()
  const ref = storageRef(storage, `sds-uploads/${auth.currentUser.uid}/${uploadId}.${extension}`)
  const task = uploadBytesResumable(ref, file, { contentType: documentMime[extension] })
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => progress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      () => resolve(),
    )
  })
  return {
    uploadId,
    uploadExtension: extension,
    originalName: file.name.slice(0, 180),
    cleanup: () => deleteObject(ref).catch(() => undefined),
  }
}
