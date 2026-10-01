import { phase2Site } from './phase2Site'
import { withWebsiteDefaults, type WebsiteSite } from './types'

/** Use existing asset IDs only: importing never uploads, deletes or publishes assets. */
export function starterFromDraft(current: WebsiteSite): WebsiteSite {
  const photos = [...new Set(current.pages.flatMap(page => page.sections.map(section => section.imageId)).filter(Boolean))]
  const starter = withWebsiteDefaults(phase2Site({
    logo: current.branding?.logoId || '', interior: photos[0] || '',
    architecture: photos[1], finished: photos[2], planning: photos[3],
  }))
  // Keep the editable Careers form definition, but do not expose an unconfigured form.
  for (const page of starter.pages) for (const section of page.sections)
    if (section.type === 'form') section.hidden = true
  // Private reusable libraries are independent of the new page layout.
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
  if (current.customWidgets) starter.customWidgets = clone(current.customWidgets)
  if (current.savedSections) starter.savedSections = clone(current.savedSections)
  if (current.theme?.presets && starter.theme) starter.theme.presets = clone(current.theme.presets)
  starter.forms = [...clone(current.forms || []).filter(form => !starter.forms?.some(next => next.id === form.id)), ...(starter.forms || [])]
  return starter
}

export function starterBackupKey(scope: string) {
  return 'website-starter-backup:v1:' + encodeURIComponent(scope)
}
export function backupBeforeStarter(storage: Storage, scope: string, draft: WebsiteSite, version: number, saved: string) {
  if (!scope) throw new Error('Sign in before importing a starter.')
  const key = starterBackupKey(scope) + ':' + crypto.randomUUID()
  const value = JSON.stringify({ draft, version, saved, manualSave: true, updatedAt: Date.now() })
  storage.setItem(key, value)
  if (storage.getItem(key) !== value) throw new Error('The current draft backup could not be verified.')
  return { key, value }
}
