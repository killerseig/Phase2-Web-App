import type { FormDefinition } from '../../functions/src/formModel'
export const choiceDefinition: FormDefinition = {
  title: 'Choice controls',
  description: 'Synthetic common-choice control fixture',
  recipients: [],
  fields: [
    {
      id: 'ack',
      kind: 'checkbox',
      label: 'Acknowledgement',
      required: true,
      options: [],
      hint: 'Confirm before submitting.',
    },
    { id: 'followup', kind: 'checkbox', label: 'Optional follow-up', required: false, options: [] },
    {
      id: 'schedule',
      kind: 'radio',
      label: 'Schedule',
      required: true,
      options: ['Daily', 'Weekly'],
      hint: 'Choose one schedule.',
    },
    {
      id: 'areas',
      kind: 'multiselect',
      label: 'Work areas',
      required: true,
      options: ['North', 'South', 'West'],
      hint: 'Choose all applicable areas.',
    },
    {
      id: 'extras',
      kind: 'multiselect',
      label: 'Optional areas',
      required: false,
      options: ['Office', 'Shop'],
    },
  ],
}
