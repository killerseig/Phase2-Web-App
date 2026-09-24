import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import type { WebsiteSite } from '@/features/website/types'

export async function websiteCommand<T>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const { functions } = requireFirebaseServices()
  return (
    await httpsCallable<Record<string, unknown>, T>(functions, 'websiteBuilder', {
      timeout: 90000,
    })({ ...data, action })
  ).data
}
export async function loadPublishedWebsite() {
  const { functions } = requireFirebaseServices()
  return (
    await httpsCallable<void, { site: WebsiteSite | null }>(functions, 'getPublishedWebsite')()
  ).data.site
}
export function websiteError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (/internal|unavailable|not-found/.test(code))
    return 'The website service is unavailable. Try again or contact your administrator.'
  return error instanceof Error
    ? error.message
    : 'The website could not be updated. Please try again.'
}
export async function uploadWebsiteImage(file: File) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    !file.size ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Choose a JPG, PNG or WebP image up to 5 MB.')
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.readAsDataURL(file)
  })
  return websiteCommand<{ id: string; base64: string }>('uploadImage', { base64, name: file.name })
}

export async function submitWebsiteForm(data: Record<string, unknown>) {
  const { functions } = requireFirebaseServices()
  return (
    await httpsCallable<Record<string, unknown>, { received: boolean }>(
      functions,
      'submitWebsiteForm',
    )(data)
  ).data
}
export async function websiteFormAdmin<T>(action: string, data: Record<string, unknown> = {}) {
  const { functions } = requireFirebaseServices()
  return (
    await httpsCallable<Record<string, unknown>, T>(functions, 'websiteFormAdmin', {
      timeout: 150000,
    })({ ...data, action })
  ).data
}
