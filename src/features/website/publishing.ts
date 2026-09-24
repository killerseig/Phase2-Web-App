import { parseWebsiteHtml } from '../../../functions/src/websiteLayout'
import { richTextLinks } from '../../../functions/src/websiteRichText'
import { compilePageCss } from '../../../functions/src/websiteDesign'
import { validateTheme, themeWarnings } from '../../../functions/src/websiteTheme'
import { blockErrors } from '../../../functions/src/websiteBlocks'
import { validateForm } from '../../../functions/src/websiteForms'
import { interactiveWidgetErrors } from '../../../functions/src/websiteInteractive'
import {
  customCodeLinks,
  customDefinition,
  resolvedCustom,
  visibleCustomSections,
  validateCustomCode,
} from '../../../functions/src/websiteCustom'
import { menuLinks, safeWebsiteLink, textLinks } from '../../../functions/src/websiteContent'
import { visibleSections } from './containers'
import type { WebsiteSite, WebsiteSection } from './types'
export interface PublishingIssue {
  pageId: string
  sectionId?: string
  target?: 'site' | 'site-code' | 'code' | 'widgets'
  message: string
  level: 'error' | 'warning'
}
export function publishingChecks(site: WebsiteSite) {
  const issues: PublishingIssue[] = []
  try {
    compilePageCss(site.css || '', 'validate')
  } catch (error) {
    issues.push({
      pageId: site.pages[0]?.id || '',
      target: 'site-code',
      level: 'error',
      message: error instanceof Error ? error.message : 'Check site CSS.',
    })
  }
  if (site.theme) {
    try {
      validateTheme(site.theme)
      for (const message of themeWarnings(site.theme, site.accent))
        issues.push({ pageId: site.pages[0]?.id || '', target: 'site', level: 'warning', message })
    } catch (error) {
      issues.push({
        pageId: site.pages[0]?.id || '',
        target: 'site',
        level: 'error',
        message: error instanceof Error ? error.message : 'Check website design.',
      })
    }
  }
  const urls = new Set(['/website', '/login', ...site.pages.map((page) => `/website/${page.slug}`)])
  function link(
    url: string,
    pageId: string,
    label: string,
    sectionId?: string,
    target?: PublishingIssue['target'],
  ) {
    if (url && (!safeWebsiteLink(url) || (url.startsWith('/') && !urls.has(url))))
      issues.push({
        pageId,
        sectionId,
        target,
        level: 'error',
        message: `${label}: link does not lead to a valid website page or supported address.`,
      })
  }
  if (site.branding?.logoId && !site.branding.logoAlt)
    issues.push({
      pageId: site.pages[0]?.id || '',
      level: 'error',
      message: 'Add an image description for the website logo.',
      target: 'site',
    })
  for (const footer of site.pages.some((page) => page.chrome !== 'widgets')
    ? site.branding?.footerLinks || []
    : []) {
    if (!footer.label || !footer.url)
      issues.push({
        pageId: site.pages[0]?.id || '',
        level: 'error',
        message: 'Complete or remove each website footer link.',
        target: 'site',
      })
    link(footer.url, site.pages[0]?.id || '', 'Website footer', undefined, 'site')
  }
  for (const page of [
    ...site.pages,
    ...(site.sharedLayout && site.pages.some((page) => page.useSiteLayout)
      ? [site.sharedLayout]
      : []),
  ]) {
    try {
      compilePageCss(page.css || '', 'validate')
      if (page.html !== undefined)
        parseWebsiteHtml(
          page.html,
          page.sections
            .filter((section) => !section.parentId && section.type !== 'page-content')
            .map((section) => section.id),
          page === site.sharedLayout,
        )
      const slots = page.sections.filter((section) => section.type === 'page-content')
      if (
        page === site.sharedLayout &&
        (slots.length !== 1 || slots[0]?.hidden || slots[0]?.parentId)
      )
        throw new Error('Keep one visible root page-content slot in the site layout.')
    } catch (error) {
      issues.push({
        pageId: page.id,
        level: 'error',
        message: error instanceof Error ? error.message : 'Check page code.',
        target: 'code',
      })
    }
    const origins = new Map<WebsiteSection, string>()
    const ownerId = (section: WebsiteSection) => origins.get(section) || section.id
    const sections = visibleSections(page.sections).flatMap((section) => {
      if (section.formId) {
        const form = site.forms?.find((form) => form.id === section.formId)
        if (!form)
          issues.push({
            pageId: page.id,
            level: 'error',
            message: page.title + ': form is missing.',
            sectionId: section.id,
          })
        else {
          try {
            validateForm(form)
          } catch (reason) {
            issues.push({
              pageId: page.id,
              level: 'error',
              message: reason instanceof Error ? reason.message : 'Check form settings.',
              sectionId: section.id,
            })
          }
          if (!form.delivery?.to.length)
            issues.push({
              pageId: page.id,
              level: 'error',
              message: 'Set To recipients for ' + form.name + '.',
              sectionId: section.id,
            })
        }
      }
      if (!section.custom) return [section]
      const definition = customDefinition(section.custom, site.customWidgets)
      if (!definition) {
        issues.push({
          pageId: page.id,
          level: 'error',
          message: page.title + ': custom widget design is missing.',
          sectionId: section.id,
          target: 'widgets',
        })
        return []
      }
      if (definition.kind === 'code') {
        for (const url of customCodeLinks(definition.html))
          link(url, page.id, page.title, section.id, 'widgets')
        try {
          validateCustomCode(definition.html, definition.css)
        } catch {
          issues.push({
            pageId: page.id,
            level: 'error',
            message: page.title + ': fix the custom widget code.',
            sectionId: section.id,
            target: 'widgets',
          })
        }
        if (!definition.html.trim())
          issues.push({
            pageId: page.id,
            level: 'error',
            message: page.title + ': add HTML to the code widget.',
            sectionId: section.id,
            target: 'widgets',
          })
        return [section]
      }
      const content = visibleCustomSections(
        resolvedCustom(definition, section.custom.values).sections,
      )
      if (!content.length)
        issues.push({
          pageId: page.id,
          level: 'error',
          message: page.title + ': add visible content to the custom widget.',
          sectionId: section.id,
          target: 'widgets',
        })
      for (const entry of content) origins.set(entry as WebsiteSection, section.id)
      return content
    })
    if (!sections.length)
      issues.push({
        pageId: page.id,
        level: 'error',
        message: `${page.title}: add a visible widget.`,
      })
    if (page !== site.sharedLayout && !page.description)
      issues.push({
        pageId: page.id,
        level: 'warning',
        message: `${page.title}: add a page description.`,
      })
    if (!sections.some((section) => !['navigation', 'footer', 'container'].includes(section.type)))
      issues.push({
        pageId: page.id,
        level: 'warning',
        message: `${page.title}: review this page's main content.`,
      })
    for (const section of sections)
      for (const message of [...interactiveWidgetErrors(section), ...blockErrors(section)])
        issues.push({
          pageId: page.id,
          sectionId: ownerId(section),
          target: origins.has(section) ? 'widgets' : undefined,
          level: 'error',
          message: `${section.title}: ${message}`,
        })
    for (const { entry, section } of sections.flatMap((section) =>
      [section, ...section.items].map((entry) => ({ entry, section })),
    )) {
      const sectionId = ownerId(section)
      const target = origins.has(section) ? 'widgets' : undefined
      if (entry.imageId && !entry.alt)
        issues.push({
          pageId: page.id,
          level: 'error',
          message: `${page.title}: add an image description for ${entry.title || 'an image'}.`,
          sectionId,
          target,
        })
      if (Boolean(entry.linkUrl) !== Boolean(entry.linkLabel))
        issues.push({
          pageId: page.id,
          level: 'error',
          message: `${page.title}: complete both the button label and link.`,
          sectionId,
          target,
        })
      link(entry.linkUrl, page.id, page.title, sectionId, target)
      if (entry.textFormat === 'markdown')
        for (const url of textLinks(entry.text)) link(url, page.id, page.title, sectionId, target)
      for (const url of [
        ...richTextLinks(entry.textRichText),
        ...richTextLinks(entry.titleRichText),
      ])
        link(url, page.id, page.title, sectionId, target)
    }
    for (const section of sections) {
      if (
        (section.navigation?.showLogin &&
          section.navigation.loginLabel &&
          !section.navigation.loginLabel.label.trim()) ||
        (section.navigation?.showPages &&
          section.navigation.pageLabels?.some(
            (label) =>
              site.pages.some((page) => page.id === label.id && page.inNavigation) &&
              !label.label.trim(),
          ))
      )
        issues.push({
          pageId: page.id,
          sectionId: ownerId(section),
          level: 'error',
          message: `${page.title}: complete each menu label.`,
        })
      for (const url of richTextLinks(section.navigation?.brandRichText))
        link(
          url,
          page.id,
          'Brand name',
          ownerId(section),
          origins.has(section) ? 'widgets' : undefined,
        )
      for (const entry of menuLinks(section.navigation?.links || [])) {
        if (!entry.label || (!entry.url && !entry.children?.length))
          issues.push({
            pageId: page.id,
            level: 'error',
            message: `${page.title}: complete each menu link.`,
            sectionId: ownerId(section),
            target: origins.has(section) ? 'widgets' : undefined,
          })
        link(
          entry.url,
          page.id,
          page.title,
          ownerId(section),
          origins.has(section) ? 'widgets' : undefined,
        )
      }
    }
  }
  return issues
}
