import type { WebsiteTheme } from '../../../functions/src/websiteTheme'
import type { TextBoxes } from '../../../functions/src/websiteTextBox'
import type { RichTextNode } from '../../../functions/src/websiteRichText'
import type { BlockOptions, BlockItemData } from '../../../functions/src/websiteBlocks'
import type { WebsiteFormDefinition } from '../../../functions/src/websiteForms'
import type {
  CustomWidgetDefinition,
  CustomWidgetPlacement,
} from '../../../functions/src/websiteCustom'
import { convertPageChrome } from './chrome'
import type { ImageSettings, NavigationSettings } from '../../../functions/src/websiteContent'
import { materializeGrid, defaultGrid, type GridSettings, type WidgetGeometry } from './grid'
import type { ContainerLayout, ItemSizing, PageLayout } from '../../../functions/src/websiteDesign'
export type {
  WebsiteDevice,
  ContainerLayout,
  ItemSizing,
  PageLayout,
} from '../../../functions/src/websiteDesign'
export type SectionType =
  | 'page-content'
  | 'hero'
  | 'text'
  | 'image-text'
  | 'gallery'
  | 'cards'
  | 'contact'
  | 'container'
  | 'image'
  | 'navigation'
  | 'footer'
  | 'custom'
  | 'form'
  | 'accordion'
  | 'tabs'
  | 'video'
  | 'downloads'
  | 'button'
  | 'icon'
  | 'divider'
  | 'spacer'
  | 'list'
  | 'badge'
  | 'alert'
  | 'team'
  | 'testimonials'
  | 'statistics'
  | 'logos'
  | 'chart'
  | 'timeline'
  | 'progress'
  | 'card'
  | 'profile-card'
  | 'metric'
  | 'progress-ring'
  | 'sparkline'
  | 'data-table'
export interface WidgetAppearance {
  motion?: import('../../../functions/src/websiteMotion').WebsiteMotion
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
  fontFamily?: import('../../../functions/src/websiteFonts').WebsiteFont
  textAlign?: 'left' | 'center' | 'right'
  imageFit?: 'cover' | 'contain'
  opacity?: number
  rotation?: number
}
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
        appearance?: WidgetAppearance
        container?: ContainerLayout
        sizing?: ItemSizing
      }
    >
  >
  appearance?: WidgetAppearance
  parentId?: string
  container?: ContainerLayout
  layout?: WidgetGeometry
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
  grid?: GridSettings
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
  savedSections?: SavedWebsiteSection[]
  name: string
  accent: string
  pages: WebsitePage[]
  branding?: WebsiteBranding
}
export interface SavedWebsiteSection {
  id: string
  name: string
  sections: WebsiteSection[]
}
export interface WebsiteBranding {
  logoId: string
  logoAlt: string
  footerText: string
  footerLinks: { id: string; label: string; url: string }[]
}
export interface WebsiteAsset {
  id: string
  name: string
  size: number
  createdAt: number | null
}
export function withWebsiteDefaults(site: WebsiteSite): WebsiteSite {
  return {
    ...site,
    pages: site.pages.map((source) => {
      const page = convertPageChrome(source, site)
      return {
        ...page,
        grid: page.grid || defaultGrid(),
        sections: materializeGrid(page.sections),
      }
    }),
    branding: site.branding || { logoId: '', logoAlt: '', footerText: '', footerLinks: [] },
  }
}
export interface WebsiteState {
  version: number
  draft: WebsiteSite
  publishedAt: number | null
  hasPrevious: boolean
  savedAt: number | null
}
export const sectionLabels: Record<SectionType, string> = {
  'page-content': 'Page content',
  hero: 'Hero banner',
  text: 'Text',
  'image-text': 'Image and text',
  gallery: 'Photo gallery',
  cards: 'Cards',
  contact: 'Contact / call to action',
  container: 'Container',
  image: 'Image',
  navigation: 'Navigation',
  footer: 'Footer',
  custom: 'Custom widget',
  form: 'Form',
  accordion: 'Accordion / FAQ',
  tabs: 'Tabs',
  video: 'Video',
  downloads: 'Document downloads',
  button: 'Button',
  icon: 'Icon',
  divider: 'Divider',
  spacer: 'Spacer',
  list: 'List / checklist',
  badge: 'Badge',
  alert: 'Notice / alert',
  team: 'Team profiles',
  testimonials: 'Testimonials',
  statistics: 'Statistics',
  logos: 'Logo strip',
  chart: 'Chart',
  timeline: 'Timeline',
  progress: 'Progress bars',
  card: 'Card',
  'profile-card': 'Profile card',
  metric: 'Metric tile',
  'progress-ring': 'Progress ring',
  sparkline: 'Sparkline',
  'data-table': 'Data table',
}
export function newItem(): WebsiteItem {
  return {
    id: crypto.randomUUID(),
    title: '',
    text: '',
    imageId: '',
    alt: '',
    linkLabel: '',
    linkUrl: '',
  }
}
export function newSection(type: SectionType): WebsiteSection {
  return {
    ...newItem(),
    type,
    title: sectionLabels[type],
    hidden: false,
    items: [],
    ...(['icon', 'alert'].includes(type) ? { icon: 'info-circle' } : {}),
    ...(type === 'chart' ? { blockOptions: { chartType: 'bar' as const, showData: false } } : {}),
    ...([
      'card',
      'profile-card',
      'metric',
      'progress-ring',
      'sparkline',
      'data-table',
      'chart',
    ].includes(type)
      ? {
          appearance: {
            padding: 12,
            headingSize: 18,
            radius: 10,
            borderWidth: 1,
            borderColor: '#dbe1e7',
          },
        }
      : {}),
    ...(type === 'video' ? { linkLabel: 'Open video' } : {}),
    ...(type === 'navigation' || type === 'footer'
      ? {
          navigation: {
            showBrand: true,
            showPages: type === 'navigation',
            showLogin: false,
            links: [],
          },
        }
      : {}),
  }
}
export function pageUrl(slug: string) {
  return slug === 'home' ? '/website' : `/website/${slug}`
}
