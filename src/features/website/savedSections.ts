import { descendants } from './containers'
import { copySection } from './pageTools'
import { materializeGrid } from './grid'
import type { SavedWebsiteSection, WebsiteSection } from './types'

function copyTree(source: WebsiteSection[]) {
  const copies = materializeGrid(source).map(copySection)
  const ids = new Map(source.map((section, index) => [section.id, copies[index]!.id]))
  for (const copy of copies) copy.parentId = copy.parentId ? ids.get(copy.parentId) : undefined
  return copies
}
export function captureSavedSection(
  sections: WebsiteSection[],
  selectedIds: string[],
  name: string,
): SavedWebsiteSection | undefined {
  if (!name.trim() || name.trim().length > 80) return
  const copies = copyTree(descendants(sections, selectedIds))
  if (!copies.length || copies.length > 30) return
  const roots = copies.filter((section) => !section.parentId)
  const x = Math.min(...roots.map((section) => section.layout!.x))
  const y = Math.min(...roots.map((section) => section.layout!.y))
  for (const root of roots)
    root.layout = { ...root.layout!, x: root.layout!.x - x, y: root.layout!.y - y }
  return { id: crypto.randomUUID(), name: name.trim(), sections: copies }
}
export function insertSavedSection(
  entry: SavedWebsiteSection,
  existing: WebsiteSection[],
): WebsiteSection[] | undefined {
  if (!entry.sections.length || existing.length + entry.sections.length > 30) return
  const copies = copyTree(entry.sections)
  const roots = copies.filter((section) => !section.parentId)
  const originX = Math.min(...roots.map((section) => section.layout!.x))
  const originY = Math.min(...roots.map((section) => section.layout!.y))
  const placed = materializeGrid(existing).filter((section) => !section.parentId)
  const bottom = placed.length
    ? Math.max(...placed.map((section) => section.layout!.y + section.layout!.h)) + 1
    : 0
  const height =
    Math.max(...roots.map((section) => section.layout!.y + section.layout!.h)) - originY
  if (bottom + height > 10000) return
  // Normalize the combined root stack so inserting never exhausts the z-index range.
  const ordered = [...placed, ...roots].sort((a, b) => {
    const aNew = roots.includes(a),
      bNew = roots.includes(b)
    return Number(aNew) - Number(bNew) || a.layout!.z - b.layout!.z
  })
  const layers = new Map(ordered.map((section, index) => [section.id, index + 1]))
  for (const root of roots)
    root.layout = {
      ...root.layout!,
      x: root.layout!.x - originX,
      y: root.layout!.y - originY + bottom,
      z: layers.get(root.id)!,
    }
  const result = existing.map((section) =>
    !section.parentId
      ? {
          ...section,
          layout: {
            ...placed.find((entry) => entry.id === section.id)!.layout!,
            z: layers.get(section.id)!,
          },
        }
      : section,
  )
  return [...result, ...copies]
}
