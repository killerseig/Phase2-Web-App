import type { WebsiteSection } from './types'
export function layoutLocked(sections: WebsiteSection[], id: string): boolean {
  const seen = new Set<string>()
  let entry = sections.find((section) => section.id === id)
  while (entry && !seen.has(entry.id)) {
    if (entry.locked) return true
    seen.add(entry.id)
    entry = sections.find((section) => section.id === entry?.parentId)
  }
  return false
}

export function descendants(sections: WebsiteSection[], ids: string[]): WebsiteSection[] {
  const included = new Set(ids)
  for (let i = 0; i < sections.length; i++)
    for (const entry of sections)
      if (entry.parentId && included.has(entry.parentId)) included.add(entry.id)
  return sections.filter((entry) => included.has(entry.id))
}
export function canContain(sections: WebsiteSection[], id: string, parentId: string): boolean {
  if (!parentId) return true
  const parent = sections.find((entry) => entry.id === parentId)
  return (
    parent?.type === 'container' &&
    !descendants(sections, [id]).some((entry) => entry.id === parentId)
  )
}
export function visibleSections(sections: WebsiteSection[]) {
  const hidden = new Set(
    descendants(
      sections,
      sections.filter((entry) => entry.hidden).map((entry) => entry.id),
    ).map((entry) => entry.id),
  )
  return sections.filter((entry) => !hidden.has(entry.id))
}
