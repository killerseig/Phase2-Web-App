import type { InjectionKey, Ref } from 'vue'
import type { WebsiteSite } from './types'
export interface PublicSnapshot { site: WebsiteSite | null; version: string | null }
export const publicSnapshotKey: InjectionKey<Ref<PublicSnapshot | null>> = Symbol('public-published-snapshot')
export const publicApplicationKey: InjectionKey<boolean> = Symbol('standalone-public-application')
export const publicAssetVersionKey: InjectionKey<Ref<string | null>> = Symbol('public-asset-version')
export function embeddedPublicSnapshot(): PublicSnapshot | null {
  if (typeof document === 'undefined') return null
  const element = document.getElementById('published-website-snapshot')
  if (!element || element.getAttribute('type') !== 'application/json') return null
  try {
    const value = JSON.parse(element.textContent || '') as PublicSnapshot
    if (!value || typeof value.version !== 'string' || !value.site || !Array.isArray(value.site.pages)) return null
    return value
  } catch { return null }
}
