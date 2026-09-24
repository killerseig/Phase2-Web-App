import { Script } from 'node:vm'
import { validateTextBoxes, type TextBoxes } from './websiteTextBox'
import {
  validateRichText,
  richTextPlain,
  richTextLinks,
  type RichTextNode,
} from './websiteRichText'
import { parseWebsiteHtml, validateJavascript } from './websiteLayout'
import { validateTheme, type WebsiteTheme } from './websiteTheme'
import {
  blockTypes,
  blockErrors,
  validateBlockItem,
  validateBlockOptions,
  type BlockOptions,
  type BlockItemData,
} from './websiteBlocks'
import { validateForm, publicForm } from './websiteForms'
import { interactiveWidgetErrors } from './websiteInteractive'
import type { WebsiteFormDefinition } from './websiteForms'
import type { CustomWidgetDefinition, CustomWidgetPlacement } from './websiteCustom'
import {
  customBindingError,
  customCodeLinks,
  customMarkup,
  customDefinition,
  resolvedCustom,
  validateCustomCode,
  visibleCustomSections,
} from './websiteCustom'
import type { ImageSettings, NavigationSettings } from './websiteContent'
import { menuLinks, textLinks } from './websiteContent'
import { HttpsError } from 'firebase-functions/v2/https'
import {
  compilePageCss,
  type ContainerLayout,
  type ItemSizing,
  type PageLayout,
} from './websiteDesign'

export const sectionTypes = [
  'page-content',
  'hero',
  'text',
  'image-text',
  'gallery',
  'cards',
  'contact',
  'container',
  'image',
  'navigation',
  'footer',
  'custom',
  'form',
  'accordion',
  'tabs',
  'video',
  'downloads',
  ...blockTypes,
] as const
export type SectionType = (typeof sectionTypes)[number]
export interface WebsiteItem extends BlockItemData {
  textBoxes?: TextBoxes
  linkRichText?: RichTextNode
  titleRichText?: RichTextNode
  textRichText?: RichTextNode
  textFormat?: 'markdown'
  imageSettings?: ImageSettings
  id: string
  title: string
  text: string
  imageId: string
  alt: string
  linkLabel: string
  linkUrl: string
}
export interface WebsiteSection extends WebsiteItem {
  blockOptions?: BlockOptions
  formId?: string
  custom?: CustomWidgetPlacement
  locked?: boolean
  navigation?: NavigationSettings
  styleClass?: string
  sizing?: ItemSizing
  devices?: Partial<
    Record<
      'tablet' | 'mobile',
      {
        hidden?: boolean
        appearance?: WebsiteSection['appearance']
        container?: ContainerLayout
        sizing?: ItemSizing
      }
    >
  >
  parentId?: string
  container?: ContainerLayout
  appearance?: {
    background?: string
    color?: string
    borderColor?: string
    borderWidth?: number
    radius?: number
    padding?: number
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
    margin?: number
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
    fontSize?: number
    headingSize?: number
    opacity?: number
    rotation?: number
    fontFamily?: 'sans' | 'serif' | 'mono'
    textAlign?: 'left' | 'center' | 'right'
    imageFit?: 'cover' | 'contain'
  }
  layout?: { x: number; y: number; w: number; h: number; z: number }
  span?: 4 | 6 | 8 | 12
  type: SectionType
  hidden: boolean
  items: WebsiteItem[]
}
export interface WebsitePage {
  html?: string
  js?: string
  useSiteLayout?: boolean
  chrome?: 'widgets'
  css?: string
  layout?: PageLayout
  grid?: { visible: boolean; snap: boolean; spacingX: number; spacingY: number }
  id: string
  title: string
  slug: string
  description: string
  inNavigation: boolean
  sections: WebsiteSection[]
}
export interface WebsiteSite {
  css?: string
  js?: string
  sharedLayout?: WebsitePage
  theme?: WebsiteTheme
  forms?: WebsiteFormDefinition[]
  customWidgets?: CustomWidgetDefinition[]
  savedSections?: { id: string; name: string; sections: WebsiteSection[] }[]
  name: string
  accent: string
  pages: WebsitePage[]
  branding?: WebsiteBranding
}
export interface WebsiteBranding {
  logoId: string
  logoAlt: string
  footerText: string
  footerLinks: { id: string; label: string; url: string }[]
}

function parseTheme(value: unknown): WebsiteTheme {
  try {
    return validateTheme(value)
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Invalid website design.')
  }
}
function invalid(message: string): never {
  throw new HttpsError('invalid-argument', message)
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('Invalid website content.')
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, label: string, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    invalid(`${label} is required and must be within ${max} characters.`)
  return value.trim()
}
function id(value: unknown) {
  const result = text(value, 80, 'ID', true)
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) invalid('Invalid content ID.')
  return result
}
function bool(value: unknown) {
  if (typeof value !== 'boolean') invalid('Invalid visibility.')
  return value
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(`Use no more than ${max} entries.`)
  return value
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length)
    invalid('Page and section IDs and page URLs must be unique.')
}
function link(value: unknown) {
  const url = text(value, 1000, 'Link')
  if (!url) return ''
  if (/^\/website(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(url) || url === '/login') return url
  if (/^mailto:[^\s<>]+@[^\s<>]+$/.test(url) || /^tel:\+?[0-9() .-]+$/.test(url)) return url
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !/[\s\u0000-\u001f]/.test(url)
    )
      return parsed.href
  } catch {
    /* Report one actionable error for all unsupported links. */
  }
  return invalid('Use an HTTPS, email, phone, /login, or /website/page link.')
}
function item(value: unknown): WebsiteItem {
  const data = object(value)
  let titleRichText: RichTextNode | undefined,
    textRichText: RichTextNode | undefined,
    linkRichText: RichTextNode | undefined
  let textBoxes: TextBoxes | undefined
  try {
    if (data.titleRichText !== undefined) titleRichText = validateRichText(data.titleRichText, true)
    if (data.textRichText !== undefined) textRichText = validateRichText(data.textRichText)
    if (data.linkRichText !== undefined) linkRichText = validateRichText(data.linkRichText, true)
    if (data.textBoxes !== undefined) textBoxes = validateTextBoxes(data.textBoxes)
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Invalid rich text.')
  }
  if (data.textFormat !== undefined && data.textFormat !== 'markdown')
    invalid('Unsupported text format.')
  if (richTextLinks(linkRichText).length) invalid('Set button destinations using the button link.')
  let blockItem: BlockItemData
  try {
    blockItem = validateBlockItem(data)
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Invalid widget item.')
  }
  return {
    ...blockItem,
    ...(textBoxes === undefined ? {} : { textBoxes }),
    ...(data.textFormat === undefined || textRichText ? {} : { textFormat: 'markdown' }),
    ...(titleRichText ? { titleRichText } : {}),
    ...(textRichText ? { textRichText } : {}),
    ...(linkRichText ? { linkRichText } : {}),
    ...(data.imageSettings === undefined
      ? {}
      : { imageSettings: imageSettings(data.imageSettings) }),
    id: id(data.id),
    title: titleRichText ? richTextPlain(titleRichText) : text(data.title, 160, 'Heading'),
    text: textRichText ? richTextPlain(textRichText) : text(data.text, 8000, 'Text'),
    imageId: data.imageId === '' ? '' : id(data.imageId),
    alt: text(data.alt, 300, 'Image description'),
    linkLabel: text(
      linkRichText ? richTextPlain(linkRichText) : data.linkLabel,
      80,
      'Button label',
    ),
    linkUrl: link(data.linkUrl),
  }
}
function imageSettings(value: unknown): ImageSettings {
  const data = object(value)
  if (
    data.overlay !== undefined &&
    (typeof data.overlay !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(data.overlay))
  )
    invalid('Choose a hex overlay color.')
  return {
    ...optionalNumber(data, 'focusX', 0, 100),
    ...optionalNumber(data, 'focusY', 0, 100),
    ...optionalNumber(data, 'zoom', 1, 3),
    ...optionalNumber(data, 'overlayOpacity', 0, 80),
    ...(data.overlay === undefined ? {} : { overlay: data.overlay as string }),
    ...(data.caption === undefined ? {} : { caption: text(data.caption, 300, 'Image caption') }),
  }
}
function navigation(value: unknown): NavigationSettings {
  const data = object(value)
  function menuLabel(value: unknown) {
    const entry = object(value)
    let labelRichText: RichTextNode | undefined
    try {
      if (entry.labelRichText !== undefined)
        labelRichText = validateRichText(entry.labelRichText, true)
    } catch (error) {
      return invalid(error instanceof Error ? error.message : 'Invalid menu text.')
    }
    if (richTextLinks(labelRichText).length) invalid('Set menu destinations using the menu URL.')
    return {
      label: text(labelRichText ? richTextPlain(labelRichText) : entry.label, 80, 'Menu label'),
      ...(labelRichText ? { labelRichText } : {}),
    }
  }
  const pageLabels =
    data.pageLabels === undefined
      ? undefined
      : list(data.pageLabels, 30).map((value) => {
          const entry = object(value)
          return { id: id(entry.id), ...menuLabel(entry) }
        })
  if (pageLabels) unique(pageLabels.map((entry) => entry.id))
  let brandRichText: RichTextNode | undefined
  try {
    if (data.brandRichText !== undefined) brandRichText = validateRichText(data.brandRichText, true)
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Invalid brand text.')
  }
  function links(values: unknown, child = false): NavigationSettings['links'] {
    const result = list(values, child ? 8 : 12).map((value) => {
      const entry = object(value)
      if (child && entry.children !== undefined) invalid('Use one dropdown level.')
      return {
        id: id(entry.id),
        ...menuLabel(entry),
        url: link(entry.url),
        ...(entry.children === undefined ? {} : { children: links(entry.children, true) }),
      }
    })
    unique(result.map((entry) => entry.id))
    return result
  }
  return {
    showBrand: bool(data.showBrand),
    ...(pageLabels ? { pageLabels } : {}),
    ...(data.loginLabel === undefined ? {} : { loginLabel: menuLabel(data.loginLabel) }),
    ...(data.brandText === undefined ? {} : { brandText: text(data.brandText, 160, 'Brand name') }),
    ...(brandRichText ? { brandRichText } : {}),
    showPages: bool(data.showPages),
    showLogin: bool(data.showLogin),
    links: links(data.links),
  }
}
function widgetLayout(value: unknown): NonNullable<WebsiteSection['layout']> {
  const data = object(value)
  const numbers = ['x', 'y', 'w', 'h', 'z'] as const
  for (const field of numbers)
    if (typeof data[field] !== 'number' || !Number.isFinite(data[field]))
      invalid('Widget geometry must contain finite numbers.')
  const layout = {
    x: data.x as number,
    y: data.y as number,
    w: data.w as number,
    h: data.h as number,
    z: data.z as number,
  }
  if (
    layout.x < 0 ||
    layout.y < 0 ||
    layout.w < 1 ||
    layout.h < 1 ||
    layout.x + layout.w > 1000 ||
    layout.y + layout.h > 10000 ||
    !Number.isInteger(layout.z) ||
    layout.z < 0 ||
    layout.z > 10000
  )
    invalid('Widget geometry is outside the supported canvas.')
  return layout
}
function pageGrid(value: unknown): NonNullable<WebsitePage['grid']> {
  const data = object(value)
  if (
    ![0.25, 0.5, 1, 2, 4].includes(data.spacingX as number) ||
    ![0.25, 0.5, 1, 2, 4].includes(data.spacingY as number)
  )
    invalid('Choose supported grid spacing.')
  return {
    visible: bool(data.visible),
    snap: bool(data.snap),
    spacingX: data.spacingX as number,
    spacingY: data.spacingY as number,
  }
}
function appearance(value: unknown): NonNullable<WebsiteSection['appearance']> {
  const data = object(value)
  const result: Record<string, unknown> = {}
  for (const key of ['background', 'color', 'borderColor']) {
    if (data[key] === undefined) continue
    if (typeof data[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(data[key] as string))
      invalid('Use a six-digit hex appearance color.')
    result[key] = data[key]
  }
  for (const [key, min, max] of [
    ['borderWidth', 0, 24],
    ['radius', 0, 160],
    ['padding', 0, 160],
    ['paddingTop', 0, 160],
    ['paddingRight', 0, 160],
    ['paddingBottom', 0, 160],
    ['paddingLeft', 0, 160],
    ['margin', 0, 160],
    ['marginTop', 0, 160],
    ['marginRight', 0, 160],
    ['marginBottom', 0, 160],
    ['marginLeft', 0, 160],
    ['fontSize', 10, 100],
    ['headingSize', 12, 160],
    ['opacity', 0, 100],
    ['rotation', -180, 180],
  ] as const) {
    const number = data[key]
    if (number === undefined) continue
    if (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max)
      invalid(`Invalid appearance ${key}.`)
    result[key] = number
  }
  for (const [key, allowed] of [
    ['fontFamily', ['sans', 'serif', 'mono']],
    ['textAlign', ['left', 'center', 'right']],
    ['imageFit', ['cover', 'contain']],
  ] as const) {
    if (data[key] === undefined) continue
    if (!(allowed as readonly unknown[]).includes(data[key])) invalid(`Invalid appearance ${key}.`)
    result[key] = data[key]
  }
  return result
}
function containerSettings(value: unknown): NonNullable<WebsiteSection['container']> {
  const data = object(value)
  if (
    !['row', 'column'].includes(data.direction as string) ||
    typeof data.gap !== 'number' ||
    !Number.isFinite(data.gap) ||
    data.gap < 0 ||
    data.gap > 160
  )
    invalid('Choose a row or column and a gap from 0 to 160 pixels.')
  return {
    direction: data.direction as 'row' | 'column',
    gap: data.gap as number,
    ...(data.wrap === undefined ? {} : { wrap: bool(data.wrap) }),
    ...optionalChoice(data, 'align', ['stretch', 'start', 'center', 'end']),
    ...optionalChoice(data, 'justify', ['start', 'center', 'end', 'space-between', 'space-around']),
  }
}
function optionalChoice(
  data: Record<string, unknown>,
  key: string,
  choices: readonly string[],
): Record<string, never> | Record<string, string> {
  if (data[key] === undefined) return {}
  if (!choices.includes(data[key] as string)) invalid(`Invalid ${key} option.`)
  return { [key]: data[key] as string }
}
function optionalNumber(data: Record<string, unknown>, key: string, min: number, max: number) {
  if (data[key] === undefined) return {}
  const value = data[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    invalid(`Invalid ${key} value.`)
  return { [key]: value as number }
}
function itemSizing(value: unknown): ItemSizing {
  const data = object(value)
  return {
    ...optionalNumber(data, 'grow', 0, 12),
    ...optionalNumber(data, 'basis', 0, 100),
    ...optionalNumber(data, 'minHeight', 0, 2000),
    ...optionalNumber(data, 'height', 32, 2000),
    ...optionalChoice(data, 'align', ['auto', 'stretch', 'start', 'center', 'end']),
  } as ItemSizing
}
function pageLayout(value: unknown): PageLayout {
  const data = object(value)
  return {
    ...optionalChoice(data, 'desktop', ['grid', 'flow']),
    ...optionalChoice(data, 'tablet', ['scale', 'flow']),
    ...optionalChoice(data, 'mobile', ['scale', 'flow']),
    ...optionalNumber(data, 'gap', 0, 160),
    ...optionalNumber(data, 'padding', 0, 160),
  } as PageLayout
}
function devices(value: unknown, type: string): WebsiteSection['devices'] {
  const data = object(value),
    result: NonNullable<WebsiteSection['devices']> = {}
  if (Object.keys(data).some((key) => !['mobile', 'tablet'].includes(key)))
    invalid('Use mobile or tablet overrides.')
  for (const device of ['mobile', 'tablet'] as const) {
    if (data[device] === undefined) continue
    const entry = object(data[device])
    if (entry.container !== undefined && type !== 'container')
      invalid('Only containers have a child layout.')
    result[device] = {
      ...(entry.hidden === undefined ? {} : { hidden: bool(entry.hidden) }),
      ...(entry.appearance === undefined ? {} : { appearance: appearance(entry.appearance) }),
      ...(entry.container === undefined ? {} : { container: containerSettings(entry.container) }),
      ...(entry.sizing === undefined ? {} : { sizing: itemSizing(entry.sizing) }),
    }
  }
  return result
}
function pageCss(value: unknown) {
  if (typeof value !== 'string') invalid('Page CSS must be text.')
  try {
    compilePageCss(value as string, 'validated-page')
  } catch (error) {
    invalid(error instanceof Error ? error.message : 'Invalid page CSS.')
  }
  return value as string
}
function parseBlockOptions(value: unknown): BlockOptions {
  try {
    return validateBlockOptions(value)
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Invalid widget settings.')
  }
}
function validateSections(value: unknown, inDefinition = false): WebsiteSection[] {
  const sections = list(value, 30).map((value): WebsiteSection => {
    const section = object(value)
    if (
      inDefinition &&
      (['custom', 'form'].includes(String(section.type)) || section.custom !== undefined)
    )
      invalid(
        'Custom widgets cannot contain other custom widgets. Use built-in widgets in the source.',
      )
    if (!sectionTypes.includes(section.type as SectionType)) invalid('Unknown section type.')
    const items = list(section.items, 12).map(item)
    unique(items.map((item) => item.id))
    if (section.span !== undefined && ![4, 6, 8, 12].includes(section.span as number))
      invalid('Choose a supported widget width.')
    if (
      section.styleClass !== undefined &&
      section.styleClass !== '' &&
      (typeof section.styleClass !== 'string' ||
        !/^custom-[a-z][a-z0-9-]{0,32}$/.test(section.styleClass))
    )
      invalid('CSS classes start with custom- and use lowercase letters, numbers and hyphens.')
    return {
      ...item(section),
      ...(section.blockOptions === undefined
        ? {}
        : { blockOptions: parseBlockOptions(section.blockOptions) }),
      ...(section.formId === undefined ? {} : { formId: id(section.formId) }),
      ...(section.custom === undefined ? {} : { custom: validateCustomPlacement(section.custom) }),
      ...(section.locked === undefined ? {} : { locked: bool(section.locked) }),
      ...(section.navigation === undefined ? {} : { navigation: navigation(section.navigation) }),
      ...(section.styleClass ? { styleClass: section.styleClass as string } : {}),
      ...(section.sizing === undefined ? {} : { sizing: itemSizing(section.sizing) }),
      ...(section.devices === undefined
        ? {}
        : { devices: devices(section.devices, section.type as string) }),
      ...(section.parentId === undefined || section.parentId === ''
        ? {}
        : { parentId: id(section.parentId) }),
      ...(section.appearance === undefined ? {} : { appearance: appearance(section.appearance) }),
      ...(section.container === undefined
        ? {}
        : { container: containerSettings(section.container) }),
      ...(section.layout === undefined ? {} : { layout: widgetLayout(section.layout) }),
      type: section.type as SectionType,
      hidden: bool(section.hidden),
      items,
      ...(section.span === undefined ? {} : { span: section.span as 4 | 6 | 8 | 12 }),
    }
  })
  unique(sections.map((section) => section.id))
  for (const section of sections) {
    if ((section.type === 'form') !== Boolean(section.formId))
      invalid('Choose a form from the form library.')
    if ((section.type === 'custom') !== Boolean(section.custom))
      invalid('Choose a custom widget from the library.')
    if (section.navigation && !['navigation', 'footer'].includes(section.type))
      invalid('Only navigation and footer widgets have menus.')
    if (section.container && section.type !== 'container')
      invalid('Only containers have a child layout.')
    const seen = new Set([section.id])
    let parentId = section.parentId
    while (parentId) {
      const parent = sections.find((entry) => entry.id === parentId)
      if (!parent || parent.type !== 'container' || seen.has(parentId))
        invalid('Invalid container hierarchy.')
      seen.add(parentId)
      parentId = parent.parentId
    }
  }
  return sections
}
function validateCustomDefinition(value: unknown): CustomWidgetDefinition {
  const data = object(value)
  if (data.kind !== 'visual' && data.kind !== 'code') invalid('Choose a visual or HTML/CSS widget.')
  const sections = validateSections(data.sections, true)
  if (sections.some((section) => section.type === 'page-content'))
    invalid('The page-content slot belongs only in the site layout.')
  if (data.kind === 'visual' && (!sections.length || sections.some((section) => !section.layout)))
    invalid('Visual widgets need content and saved geometry.')
  if (data.kind === 'code' && sections.length)
    invalid('Code widgets cannot contain visual sections.')
  const html = text(data.html, 20000, 'Widget HTML'),
    css = text(data.css, 12000, 'Widget CSS')
  if (data.kind === 'code') {
    try {
      validateCustomCode(html, css)
    } catch (error) {
      invalid(error instanceof Error ? error.message : 'Invalid widget code.')
    }
  } else if (html || css) invalid('Use HTML/CSS only in code widgets.')
  const fields = list(data.fields, 20).map((value) => {
    const entry = object(value)
    const key = text(entry.key, 40, 'Setting key', true)
    if (!/^[a-z][a-z0-9_]*$/.test(key))
      invalid('Setting keys use lowercase letters, numbers and underscores.')
    if (!['text', 'color', 'image'].includes(entry.type as string))
      invalid('Unsupported widget setting.')
    const field = {
      key,
      label: text(entry.label, 80, 'Setting label', true),
      type: entry.type as 'text' | 'color' | 'image',
      defaultValue: text(entry.defaultValue, 8000, 'Setting default'),
      ...(entry.sectionId === undefined
        ? {}
        : {
            sectionId: id(entry.sectionId),
            property: entry.property as import('./websiteCustom').CustomWidgetField['property'],
          }),
    }
    if (data.kind === 'visual') {
      if (!sections.some((section) => section.id === field.sectionId))
        invalid('Choose a widget for each setting.')
      const properties =
        field.type === 'color'
          ? ['background', 'color']
          : field.type === 'image'
            ? ['imageId']
            : ['title', 'text', 'alt', 'linkLabel', 'linkUrl']
      if (!properties.includes(field.property || '')) invalid('Choose a matching setting property.')
    } else if (field.type === 'image' || field.sectionId || field.property)
      invalid('Code widgets support text and color settings.')
    validateCustomValue(field, field.defaultValue)
    return field
  })
  const bindingError = customBindingError({
    id: '',
    name: '',
    kind: data.kind,
    sections,
    html,
    css,
    fields,
  })
  if (bindingError) invalid(bindingError)
  unique(fields.map((field) => field.key))
  unique(
    fields
      .filter((field) => field.sectionId)
      .map((field) => field.sectionId + '-' + field.property),
  )
  return {
    id: id(data.id),
    name: text(data.name, 80, 'Custom widget name', true),
    kind: data.kind,
    sections,
    html,
    css,
    fields,
  }
}
function validateCustomValue(field: import('./websiteCustom').CustomWidgetField, value: string) {
  const max =
    field.property === 'title'
      ? 160
      : field.property === 'alt'
        ? 300
        : field.property === 'linkLabel'
          ? 80
          : field.property === 'linkUrl'
            ? 1000
            : 8000
  text(value, max, 'Widget setting')
  if (field.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(value))
    invalid('Use a six-digit hex color for color settings.')
  if (field.type === 'image' && value) id(value)
  if (field.property === 'linkUrl') link(value)
}
function validateCustomPlacement(value: unknown): CustomWidgetPlacement {
  const data = object(value)
  if (Boolean(data.definitionId) === Boolean(data.inline))
    invalid('Choose either a linked widget or an independent copy.')
  const rawValues = object(data.values)
  if (Object.keys(rawValues).length > 20) invalid('Use no more than 20 widget settings.')
  const values = Object.fromEntries(
    Object.entries(rawValues).map(([key, value]) => {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) invalid('Invalid widget setting key.')
      return [key, text(value, 8000, 'Widget setting')]
    }),
  )
  return {
    values,
    ...(data.definitionId
      ? { definitionId: id(data.definitionId) }
      : { inline: validateCustomDefinition(data.inline) }),
  }
}
function parsePage(value: unknown, shared = false): WebsitePage {
  const page = object(value)
  if (page.chrome !== undefined && page.chrome !== 'widgets') invalid('Invalid page structure.')
  const slug = text(page.slug, 64, 'Page URL', true)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    invalid('Page URLs use lowercase letters, numbers and hyphens.')
  const sections = validateSections(page.sections)
  const slots = sections.filter((section) => section.type === 'page-content')
  if (shared ? slots.length !== 1 || !!slots[0]?.parentId || slots[0]?.hidden : slots.length > 0)
    invalid(
      'Keep exactly one visible root page-content slot in the site layout, and none on individual pages.',
    )
  if (
    shared &&
    slots[0]?.devices &&
    Object.values(slots[0].devices).some((device) => device.hidden)
  )
    invalid('The page-content slot must remain visible on every device.')
  if (page.useSiteLayout !== undefined && typeof page.useSiteLayout !== 'boolean')
    invalid('Invalid site layout selection.')
  if (shared && page.useSiteLayout) invalid('A site layout cannot contain another site layout.')
  if (page.html !== undefined) {
    try {
      parseWebsiteHtml(
        text(page.html, 20000, 'Page HTML'),
        sections
          .filter((section) => !section.parentId && section.type !== 'page-content')
          .map((section) => section.id),
        shared,
      )
    } catch (error) {
      invalid(error instanceof Error ? error.message : 'Invalid HTML.')
    }
  }
  return {
    id: id(page.id),
    ...(page.chrome === undefined ? {} : { chrome: 'widgets' as const }),
    ...(page.css === undefined ? {} : { css: pageCss(page.css) }),
    ...(page.html === undefined ? {} : { html: text(page.html, 20000, 'Page HTML') }),
    ...(page.js === undefined ? {} : { js: parseScript(page.js) }),
    ...(page.useSiteLayout === undefined ? {} : { useSiteLayout: bool(page.useSiteLayout) }),
    ...(page.layout === undefined ? {} : { layout: pageLayout(page.layout) }),
    ...(page.grid === undefined ? {} : { grid: pageGrid(page.grid) }),
    title: text(page.title, 100, 'Page title', true),
    slug,
    description: text(page.description, 300, 'Page description'),
    inNavigation: bool(page.inNavigation),
    sections,
  }
}
function parseScript(value: unknown) {
  try {
    const source = validateJavascript(value)
    new Script(source, { filename: 'website.js' }) // Parse only; never run authored code on the server.
    return source
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Invalid JavaScript.')
  }
}
export function validateWebsite(value: unknown): WebsiteSite {
  if (Buffer.byteLength(JSON.stringify(value) || '') > 500000)
    invalid('The website draft exceeds 500 KB. Reduce its text or sections.')
  const data = object(value)
  const accent = text(data.accent, 7, 'Accent color')
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) invalid('Choose a six-digit hex color.')
  const pages = list(data.pages, 30).map((value) => parsePage(value))
  const sharedLayout =
    data.sharedLayout === undefined ? undefined : parsePage(data.sharedLayout, true)
  if (!sharedLayout && pages.some((page) => page.useSiteLayout))
    invalid('Create a shared site layout before assigning it to a page.')
  if (sharedLayout && pages.some((page) => page.id === sharedLayout.id))
    invalid('The site layout needs its own ID.')
  unique(pages.map((page) => page.id))
  unique(pages.map((page) => page.slug))
  if (!pages.some((page) => page.slug === 'home')) invalid('Keep one page with the URL home.')
  const rawBranding =
    data.branding === undefined
      ? { logoId: '', logoAlt: '', footerText: '', footerLinks: [] }
      : object(data.branding)
  const footerLinks = list(rawBranding.footerLinks, 8).map((value) => {
    const entry = object(value)
    return {
      id: id(entry.id),
      label: text(entry.label, 80, 'Footer link label'),
      url: link(entry.url),
    }
  })
  unique(footerLinks.map((entry) => entry.id))
  const branding: WebsiteBranding = {
    logoId: rawBranding.logoId === '' ? '' : id(rawBranding.logoId),
    logoAlt: text(rawBranding.logoAlt, 300, 'Logo description'),
    footerText: text(rawBranding.footerText, 2000, 'Footer text'),
    footerLinks,
  }
  const savedSections =
    data.savedSections === undefined
      ? undefined
      : list(data.savedSections, 20).map((value) => {
          const entry = object(value)
          const sections = validateSections(entry.sections)
          if (!sections.length) invalid('A saved section needs at least one widget.')
          if (sections.some((section) => section.type === 'page-content'))
            invalid('The page-content slot cannot be saved as a reusable section.')
          return {
            id: id(entry.id),
            name: text(entry.name, 80, 'Saved section name', true),
            sections,
          }
        })
  if (savedSections) unique(savedSections.map((entry) => entry.id))
  let forms: WebsiteFormDefinition[] | undefined
  if (data.forms !== undefined) {
    try {
      forms = list(data.forms, 20).map(validateForm)
    } catch (reason) {
      invalid(reason instanceof Error ? reason.message : 'Invalid website forms.')
    }
    unique(forms.map((form) => form.id))
  }
  for (const section of [
    ...pages,
    ...(sharedLayout ? [sharedLayout] : []),
    ...(savedSections || []),
  ].flatMap((page) => page.sections))
    if (section.formId && !forms?.some((form) => form.id === section.formId))
      invalid('Restore the missing form or remove its widget.')
  const customWidgets =
    data.customWidgets === undefined
      ? undefined
      : list(data.customWidgets, 20).map(validateCustomDefinition)
  if (customWidgets) unique(customWidgets.map((entry) => entry.id))
  for (const section of [
    ...pages,
    ...(sharedLayout ? [sharedLayout] : []),
    ...(savedSections || []),
  ].flatMap((page) => page.sections)) {
    if (!section.custom) continue
    const definition = customDefinition(section.custom, customWidgets)
    if (!definition)
      invalid('A linked custom widget is missing. Restore it or detach the placement.')
    for (const [key, value] of Object.entries(section.custom.values)) {
      const field = definition.fields.find((field) => field.key === key)
      if (!field) invalid('A custom widget setting no longer exists.')
      validateCustomValue(field, value)
    }
  }
  return {
    ...(data.theme === undefined ? {} : { theme: parseTheme(data.theme) }),
    ...(data.css === undefined ? {} : { css: pageCss(data.css) }),
    ...(data.js === undefined ? {} : { js: parseScript(data.js) }),
    ...(sharedLayout ? { sharedLayout } : {}),
    name: text(data.name, 100, 'Website name', true),
    accent,
    pages,
    branding,
    ...(savedSections === undefined ? {} : { savedSections }),
    ...(customWidgets === undefined ? {} : { customWidgets }),
    ...(forms === undefined ? {} : { forms }),
  }
}
export function websiteAssetIds(site: WebsiteSite): string[] {
  const images = [
    ...site.pages,
    ...(site.sharedLayout ? [site.sharedLayout] : []),
    ...(site.savedSections || []),
  ].flatMap((page) =>
    page.sections.flatMap((section) => [
      section.imageId,
      ...section.items.map((item) => item.imageId),
    ]),
  )
  const customImages = [
    ...(site.customWidgets || []),
    ...[
      ...site.pages,
      ...(site.sharedLayout ? [site.sharedLayout] : []),
      ...(site.savedSections || []),
    ].flatMap((page) =>
      page.sections.flatMap((section) => {
        const definition = customDefinition(section.custom, site.customWidgets)
        return definition ? [resolvedCustom(definition, section.custom!.values)] : []
      }),
    ),
  ].flatMap((definition) => [
    ...definition.sections.flatMap((section) => [
      section.imageId,
      ...section.items.map((item) => item.imageId),
    ]),
    ...definition.fields
      .filter((field) => field.type === 'image')
      .map((field) => field.defaultValue),
  ])
  return [...new Set([site.branding?.logoId || '', ...images, ...customImages])].filter(Boolean)
}
export function publishedWebsite(site: WebsiteSite): WebsiteSite {
  const {
    savedSections: _savedSections,
    customWidgets: _customWidgets,
    sharedLayout: _sharedLayout,
    ...publicSite
  } = site
  const usedLayout = site.pages.some((page) => page.useSiteLayout) ? site.sharedLayout : undefined
  const result: WebsiteSite = {
    ...publicSite,
    pages: [...site.pages, ...(usedLayout ? [usedLayout] : [])].map((page) => ({
      ...page,
      sections: page.sections
        .filter((section) => {
          let current: WebsiteSection | undefined = section
          const visited = new Set<string>()
          while (current) {
            if (current.hidden || visited.has(current.id)) return false
            visited.add(current.id)
            current = page.sections.find((entry) => entry.id === current?.parentId)
          }
          return true
        })
        .map((section) => {
          if (!section.custom) return section
          const definition = customDefinition(section.custom, site.customWidgets)!
          const resolved = resolvedCustom(definition, section.custom.values)
          resolved.sections = visibleCustomSections(resolved.sections)
          if (resolved.kind === 'code') Object.assign(resolved, customMarkup(resolved))
          resolved.fields = []
          return { ...section, custom: { inline: resolved, values: {} } }
        }),
    })),
  }
  for (const page of result.pages) {
    if (page.html)
      page.html = page.html.replace(
        /<website-widget\s+id="([a-zA-Z0-9_-]+)"\s*><\/website-widget\s*>/g,
        (source, id) => (page.sections.some((section) => section.id === id) ? source : ''),
      )
  }
  if (site.forms) {
    const used = new Set(
      result.pages.flatMap((page) =>
        page.sections.map((section) => section.formId).filter(Boolean),
      ),
    )
    result.forms = site.forms
      .filter((form) => used.has(form.id))
      .map((form) => {
        if (!form.delivery?.to.length)
          invalid('Set at least one To recipient for ' + form.name + ' before publishing.')
        return publicForm(form)
      })
  }
  const urls = new Set(['/website', '/login', ...site.pages.map((page) => `/website/${page.slug}`)])
  if (site.branding?.logoId && !site.branding.logoAlt)
    invalid('Add a description for the website logo.')
  for (const entry of site.pages.some((page) => page.chrome !== 'widgets')
    ? site.branding?.footerLinks || []
    : []) {
    if (!entry.label || !entry.url)
      invalid('Complete or remove each footer link before publishing.')
    if (entry.url.startsWith('/') && !urls.has(entry.url))
      invalid('A footer link points to a page that does not exist.')
  }
  for (const page of result.pages) {
    if (!page.sections.length) invalid(`Add a visible section to ${page.title} before publishing.`)
    const contentSections = page.sections.flatMap((section) =>
      section.custom?.inline?.kind === 'visual' ? section.custom.inline.sections : [section],
    )
    for (const section of page.sections) {
      const definition = section.custom?.inline
      if (definition?.kind === 'visual' && !definition.sections.length)
        invalid('Add visible content to each custom widget.')
      if (
        definition?.kind === 'code' &&
        customCodeLinks(definition.html).some((url) => url.startsWith('/') && !urls.has(url))
      )
        invalid('A custom HTML link points to a page that does not exist.')
      if (definition?.kind === 'code' && !definition.html.trim())
        invalid('Add HTML to each code widget.')
    }
    for (const section of contentSections) {
      const errors = [...interactiveWidgetErrors(section), ...blockErrors(section)]
      if (errors.length) invalid(`${section.title}: ${errors.join(' ')}`)
    }
    for (const entry of contentSections.flatMap((section) => [section, ...section.items])) {
      if (entry.imageId && !entry.alt) invalid(`Add an image description on ${page.title}.`)
      if (Boolean(entry.linkUrl) !== Boolean(entry.linkLabel))
        invalid(`Add both a button label and link on ${page.title}.`)
      if (entry.linkUrl.startsWith('/') && !urls.has(entry.linkUrl))
        invalid(`A link on ${page.title} points to a page that does not exist.`)
      if (
        [
          ...(entry.textFormat === 'markdown' ? textLinks(entry.text) : []),
          ...richTextLinks(entry.textRichText),
          ...richTextLinks(entry.titleRichText),
        ].some((url) => url.startsWith('/') && !urls.has(url))
      )
        invalid(`A text link on ${page.title} points to a page that does not exist.`)
    }
    for (const section of contentSections) {
      if (
        section.navigation?.showLogin &&
        section.navigation.loginLabel &&
        !section.navigation.loginLabel.label.trim()
      )
        invalid(`Complete the login label on ${page.title}.`)
      if (
        section.navigation?.showPages &&
        section.navigation.pageLabels?.some(
          (label) =>
            result.pages.some((page) => page.id === label.id && page.inNavigation) &&
            !label.label.trim(),
        )
      )
        invalid(`Complete each page link label on ${page.title}.`)
      if (
        richTextLinks(section.navigation?.brandRichText).some(
          (url) => url.startsWith('/') && !urls.has(url),
        )
      )
        invalid(`A brand link on ${page.title} points to a page that does not exist.`)
      for (const entry of menuLinks(section.navigation?.links || [])) {
        if (!entry.label || (!entry.url && !entry.children?.length))
          invalid(`Complete each menu link on ${page.title}.`)
        if (entry.url.startsWith('/') && !urls.has(entry.url))
          invalid(`A menu link on ${page.title} points to a page that does not exist.`)
      }
    }
  }
  if (usedLayout) result.sharedLayout = result.pages.pop()!
  if (Buffer.byteLength(JSON.stringify(result)) > 900000)
    invalid('The expanded website is too large to publish. Reduce repeated custom content.')
  return result
}
export function initialWebsite(): WebsiteSite {
  return {
    name: 'Phase 2',
    accent: '#174878',
    pages: [
      {
        id: 'home',
        title: 'Home',
        slug: 'home',
        description: '',
        inNavigation: true,
        chrome: 'widgets',
        layout: { mobile: 'flow', tablet: 'flow' },
        sections: [],
      },
    ],
  }
}
