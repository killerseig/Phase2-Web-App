import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import { isE2EActive } from '@/testing/e2eRuntime'
import { hasConfiguredFirebase } from '@/services/firebaseConfig'
import type { FormDefinition, FormRecord } from '../../functions/src/formModel'
import { normalizeFormPhoto } from './formPhotoNormalization'
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
  if (isE2EActive()) return window.__PHASE2_FORM_SERVER__ === true
  return hasConfiguredFirebase
}
export function isFormEmulatorEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_FORM_EMULATORS === 'true' &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID === 'demo-phase2-security'
}
export async function formApi<T>(
  name:
    | 'formTemplates'
    | 'formWorkspace'
    | 'formEmail'
    | 'formSubmissionViewer'
    | 'formEntries'
    | 'publicFormRecipientVerification'
    | 'formTranslation',
  data: Record<string, unknown>,
): Promise<T> {
  if (!isFormServerEnabled())
    throw new Error('Configure Firebase to use server-backed forms.')
  return (
    await httpsCallable<Record<string, unknown>, T>(requireFirebaseServices().functions, name)(data)
  ).data
}
export async function uploadFormPhoto(
  record: FormRecord,
  fieldId: string,
  file: File,
  publicCapability?: string,
  groupId?: string,
  instanceId?: string,
): Promise<FormRecord> {
  const normalized = await normalizeFormPhoto(file)
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1]!)
    reader.onerror = () => reject(new Error('This photo could not be read.'))
    reader.readAsDataURL(normalized)
  })
  return formApi('formWorkspace', {
    action: 'upload',
    ...(publicCapability ? { publicCapability } : {}),
    id: record.id,
    revision: record.revision,
    fieldId,
    ...(groupId ? { groupId, instanceId } : {}),
    contentType: normalized.type,
    base64,
  })
}
