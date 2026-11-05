import type { FormDefinition } from './model'
/** New unpublished pilot only: delivery recipients and wider audience require owner review. */
export const safetyTalkDefinition: FormDefinition = {
  title: 'Safety Talk / Attendance',
  description: 'Record one safety talk. Each attendee enters their name and signs, then selects Save attendee & next before handing over the device.',
  recipients: [],
  access: { respondents: 'signed-in', identity: 'identified', respondentRoles: ['admin'], respondentUserIds: [], entryRoles: [], entryUserIds: [] },
  output: { requireLogin: true, pdf: true, template: '' },
  fields: [
    { id: 'job', kind: 'text', label: 'Job name / number', required: true, options: [] },
    { id: 'site', kind: 'text', label: 'Site / location', required: true, options: [] },
    { id: 'date', kind: 'date', label: 'Date of safety talk', required: true, options: [] },
    { id: 'topic', kind: 'textarea', label: 'Safety talk topic and notes', required: true, options: [] },
    { id: 'facilitator', kind: 'text', label: 'Talk led by', required: true, options: [] },
    { id: 'attendees', kind: 'repeat', label: 'Attendee', required: true, options: [], sequential: true, minInstances: 1, maxInstances: 20, fields: [
      { id: 'name', kind: 'text', label: 'Attendee name', required: true, options: [] },
      { id: 'signature', kind: 'signature', label: 'Attendee signature', required: true, options: [] },
    ] },
  ],
}
