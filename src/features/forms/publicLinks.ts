import type { ServerFormTemplate } from '@/services/forms'
export type { ServerFormTemplate } from '@/services/forms'

export function configuredFormSiteUrl(siteUrl?: string, projectId?: string): string | undefined {
  const configured = siteUrl?.trim() ||
    (/^[a-z][a-z0-9-]{4,62}$/.test(projectId || '') ? `https://${projectId}.web.app` : '')
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
      url.hostname === '[::1]' || /^127\./.test(url.hostname)) return
    return url.href.replace(/\/$/, '')
  } catch { return }
}

export function publishedFormLink(template: ServerFormTemplate, siteUrl?: string) {
  if (template.archived) return { state: 'Archived — form unavailable.' }
  if (!template.latestVersion) return { state: 'Unpublished draft — no respondent link.' }
  if (template.definition?.access?.respondents !== 'public')
    return { state: 'Private form — respondents must sign in.' }
  if (!siteUrl) return { state: 'Public form — configure the published site URL to share.' }
  return {
    state: `Public form — published version ${template.latestVersion}.`,
    url: `${siteUrl}/forms/${encodeURIComponent(template.id)}`,
  }
}
