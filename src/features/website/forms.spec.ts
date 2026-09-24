import { describe, expect, it } from 'vitest'
import {
  newWebsiteForm,
  publicForm,
  validateForm,
  validateFormValues,
} from '../../../functions/src/websiteForms'
describe('public website forms', () => {
  it('validates private routing and removes all email settings from public form schemas', () => {
    const form = newWebsiteForm('contact')
    form.delivery = {
      to: [' OFFICE@example.com ', 'office@example.com'],
      cc: ['office@example.com', 'manager@example.com'],
      subject: 'Website inquiry',
    }
    const checked = validateForm(form)
    expect(checked.delivery).toEqual({
      to: ['office@example.com'],
      cc: ['manager@example.com'],
      subject: 'Website inquiry',
    })
    expect(publicForm(checked).delivery).toBeUndefined()
    expect(JSON.stringify(publicForm(checked))).not.toContain('manager@example.com')
    form.delivery.subject = 'Subject\r\nBcc: attacker@example.com'
    expect(() => validateForm(form)).toThrow()
    form.delivery.subject = 'Safe'
    form.replyToField = 'message'
    expect(() => validateForm(form)).toThrow(/Reply-To/)
  })
  it('checks required fields, visitor email, choices, consent, sizes and unknown fields', () => {
    const form = newWebsiteForm('contact')
    form.fields.push(
      {
        id: 'topic',
        label: 'Topic',
        type: 'select',
        required: true,
        options: ['General', 'Careers'],
      },
      { id: 'consent', label: 'Contact permission', type: 'checkbox', required: true, options: [] },
    )
    const valid = {
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'Question',
      topic: 'General',
      consent: true,
    }
    expect(validateFormValues(form, valid)).toEqual(valid)
    for (const patch of [
      { name: '' },
      { email: 'invalid' },
      { email: 'visitor@example.com\nBcc:attacker@example.com' },
      { message: 'a'.repeat(5001) },
      { topic: 'Forged' },
      { consent: false },
      { to: 'attacker@example.com' },
    ])
      expect(() => validateFormValues(form, { ...valid, ...patch })).toThrow()
    expect(
      validateFormValues(newWebsiteForm('plain'), {
        name: 'A',
        email: 'a@example.com',
        message: '<script>untrusted()</script>',
      }).message,
    ).toBe('<script>untrusted()</script>')
  })
})
