import type { IntranetContent } from '../content'
export function sampleContent(): IntranetContent {
  return { version: 1, kind: 'phase2-intranet-content',
    source: { title: 'Synthetic intranet reference', sha256: 'a'.repeat(64), documentsIncluded: false },
    resources: [{ id: 'reference-one', title: 'Synthetic safety reference', category: 'Safety', kind: 'Reference', keywords: 'sample', filename: 'sample.pdf' }],
    forms: [{ id: 'form-one', title: 'Synthetic form reference', paragraphs: ['Supplied source paragraph.'], fields: [{ label: 'Review field', type: 'text', required: false, signature: false }] }],
    inspections: [{ id: 'inspection-one', title: 'Synthetic inspection', paragraphs: [{ en: 'Supplied English text.', es: 'Texto español proporcionado.' }] }],
    orientation: [{ en: 'Supplied orientation text.' }] }
}
