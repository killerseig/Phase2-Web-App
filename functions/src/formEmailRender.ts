import { renderFormOutputTemplate } from './formOutputTemplate'
import { formAnswerSummary, type FormRecord } from './formModel'
import { EMAIL } from './constants'
export interface FormPhotoPreview {
  fieldId: string
  position: number
  contentId: string
}
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
const multiline = (value: unknown) =>
  escape(value)
    .replace(/\r\n?|\n/g, '<br>')
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
    .replace(/ {2}/g, ' &nbsp;')
function photoTarget(url: string, fieldId: string) {
  if (!url) return ''
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    return ''
  if (parsed.hash.startsWith('#token=')) {
    const params = new URLSearchParams(parsed.hash.slice(1))
    params.set('field', fieldId)
    parsed.hash = params.toString()
  } else parsed.hash = 'label-' + fieldId
  return parsed.toString()
}
function photoIds(record: FormRecord, fieldId: string): string[] {
  const value = record.answers[fieldId]
  return Array.isArray(value) ? value : []
}

export function buildFormEmailHtml(
  record: FormRecord,
  previews: FormPhotoPreview[] = [],
  url = '',
): string {
  let previousSection = ''
  const rendered = new Map<string, string>()
  const fields = record.definition.fields
    .map((field) => {
      const section =
        field.section && field.section !== previousSection
          ? '<h2>' + escape(field.section) + '</h2>'
          : ''
      previousSection = field.section || ''
      const hint = field.hint ? '<p style="color:#555">' + multiline(field.hint) + '</p>' : ''
      let answer = multiline(formAnswerSummary(field, record.answers[field.id]))
      if (field.kind === 'photo') {
        const ids = photoIds(record, field.id),
          target = photoTarget(url, field.id)
        answer = ids.length ? ids.length + (ids.length === 1 ? ' photo' : ' photos') : 'N/A'
        const cells = ids.slice(0, EMAIL.DAILY_LOG_PHOTO_PREVIEW_LIMIT).map((_, index) => {
          const preview = previews.find(
            (item) => item.fieldId === field.id && item.position === index + 1,
          )
          const cid =
            preview && /^[A-Za-z0-9._@-]{1,128}$/.test(preview.contentId) ? preview.contentId : ''
          const image = cid
            ? '<img src="cid:' +
              escape(cid) +
              '" width="240" alt="' +
              escape(field.label + ' ' + (index + 1)) +
              '" style="display:block;width:100%;max-width:240px;height:auto;max-height:240px;border:0;border-radius:6px;object-fit:contain" />'
            : '<span>Open photo in authenticated record</span>'
          const linked = target ? '<a href="' + escape(target) + '">' + image + '</a>' : image
          return '<td width="50%" valign="top" style="padding:0 8px 14px 0">' + linked + '</td>'
        })
        if (cells.length)
          answer +=
            '<table role="presentation" width="496" style="width:496px;max-width:100%;table-layout:fixed"><tr>' +
            cells.join('') +
            '</tr></table>'
        if (ids.length && target)
          answer +=
            '<a href="' +
            escape(target) +
            '">View all ' +
            ids.length +
            ' photos</a><p>' +
            'Sign in as the record owner or Admin to view the submission and photos.' +
            '</p>'
      }
      const html =
        section +
        '<div style="margin:0 0 14px;overflow-wrap:anywhere"><h3>' +
        escape(field.label) +
        '</h3>' +
        hint +
        (field.kind === 'photo'
          ? '<div style="line-height:1.45">' + answer + '</div>'
          : '<p style="line-height:1.45">' + answer + '</p>') +
        '</div>'
      rendered.set(field.id, html)
      return html
    })
    .join('')
  return (
    '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#333"><div style="max-width:640px;margin:auto;padding:20px"><h1>' +
    escape(record.definition.title) +
    '</h1>' +
    (record.definition.description
      ? '<p>' + multiline(record.definition.description) + '</p>'
      : '') +
    '<p>Submitted form · Version ' +
    record.templateVersion +
    '</p>' +
    (record.definition.output?.template
      ? '<div style="overflow-wrap:anywhere;line-height:1.45">' +
        renderFormOutputTemplate(record.definition, multiline, (id) => {
          const field = record.definition.fields.find((item) => item.id === id)!
          if (field.kind === 'photo') return rendered.get(field.id)!
          return multiline(formAnswerSummary(field, record.answers[id]))
        }) +
        '</div>'
      : fields) +
    '</div></body></html>'
  )
}

export function buildFormEmailText(record: FormRecord, url = ''): string {
  let previousSection = ''
  return [
    record.definition.title,
    record.definition.description,
    'Submitted form · Version ' + record.templateVersion,
    ...(record.definition.output?.template
      ? [
          renderFormOutputTemplate(
            record.definition,
            (value) => value,
            (id) => {
              const field = record.definition.fields.find((item) => item.id === id)!
              if (field.kind !== 'photo') return formAnswerSummary(field, record.answers[id])
              const count = photoIds(record, id).length
              return (
                field.label +
                '\n' +
                (count
                  ? count +
                    ' photos' +
                    (url
                      ? '\nView all photos: ' +
                        photoTarget(url, id) +
                        '\n' +
                        'Sign in as the record owner or Admin to view the submission and photos.'
                      : '')
                  : 'N/A')
              )
            },
          ),
        ]
      : record.definition.fields.map((field) => {
          const section =
            field.section && field.section !== previousSection ? field.section + '\n' : ''
          previousSection = field.section || ''
          const ids = photoIds(record, field.id)
          const answer =
            field.kind === 'photo'
              ? ids.length
                ? ids.length +
                  (ids.length === 1 ? ' photo' : ' photos') +
                  (url
                    ? '\nView all photos: ' +
                      photoTarget(url, field.id) +
                      '\n' +
                      'Sign in as the record owner or Admin to view the submission and photos.'
                    : '')
                : 'N/A'
              : formAnswerSummary(field, record.answers[field.id])
          return section + field.label + (field.hint ? '\n' + field.hint : '') + '\n' + answer
        })),
  ]
    .filter(Boolean)
    .join('\n\n')
}
