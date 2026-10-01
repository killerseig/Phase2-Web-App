// Shared, read-only comparison. IDs match objects across moves instead of reporting
// every later widget as edited when one is inserted or removed.
export interface WebsiteChange {
  path: string
  kind: 'added' | 'removed' | 'changed'
  before: string
  after: string
}
export interface WebsiteComparison {
  changes: WebsiteChange[]
  total: number
}
const labels: Record<string, string> = {
  pages: 'Pages',
  sections: 'Widgets',
  sharedLayout: 'Shared layout',
  theme: 'Site design',
  branding: 'Branding',
  forms: 'Forms',
  savedSections: 'Saved sections',
  customWidgets: 'Custom widgets',
  title: 'Title',
  text: 'Text',
  css: 'CSS',
  html: 'HTML',
  js: 'JavaScript',
  imageId: 'Image',
  linkUrl: 'Link destination',
  linkLabel: 'Link label',
  inNavigation: 'Show in navigation',
  appearance: 'Appearance',
  devices: 'Responsive settings',
  parentId: 'Parent widget',
  titleRichText: 'Title formatting',
  textRichText: 'Text formatting',
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (object(value))
    return (
      '{' +
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    )
  return JSON.stringify(value) ?? 'undefined'
}
function display(value: unknown): string {
  if (value === undefined || value === null) return '(not set)'
  if (value === '') return '(empty)'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 240 ? text.slice(0, 240) + '… (shortened)' : text
}
function name(value: Record<string, unknown>) {
  return String(value.title || value.name || value.label || value.id)
}
export function compareWebsites(before: unknown, after: unknown): WebsiteComparison {
  const result: WebsiteComparison = { changes: [], total: 0 }
  function add(path: string, previous: unknown, next: unknown) {
    result.total++
    if (result.changes.length < 150)
      result.changes.push({
        path: path || 'Website',
        kind: previous === undefined ? 'added' : next === undefined ? 'removed' : 'changed',
        before: display(previous),
        after: display(next),
      })
  }
  function walk(previous: unknown, next: unknown, path: string) {
    if (canonical(previous) === canonical(next)) return
    if (object(previous) && object(next)) {
      for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
        walk(
          previous[key],
          next[key],
          [path, labels[key] || key.replace(/([A-Z])/g, ' $1')].filter(Boolean).join(' / '),
        )
      }
    } else if (
      Array.isArray(previous) &&
      Array.isArray(next) &&
      [...previous, ...next].every((item) => object(item) && typeof item.id === 'string')
    ) {
      const oldIds = previous.map((item) => item.id),
        newIds = next.map((item) => item.id)
      const oldCommon = oldIds.filter((id) => newIds.includes(id)),
        newCommon = newIds.filter((id) => oldIds.includes(id))
      if (canonical(oldCommon) !== canonical(newCommon))
        add(path + ' / Order', previous.map(name).join(' → '), next.map(name).join(' → '))
      for (const id of new Set([...oldIds, ...newIds])) {
        const oldItem = previous.find((item) => item.id === id),
          newItem = next.find((item) => item.id === id)
        const itemPath = path + ' / ' + name(newItem || oldItem)
        if (!oldItem || !newItem)
          add(itemPath, oldItem ? name(oldItem) : undefined, newItem ? name(newItem) : undefined)
        else walk(oldItem, newItem, itemPath)
      }
    } else add(path, previous, next)
  }
  walk(before ?? {}, after ?? {}, '')
  return result
}
