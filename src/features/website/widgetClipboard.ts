import { descendants, layoutLocked } from './containers'
import { materializeGrid, type WidgetGeometry } from './grid'
import { selectionBounds, type GeometryMap } from './selection'
import type { WebsiteSection } from './types'
import type { CustomWidgetDefinition } from '../../../functions/src/websiteCustom'
import type { MenuLink } from '../../../functions/src/websiteContent'

export interface WebsiteWidgetClipboard {
  context: string
  sections: WebsiteSection[]
  roots: string[]
  positions: GeometryMap
}

export interface WebsitePasteOptions {
  context: string
  point?: { x: number; y: number }
  spacing?: { x: number; y: number }
  formIds?: readonly string[]
  widgetIds?: readonly string[]
  positioned?: boolean
}

export type WebsitePastePlan =
  | { ok: true; sections: WebsiteSection[]; roots: string[]; layouts?: GeometryMap }
  | { ok: false; error: string }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const fail = (error: string): WebsitePastePlan => ({ ok: false, error })

/** Capture complete trees without transferring ownership of the live page's objects. */
export function captureWebsiteWidgets(
  sections: WebsiteSection[],
  ids: string[],
  context: string,
): WebsiteWidgetClipboard | undefined {
  const entries = descendants(sections, ids)
  if (
    !entries.length ||
    entries.some((entry) => entry.type === 'page-content') ||
    new Set(entries.map((entry) => entry.id)).size !== entries.length
  )
    return
  const included = new Set(entries.map((entry) => entry.id))
  const roots = entries
    .filter((entry) => !entry.parentId || !included.has(entry.parentId))
    .map((entry) => entry.id)
  if (!roots.length) return
  const positions = materializeGrid(sections)
  return clone({
    context,
    sections: entries,
    roots,
    positions: Object.fromEntries(
      positions
        .filter((entry) => roots.includes(entry.id))
        .map((entry) => [entry.id, entry.layout!]),
    ),
  })
}

function validGeometry(layout: WidgetGeometry) {
  return (
    [layout.x, layout.y, layout.w, layout.h, layout.z].every(Number.isFinite) &&
    layout.x >= 0 &&
    layout.y >= 0 &&
    layout.w >= 1 &&
    layout.h >= 1 &&
    layout.x + layout.w <= 1000 &&
    layout.y + layout.h <= 10000 &&
    Number.isInteger(layout.z) &&
    layout.z >= 0 &&
    layout.z <= 10000
  )
}

function collectOwnedIds(sections: WebsiteSection[], ids: Set<string>) {
  const links = (entries: MenuLink[]) => {
    for (const entry of entries) {
      ids.add(entry.id)
      links(entry.children || [])
    }
  }
  for (const section of sections) {
    ids.add(section.id)
    section.items.forEach((item) => ids.add(item.id))
    links(section.navigation?.links || [])
    if (section.custom?.inline) {
      ids.add(section.custom.inline.id)
      collectOwnedIds(section.custom.inline.sections, ids)
    }
  }
}

/** Planner only: callers commit its copies and optional existing z patches atomically. */
export function planWebsitePaste(
  snapshot: WebsiteWidgetClipboard,
  existing: WebsiteSection[],
  options: WebsitePasteOptions,
): WebsitePastePlan {
  const source = snapshot.sections
  const ids = new Set(source.map((entry) => entry.id))
  const rootIds = new Set(snapshot.roots)
  const roots = source.filter((entry) => rootIds.has(entry.id))
  if (
    !source.length ||
    source.length !== ids.size ||
    !roots.length ||
    roots.length !== snapshot.roots.length ||
    rootIds.size !== snapshot.roots.length ||
    source.some((entry) => entry.type === 'page-content')
  )
    return fail('Copy a valid widget selection before pasting.')
  if (existing.length + source.length > 30)
    return fail('This selection would exceed the 30-widget limit.')
  for (const entry of source) {
    const seen = new Set([entry.id])
    let parentId = entry.parentId
    while (parentId && ids.has(parentId)) {
      const parent = source.find((item) => item.id === parentId)!
      if (parent.type !== 'container' || seen.has(parentId))
        return fail('The copied container hierarchy is invalid. Copy it again.')
      seen.add(parentId)
      parentId = parent.parentId
    }
    const actualRoot = !entry.parentId || !ids.has(entry.parentId)
    if (actualRoot !== rootIds.has(entry.id))
      return fail('The copied container hierarchy is invalid. Copy it again.')
    if (entry.formId && options.formIds && !options.formIds.includes(entry.formId))
      return fail('The copied form is no longer in the form library. Restore it before pasting.')
    if (
      entry.custom?.definitionId &&
      !entry.custom.inline &&
      options.widgetIds &&
      !options.widgetIds.includes(entry.custom.definitionId)
    )
      return fail(
        'The linked custom widget is no longer in the library. Restore it before pasting.',
      )
  }
  for (const entry of roots) {
    if (!entry.parentId) continue
    const parent = existing.find((item) => item.id === entry.parentId)
    if (snapshot.context !== options.context || parent?.type !== 'container')
      return fail('Paste these widgets in their original container, or copy the whole container.')
    if (layoutLocked(existing, parent.id))
      return fail('Unlock the destination container before pasting into it.')
  }

  const copies = clone(source)
  const topRoots = copies.filter((entry) => rootIds.has(entry.id) && !entry.parentId)
  if (options.positioned !== false && topRoots.length) {
    for (const entry of topRoots) {
      const position = snapshot.positions[entry.id]
      if (!entry.layout && position) entry.layout = clone(position)
      if (!entry.layout || !validGeometry(entry.layout))
        return fail('The copied widgets do not fit within the supported canvas.')
    }
    const spacing = options.spacing || { x: 1, y: 1 }
    if (![spacing.x, spacing.y].every((value) => Number.isFinite(value) && value > 0))
      return fail('Set valid grid spacing before pasting.')
    const geometry = Object.fromEntries(topRoots.map((entry) => [entry.id, entry.layout!]))
    const box = selectionBounds(geometry)!
    const minX = -box.x,
      minY = -box.y,
      maxX = 1000 - box.x - box.w,
      maxY = 10000 - box.y - box.h
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const point =
      options.point && [options.point.x, options.point.y].every(Number.isFinite)
        ? options.point
        : undefined
    const origin = point ? { x: point.x - box.x, y: point.y - box.y } : { x: 0, y: 0 }
    const candidates = point ? [origin] : []
    for (const [x, y] of [
      [1, 1],
      [0, 1],
      [1, 0],
      [-1, -1],
      [0, -1],
      [-1, 0],
      [1, -1],
      [-1, 1],
    ]) {
      for (let step = 1; step <= 32; step++)
        candidates.push({
          x: origin.x + x! * step * spacing.x,
          y: origin.y + y! * step * spacing.y,
        })
    }
    const occupied = materializeGrid(existing)
      .filter((entry) => !entry.parentId)
      .map((entry) => entry.layout!)
    const same = (left: WidgetGeometry, right: WidgetGeometry) =>
      (['x', 'y', 'w', 'h'] as const).every((key) => Math.abs(left[key] - right[key]) < 0.00000001)
    const moved = (entry: WebsiteSection, x: number, y: number) => ({
      ...entry.layout!,
      x: x === 0 ? entry.layout!.x : clamp(entry.layout!.x + x, 0, 1000 - entry.layout!.w),
      y: y === 0 ? entry.layout!.y : clamp(entry.layout!.y + y, 0, 10000 - entry.layout!.h),
    })
    const seen = new Set<string>()
    let offset: { x: number; y: number } | undefined
    for (const candidate of candidates) {
      const x = clamp(candidate.x, minX, maxX),
        y = clamp(candidate.y, minY, maxY),
        key = `${x}:${y}`
      if (seen.has(key)) continue
      seen.add(key)
      if (!topRoots.some((entry) => occupied.some((other) => same(moved(entry, x, y), other)))) {
        offset = { x, y }
        break
      }
    }
    if (!offset)
      return fail(
        'No distinct nearby position fits within the canvas. Move a widget and try again.',
      )
    for (const entry of topRoots) entry.layout = moved(entry, offset.x, offset.y)
  }

  // Children retain their authored geometry. Only copied roots need a new top layer.
  const layeredCopies = topRoots
    .filter((entry) => entry.layout)
    .sort((a, b) => a.layout!.z - b.layout!.z)
  const layeredExisting = existing.filter((entry) => entry.layout)
  const highest = Math.max(0, ...layeredExisting.map((entry) => entry.layout!.z))
  let layouts: GeometryMap | undefined
  let base = highest
  if (highest + layeredCopies.length > 10000) {
    if (
      layeredExisting.some(
        (entry) => entry.type === 'page-content' || layoutLocked(existing, entry.id),
      )
    )
      return fail(
        'There is no free layer above this page. Unlock or lower its top layers before pasting.',
      )
    layouts = Object.fromEntries(
      [...layeredExisting]
        .sort((a, b) => a.layout!.z - b.layout!.z)
        .map((entry, index) => [entry.id, { ...entry.layout!, z: index + 1 }]),
    )
    base = layeredExisting.length
  }
  layeredCopies.forEach((entry, index) => {
    entry.layout = { ...entry.layout!, z: base + index + 1 }
  })

  const used = new Set<string>()
  collectOwnedIds(existing, used)
  collectOwnedIds(source, used)
  const fresh = () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const id = crypto.randomUUID()
      if (!used.has(id)) {
        used.add(id)
        return id
      }
    }
    throw new Error('Could not create unique widget IDs. Try again.')
  }
  const renewLinks = (links: MenuLink[]) => {
    for (const link of links) {
      link.id = fresh()
      renewLinks(link.children || [])
    }
  }
  const renewTree = (entries: WebsiteSection[]) => {
    const mapping = new Map(entries.map((entry) => [entry.id, fresh()]))
    for (const entry of entries) {
      entry.id = mapping.get(entry.id)!
      if (entry.parentId && mapping.has(entry.parentId))
        entry.parentId = mapping.get(entry.parentId)!
      entry.items.forEach((item) => {
        item.id = fresh()
      })
      renewLinks(entry.navigation?.links || [])
      if (entry.custom?.inline) renewDefinition(entry.custom.inline)
    }
    return mapping
  }
  const renewDefinition = (definition: CustomWidgetDefinition) => {
    definition.id = fresh()
    const mapping = renewTree(definition.sections)
    for (const field of definition.fields)
      if (field.sectionId && mapping.has(field.sectionId))
        field.sectionId = mapping.get(field.sectionId)!
    definition.html = definition.html.replace(
      /(<website-widget\s+id=")([a-zA-Z0-9_-]+)("\s*>)/g,
      (match, before, id, after) => (mapping.has(id) ? before + mapping.get(id) + after : match),
    )
  }
  try {
    const mapping = renewTree(copies)
    return {
      ok: true,
      sections: copies,
      roots: snapshot.roots.map((id) => mapping.get(id)!),
      ...(layouts ? { layouts } : {}),
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not copy these widgets. Try again.')
  }
}
