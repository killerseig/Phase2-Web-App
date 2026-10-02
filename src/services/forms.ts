import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import { isE2EActive } from '@/testing/e2eRuntime'
import type { FormDefinition, FormRecord } from '../../functions/src/formModel'
declare global {
  interface Window {
    __PHASE2_FORM_SERVER__?: boolean
  }
}
export interface ServerFormTemplate {
  id: string
  draft: FormDefinition
  revision: number
  latestVersion: number
  archived: boolean
  used: boolean
  definition?: FormRecord['definition']
}
export function isFormServerEnabled(): boolean {
  return (
    !import.meta.env.DEV ||
    import.meta.env.VITE_FORM_EMULATORS === 'true' ||
    (isE2EActive() && window.__PHASE2_FORM_SERVER__ === true)
  )
}
export async function formApi<T>(
  name: 'formTemplates' | 'formWorkspace' | 'formEmail' | 'formSubmissionViewer',
  data: Record<string, unknown>,
): Promise<T> {
  if (!isFormServerEnabled())
    throw new Error('Start the local Form Builder emulator profile to use server drafts.')
  return (
    await httpsCallable<Record<string, unknown>, T>(requireFirebaseServices().functions, name)(data)
  ).data
}
export async function uploadFormPhoto(
  record: FormRecord,
  fieldId: string,
  file: File,
): Promise<FormRecord> {
  if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP photo of at most 2 MB.')
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1]!)
    reader.onerror = () => reject(new Error('This photo could not be read.'))
    reader.readAsDataURL(file)
  })
  return formApi('formWorkspace', {
    action: 'upload',
    id: record.id,
    revision: record.revision,
    fieldId,
    contentType: file.type,
    base64,
  })
}
