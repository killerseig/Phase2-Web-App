import type { SharedDashboardWidget as Widget } from './sharedDashboards'
import { rootSelection } from './editorGeometry'

export type LockKey = 'positionLocked' | 'sizeLocked'

/** Lock commands have the same outermost-selection scope as group transforms. */
export function selectionLockState(widgets: Widget[], selected: string[], key: LockKey) {
  const roots = rootSelection(widgets, selected)
  const byId = new Map(widgets.map((w) => [w.id, w]))
  const parents = new Map<string, string>()
  let ownCount = 0,
    inheritedCount = 0,
    effectiveCount = 0
  for (const root of roots) {
    const seen = new Set([root.id])
    let parent = byId.get(root.parentId || ''),
      inherited = false
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      if (parent[key]) {
        inherited = true
        parents.set(parent.id, parent.title || 'Untitled container')
      }
      parent = byId.get(parent.parentId || '')
    }
    if (root[key]) ownCount++
    if (inherited) inheritedCount++
    if (root[key] || inherited) effectiveCount++
  }
  return {
    ids: roots.map((w) => w.id),
    total: roots.length,
    ownCount,
    inheritedCount,
    parents: [...parents.values()],
    checked: roots.length > 0 && effectiveCount === roots.length,
    mixed: effectiveCount > 0 && effectiveCount < roots.length,
    // Keep bulk actions atomic: never silently edit only part of an inherited selection.
    blocked: inheritedCount > 0,
  }
}

export function setSelectionLock(
  widgets: Widget[],
  selected: string[],
  key: LockKey,
  value: boolean,
): Widget[] {
  const state = selectionLockState(widgets, selected, key)
  if (state.blocked || !state.ids.length) return widgets
  const changed = new Set(
    widgets.filter((w) => state.ids.includes(w.id) && !!w[key] !== value).map((w) => w.id),
  )
  if (!changed.size) return widgets
  return widgets.map((w) => (changed.has(w.id) ? { ...w, [key]: value } : w))
}
