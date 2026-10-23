import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import type { FormRecord } from '../../../functions/src/formModel'
const api = vi.hoisted(() => vi.fn())
vi.mock('@/services/forms', () => ({ formApi: api }))
import FormRecipientVerification from './FormRecipientVerification.vue'
const email = 'recipient@example.invalid'
function record(): FormRecord { return { id: 'public-test-record', templateId: 'public-test-template', templateVersion: 1, ownerUid: '', revision: 1, status: 'draft', createdAt: 1, updatedAt: 1, definition: { title: 'Synthetic public response', description: '', recipients: [], version: 1, createdAt: '', fields: [{ id: 'recipients', kind: 'recipients', label: 'Recipients', required: false, options: [] }] }, answers: { recipients: [email] } } }
let wrapper: VueWrapper
function render(prepare = vi.fn(async () => true)) { const saved = record(); wrapper = mount(FormRecipientVerification, { attachTo: document.body, props: { record: saved, answers: saved.answers, capability: 'a'.repeat(64), prepare } }); return prepare }
const request = () => wrapper.get('[aria-label="Request approval code for ' + email + '"]')
const code = () => wrapper.get('[aria-label="Approval code for ' + email + '"]')
const verify = () => wrapper.get('[aria-label="Verify approval code for ' + email + '"]')
beforeEach(() => api.mockReset())
afterEach(() => wrapper?.unmount())

describe('public recipient approval UI', () => {
  it('does not request mail automatically and stops if saving fails', async () => {
    const prepare = render(vi.fn(async () => false))
    expect(api).not.toHaveBeenCalled()
    await request().trigger('click'); await flushPromises()
    expect(prepare).toHaveBeenCalledOnce(); expect(api).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Save the recipient addresses successfully')
    expect(wrapper.emitted('busy')).toEqual([[true], [false]])
  })
  it('saves addresses, requests a code, preserves leading zeros and approves only a server-verified response', async () => {
    const prepare = render()
    api.mockResolvedValueOnce({ status: 'sent' }).mockResolvedValueOnce({ status: 'verified' })
    await request().trigger('click'); await flushPromises()
    expect(prepare).toHaveBeenCalledOnce()
    expect(api).toHaveBeenNthCalledWith(1, 'publicFormRecipientVerification', expect.objectContaining({ action: 'request', id: 'public-test-record', publicCapability: 'a'.repeat(64), email, requestId: expect.any(String) }))
    expect(document.activeElement).toBe(code().element)
    expect(wrapper.text()).not.toContain('Approved for this response.')
    await code().setValue('00123456'); await verify().trigger('click'); await flushPromises()
    expect(api).toHaveBeenNthCalledWith(2, 'publicFormRecipientVerification', expect.objectContaining({ action: 'verify', code: '00123456' }))
    expect(wrapper.text()).toContain('Approved for this response.')
    expect(wrapper.text()).toContain('does not grant access to private entries or photos')
    expect(wrapper.find('input').exists()).toBe(false)
  })
  it('reuses an uncertain request ID and blocks duplicate clicks while saving/requesting', async () => {
    let finish!: (result: unknown) => void
    render(); api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await request().trigger('click'); await flushPromises(); await request().trigger('click')
    expect(api).toHaveBeenCalledOnce(); finish({ status: 'pending' }); await flushPromises()
    const id = api.mock.calls[0]![1].requestId
    api.mockRejectedValueOnce(new Error('Connection lost'))
    await request().trigger('click'); await flushPromises()
    api.mockResolvedValueOnce({ status: 'sent' }); await request().trigger('click'); await flushPromises()
    expect(api.mock.calls.every(([, data]) => data.requestId === id)).toBe(true)
    expect(wrapper.text()).not.toContain('Approved for this response.')
  })
  it('does not treat wrong, expired, malformed or unconfirmed codes as verified', async () => {
    render(); api.mockResolvedValueOnce({ status: 'sent' }); await request().trigger('click'); await flushPromises()
    await code().setValue('123'); await verify().trigger('click'); await flushPromises(); expect(api).toHaveBeenCalledOnce()
    await code().setValue('12345678'); api.mockRejectedValueOnce(new Error('Incorrect verification code.')); await verify().trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Incorrect verification code.'); expect(wrapper.text()).not.toContain('Approved for this response.')
    api.mockResolvedValueOnce({ status: 'sent' }); await verify().trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Approval was not confirmed.')
    api.mockRejectedValueOnce(new Error('Verification expired or unavailable.')); await verify().trigger('click'); await flushPromises()
    expect(wrapper.find('input').exists()).toBe(false)
    const old = api.mock.calls[0]![1].requestId
    api.mockResolvedValueOnce({ status: 'sent' }); await request().trigger('click'); await flushPromises()
    expect(api.mock.calls.at(-1)![1].requestId).not.toBe(old)
  })
  it('shows honest not-configured/rate-limit failures and leaves unverified delivery excluded', async () => {
    render(); api.mockRejectedValueOnce(new Error('Verification limit reached. Submit now or try later.'))
    await request().trigger('click'); await flushPromises(); expect(wrapper.text()).toContain('Verification limit reached')
    api.mockResolvedValueOnce({ status: 'not-configured' }); await request().trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('this unverified address will not receive the report')
    expect(wrapper.find('input').exists()).toBe(false); expect(wrapper.text()).not.toContain('Approved for this response.')
  })
  it('discards late success on a different record/capability and creates fresh state for the same email', async () => {
    let finish!: (result: unknown) => void
    render(); api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await request().trigger('click'); await flushPromises()
    await wrapper.setProps({ record: { ...record(), id: 'different-record' }, capability: 'b'.repeat(64) })
    finish({ status: 'verified' }); await flushPromises(); expect(wrapper.text()).not.toContain('Approved for this response.')
    api.mockResolvedValueOnce({ status: 'sent' }); await request().trigger('click'); await flushPromises()
    expect(api.mock.calls.at(-1)![1]).toMatchObject({ id: 'different-record', publicCapability: 'b'.repeat(64) })
  })
  it('uses current unsaved addresses, ignores removed addresses and handles nested recipients', async () => {
    render(vi.fn(async () => false)); await wrapper.setProps({ answers: { recipients: ['new@example.invalid'] } })
    expect(wrapper.text()).toContain('new@example.invalid'); expect(wrapper.text()).not.toContain(email)
    await wrapper.setProps({ record: { ...record(), definition: { ...record().definition, fields: [{ id: 'sites', kind: 'repeat', label: 'Sites', required: false, options: [], fields: record().definition.fields }] } }, answers: { sites: [{ instanceId: 'north', answers: { recipients: [email] } }] } })
    expect(wrapper.text()).toContain(email)
    await wrapper.setProps({ answers: { sites: [{ instanceId: 'north', answers: { recipients: ['bad-address'] } }] } })
    expect(wrapper.text()).toContain('Invalid recipient address.'); expect(wrapper.find('button').exists()).toBe(false)
  })
})
