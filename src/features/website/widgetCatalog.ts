import type { SectionType } from './types'
export const widgetCategories = [
  'Basic',
  'Layout',
  'Company',
  'Media',
  'Interactive',
  'Data',
] as const
export function widgetCategory(type: SectionType): (typeof widgetCategories)[number] {
  if (['container', 'divider', 'spacer', 'navigation', 'footer'].includes(type)) return 'Layout'
  if (['team', 'testimonials', 'logos', 'timeline', 'cards', 'card', 'profile-card'].includes(type))
    return 'Company'
  if (['image', 'image-text', 'gallery', 'video', 'downloads'].includes(type)) return 'Media'
  if (['accordion', 'tabs', 'form'].includes(type)) return 'Interactive'
  if (
    [
      'statistics',
      'chart',
      'progress',
      'metric',
      'progress-ring',
      'sparkline',
      'data-table',
    ].includes(type)
  )
    return 'Data'
  return 'Basic'
}

const descriptions: Partial<Record<SectionType, string>> = {
  hero: 'Large heading, introduction and call to action.',
  text: 'Headings, paragraphs and formatted text.',
  'image-text': 'A photo with accompanying text.',
  image: 'One photo or illustration.',
  gallery: 'A collection of photos.',
  cards: 'A collection of cards with links.',
  card: 'One card with text, an image and a link.',
  'profile-card': 'One person, photo and role.',
  contact: 'Contact details with a call to action.',
  container: 'Group widgets into a row or column.',
  navigation: 'Brand, page links and a login button.',
  footer: 'Closing links and company information.',
  form: 'Collect visitor messages and email them.',
  accordion: 'Expandable answers for FAQs.',
  tabs: 'Switch between panels of content.',
  video: 'YouTube, Vimeo or a video file.',
  downloads: 'Links to brochures and documents.',
  button: 'A single link or call to action.',
  icon: 'A symbol with an optional link.',
  divider: 'A line to separate content.',
  spacer: 'Adjustable blank space.',
  list: 'Bullets, numbered items or a checklist.',
  badge: 'A short label or status.',
  alert: 'An announcement or notice.',
  team: 'A collection of staff profiles.',
  testimonials: 'Quotes and customer feedback.',
  statistics: 'A collection of key numbers.',
  logos: 'Partner logos, clients or certifications.',
  chart: 'Bar, line, area or donut graphs.',
  timeline: 'Events, dates and milestones.',
  progress: 'Labeled percentage bars.',
  metric: 'One important number with context.',
  'progress-ring': 'A circular percentage indicator.',
  sparkline: 'A compact trend graph.',
  'data-table': 'Rows of labels, details and values.',
}
const icons: Partial<Record<SectionType, string>> = {
  hero: 'pi-window-maximize',
  text: 'pi-align-left',
  'image-text': 'pi-id-card',
  image: 'pi-image',
  gallery: 'pi-images',
  cards: 'pi-th-large',
  card: 'pi-stop',
  'profile-card': 'pi-user',
  contact: 'pi-phone',
  container: 'pi-objects-column',
  navigation: 'pi-bars',
  footer: 'pi-minus',
  form: 'pi-envelope',
  accordion: 'pi-list',
  tabs: 'pi-folder',
  video: 'pi-video',
  downloads: 'pi-download',
  button: 'pi-external-link',
  icon: 'pi-star',
  divider: 'pi-minus',
  spacer: 'pi-arrows-v',
  list: 'pi-list-check',
  badge: 'pi-tag',
  alert: 'pi-info-circle',
  team: 'pi-users',
  testimonials: 'pi-comments',
  statistics: 'pi-chart-bar',
  logos: 'pi-verified',
  chart: 'pi-chart-line',
  timeline: 'pi-clock',
  progress: 'pi-sliders-h',
  metric: 'pi-hashtag',
  'progress-ring': 'pi-chart-pie',
  sparkline: 'pi-chart-line',
  'data-table': 'pi-table',
}
export function widgetInfo(type: SectionType) {
  return { description: descriptions[type] || '', icon: icons[type] || 'pi-box' }
}
