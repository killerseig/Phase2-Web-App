import type { FormRecord } from './formModel'
import type { FormTranslation } from './formTranslation'
import { translatedFormProjection } from './formTranslation'
import { buildFormEmailHtml, buildFormEmailText } from './formEmailRender'

/** Adds an English rendering alongside original submitted results. Original photos/PDF stay intact. */
export function formTranslationEmailContent(record: FormRecord, translation: FormTranslation) {
  if (translation.status === 'disabled') return { html: '', text: '' }
  const notice =
    translation.status === 'failed'
      ? 'English translation failed. Original submitted answers follow; no English rendering is available.'
      : 'English rendering — machine translation; review safety meaning. ' +
        (translation.correction ? 'Human correction recorded. ' : '') +
        'Original submitted answers follow unchanged.'
  if (translation.status !== 'ready')
    return { html: '<p>' + notice + '</p>', text: notice + '\n\n' }
  const projected = translatedFormProjection(record, translation)
  if (projected === record)
    return {
      html: '<p>English rendering is out of date. Original submitted answers follow.</p>',
      text: 'English rendering is out of date. Original submitted answers follow.\n\n',
    }
  const body = buildFormEmailHtml(projected).match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || ''
  return {
    html:
      '<section><h2>English rendering</h2><p>' +
      notice +
      '</p>' +
      body +
      '</section><h2>Original submission</h2>',
    text:
      notice +
      '\n\nEnglish rendering\n' +
      buildFormEmailText(projected) +
      '\n\nOriginal submission\n',
  }
}
