import type { WebsiteSection } from './types'
import { materializeGrid } from './grid'

// Equal z values paint in DOM order: the later sibling is in front.
export function layerSiblings(sections: WebsiteSection[], parentId?: string) {
  return sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => (section.parentId || '') === (parentId || ''))
    .sort((a, b) => (b.section.layout?.z || 0) - (a.section.layout?.z || 0) || b.index - a.index)
    .map(({ section }) => section)
}

export function layerRows(sections: WebsiteSection[]) {
  const rows: { section: WebsiteSection; depth: number; inheritedHidden: boolean }[] = []
  const visited = new Set<string>()
  function visit(parentId: string | undefined, depth: number, hidden: boolean) {
    for (const section of layerSiblings(sections, parentId)) {
      if (visited.has(section.id)) continue
      visited.add(section.id)
      rows.push({ section, depth, inheritedHidden: hidden })
      visit(section.id, depth + 1, hidden || section.hidden)
    }
  }
  visit(undefined, 0, false)
  return rows
}

export function reorderLayer(
  sections: WebsiteSection[],
  sourceId: string,
  targetId: string,
  placement: 'before' | 'after',
): WebsiteSection[] {
  const source = sections.find((section) => section.id === sourceId)
  const target = sections.find((section) => section.id === targetId)
  if (
    !source ||
    !target ||
    source === target ||
    (source.parentId || '') !== (target.parentId || '')
  )
    return sections
  const siblings = layerSiblings(sections, source.parentId)
  const ordered = siblings.filter((section) => section.id !== sourceId)
  ordered.splice(
    ordered.findIndex((section) => section.id === targetId) + (placement === 'after' ? 1 : 0),
    0,
    source,
  )
  if (ordered.every((section, index) => section.id === siblings[index]?.id)) return sections
  const layers = new Map(ordered.map((section, index) => [section.id, ordered.length - index]))
  // Keep document order, positions, sizes and container membership intact.
  return materializeGrid(sections).map((section) =>
    layers.has(section.id)
      ? { ...section, layout: { ...section.layout!, z: layers.get(section.id)! } }
      : section,
  )
}
