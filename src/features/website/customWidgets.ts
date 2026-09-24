import type { CustomWidgetDefinition } from '../../../functions/src/websiteCustom'
import {
  customBounds,
  customDefinition,
  resolvedCustom,
} from '../../../functions/src/websiteCustom'
import { captureSavedSection } from './savedSections'
import { newSection, type WebsiteSection, type WebsiteSite } from './types'
import { nextGeometry } from './grid'
export function captureCustomWidget(
  sections: WebsiteSection[],
  ids: string[],
  name: string,
): CustomWidgetDefinition | undefined {
  const captured = captureSavedSection(sections, ids, name)
  if (
    !captured ||
    captured.sections.some(
      (section) => section.custom || section.formId || section.type === 'page-content',
    )
  )
    return
  return { ...captured, kind: 'visual', fields: [], html: '', css: '' }
}
export function customPlacement(
  definition: CustomWidgetDefinition,
  sections: WebsiteSection[],
  linked = true,
): WebsiteSection {
  const bounds = customBounds(definition.sections)
  const width = definition.kind === 'visual' ? Math.min(24, bounds.width / 45) : 16
  const height =
    definition.kind === 'visual' ? ((bounds.height / bounds.width) * width * 45) / 32 : 10
  return {
    ...newSection('custom'),
    title: definition.name,
    appearance: { padding: 0 },
    layout: nextGeometry(sections, 'custom', {
      w: Math.max(1, width),
      h: Math.max(1, Math.min(1000, height)),
    }),
    custom: linked
      ? { definitionId: definition.id, values: {} }
      : { inline: JSON.parse(JSON.stringify(definition)), values: {} },
  }
}
export function customUsages(site: WebsiteSite, id: string) {
  return [
    ...site.pages,
    ...(site.sharedLayout ? [site.sharedLayout] : []),
    ...(site.savedSections || []),
  ]
    .flatMap((page) => page.sections)
    .filter((section) => section.custom?.definitionId === id)
}
export function detachCustom(section: WebsiteSection, site: WebsiteSite) {
  const definition = customDefinition(section.custom, site.customWidgets)
  if (!definition) return
  section.custom = { inline: resolvedCustom(definition, section.custom?.values), values: {} }
}
export function updateCustomDefinition(site: WebsiteSite, definition: CustomWidgetDefinition) {
  site.customWidgets = [
    ...(site.customWidgets || []).filter((entry) => entry.id !== definition.id),
    definition,
  ]
  for (const section of customUsages(site, definition.id)) {
    section.custom!.values = Object.fromEntries(
      Object.entries(section.custom!.values).filter(([key]) =>
        definition.fields.some((field) => field.key === key),
      ),
    )
  }
}
