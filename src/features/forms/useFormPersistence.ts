import { adminTemplateCommand } from '@/features/forms/templateCommands'
import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { type ServerFormTemplate } from '@/services/forms'
import { formOutputIssues } from '../../../functions/src/formOutputTemplate'
import {
  clone, definitionErrors, duplicateTemplate, keepVersion,
  type FormLibrary, type FormTemplate,
} from './model'
import { saveLibrary } from './localLibrary'
import type { useFormAuthoring } from './useFormAuthoring'
import type { useFormEditorContext } from './useFormEditorContext'

interface FormPersistenceOptions {
  uid: Readonly<Ref<string>>
  context: ReturnType<typeof useFormEditorContext>
  draft: Ref<FormTemplate | undefined>
  library: Ref<FormLibrary>
  dirty: Ref<boolean>
  blocked: Ref<boolean>
  message: Ref<string>
  error: Ref<string>
  serverEnabled: boolean
  localPreview: boolean
  authoring: Pick<ReturnType<typeof useFormAuthoring>, 'saved' | 'reset'>
  storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  confirmPublish: () => Promise<boolean | undefined>
  showPublicationIssues: () => void
  onDraftSelected?: () => void
}

/** Owns all server library mutations; invalidation rejects local effects, not sent server writes. */
export function useFormPersistence(options: FormPersistenceOptions) {
  const { uid, context, draft, library, dirty, blocked, message, error, authoring, serverEnabled, localPreview } = options
  const serverTemplates = ref<ServerFormTemplate[]>([])
  const serverBusy = ref(false)
  const serverAvailable = ref(false)
  const publishPhase = ref<'' | 'confirming' | 'saving' | 'publishing'>('')
  let disposed = false, listRequest = 0, mutationRequest = 0
  type Snapshot = ReturnType<typeof context.capture>
  type Operation = { id: number; snapshot: Snapshot }
  const current = (operation: Operation) => !disposed && operation.id === mutationRequest && operation.snapshot.current()
  const sameDraft = (operation: Operation) => current(operation) && operation.snapshot.draftCurrent()
  const errorText = (caught: unknown) => caught instanceof Error ? caught.message : 'The form operation failed.'

  function reset() {
    listRequest++; mutationRequest++
    serverTemplates.value = []
    serverAvailable.value = false
    serverBusy.value = false
    publishPhase.value = ''
  }
  watch(context.revision, reset, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; reset() })

  async function refreshLibrary(reportStatus: () => boolean): Promise<'loaded' | 'failed' | 'stale'> {
    if (disposed || !context.allowed.value || !serverEnabled) return 'stale'
    const snapshot = context.capture(), request = ++listRequest
    const latest = () => !disposed && snapshot.current() && request === listRequest
    try {
      const result = await adminTemplateCommand('list')
      if (!latest()) return 'stale'
      serverTemplates.value = result.templates
      serverAvailable.value = true
      if (reportStatus()) error.value = ''
      return 'loaded'
    } catch (caught) {
      if (!latest()) return 'stale'
      serverAvailable.value = false
      if (reportStatus()) error.value = errorText(caught)
      return 'failed'
    }
  }
  function loadServer() {
    const snapshot = context.capture(), mutation = mutationRequest
    return refreshLibrary(() => snapshot.draftCurrent() && mutation === mutationRequest)
  }
  function begin(): Operation | undefined {
    if (disposed || !context.allowed.value || !serverEnabled || !serverAvailable.value || serverBusy.value || publishPhase.value) return
    // A list started before this mutation must not reinstall its older revisions.
    listRequest++
    const operation = { id: ++mutationRequest, snapshot: context.capture() }
    serverBusy.value = true
    error.value = ''; message.value = ''
    return operation
  }
  function finish(operation: Operation) {
    if (!current(operation)) return
    serverBusy.value = false
    publishPhase.value = ''
  }

  async function saveCaptured(operation: Operation, definition: FormTemplate) {
    if (!sameDraft(operation)) return
    const existing = serverTemplates.value.find(item => item.id === definition.id)
    const saved = await adminTemplateCommand('save', {
      id: definition.id, revision: existing?.revision || 0, definition,
    })
    if (!current(operation)) return
    if (saved.id !== definition.id) throw new Error('The saved response does not match this draft. Review it before publishing again.')
    const refreshed = await refreshLibrary(() => sameDraft(operation))
    if (refreshed === 'stale' || !sameDraft(operation)) return
    authoring.saved()
    // A successful write remains saved even when its follow-up list fails.
    message.value = localPreview ? 'Draft saved to the local server.' : 'Draft saved.'
    return { saved, refreshed }
  }
  async function saveServer(): Promise<ServerFormTemplate | undefined> {
    if (!draft.value) return
    const definition = clone(draft.value), operation = begin()
    if (!operation) return
    try { return (await saveCaptured(operation, definition))?.saved }
    catch (caught) { if (sameDraft(operation)) error.value = errorText(caught) }
    finally { finish(operation) }
  }
  async function issueServer() {
    if (!draft.value || localPreview || draft.value.archived || disposed || !context.allowed.value || serverBusy.value || publishPhase.value || !serverAvailable.value) return
    const issues = [
      ...definitionErrors(draft.value),
      ...formOutputIssues(draft.value).filter(issue => issue.severity === 'error').map(issue => issue.message),
    ]
    if (issues.length) {
      error.value = issues.join(' ')
      options.showPublicationIssues()
      return
    }
    const definition = clone(draft.value), operation = begin()
    if (!operation) return
    let sentIssue = false
    publishPhase.value = 'confirming'
    try {
      if (!(await options.confirmPublish()) || !sameDraft(operation)) return
      publishPhase.value = 'saving'
      const result = await saveCaptured(operation, definition)
      if (result?.refreshed !== 'loaded' || !sameDraft(operation) || result.saved.id !== definition.id) return
      publishPhase.value = 'publishing'
      sentIssue = true
      await adminTemplateCommand('issue', { id: result.saved.id, revision: result.saved.revision })
      if (!current(operation)) return
      const refreshed = await refreshLibrary(() => sameDraft(operation))
      if (refreshed === 'stale' || !sameDraft(operation)) return
      message.value = refreshed === 'loaded'
        ? 'Draft saved and immutable form version published.'
        : 'Form version published. Refresh the library to see its current status.'
    } catch (caught) {
      if (sameDraft(operation)) {
        message.value = ''
        error.value = (sentIssue ? 'Draft saved, but publication failed: ' : '') + errorText(caught)
      }
    } finally { finish(operation) }
  }

  function replaceDraft(value?: FormTemplate) {
    draft.value = value
    authoring.reset()
    options.onDraftSelected?.()
  }
  async function removeServer(template: ServerFormTemplate, confirm: () => Promise<boolean | undefined>) {
    const operation = begin()
    if (!operation) return
    const { id, revision } = template
    try {
      if (!(await confirm()) || !sameDraft(operation)) return
      await adminTemplateCommand('remove', { id, revision })
      if (!current(operation)) return
      const refreshed = await refreshLibrary(() => sameDraft(operation))
      if (refreshed !== 'stale' && sameDraft(operation) && draft.value?.id === id) replaceDraft()
    } catch (caught) { if (sameDraft(operation)) error.value = errorText(caught) }
    finally { finish(operation) }
  }
  async function duplicateServer(template: ServerFormTemplate) {
    if (disposed || !context.allowed.value || template.archived) return
    if (dirty.value) { error.value = 'Save or discard current edits before duplicating.'; return }
    const operation = begin()
    if (!operation) return
    const { id, revision } = template
    const key = 'form-copy-request:v1:' + uid.value + ':' + id + ':' + revision
    try {
      const storage = options.storage(), targetId = storage.getItem(key) || crypto.randomUUID()
      storage.setItem(key, targetId)
      const result = await adminTemplateCommand('duplicate', { id, revision, targetId })
      if (!current(operation)) return
      const refreshed = await refreshLibrary(() => sameDraft(operation))
      if (refreshed !== 'loaded' || !sameDraft(operation)) return
      storage.removeItem(key)
      replaceDraft({ ...clone(result.draft), id: result.id, archived: result.archived, versions: [] })
      message.value = 'Independent server copy created. Original versions and records are unchanged.'
    } catch (caught) { if (sameDraft(operation)) error.value = errorText(caught) }
    finally { finish(operation) }
  }
  function persist(next = library.value) {
    if (disposed || !context.allowed.value || blocked.value) return false
    try {
      library.value = saveLibrary(options.storage(), uid.value, next)
      error.value = ''
      message.value = 'Saved on this device.'
      return true
    } catch (caught) { error.value = errorText(caught); return false }
  }
  function save(version = false) {
    if (!draft.value || blocked.value || disposed || !context.allowed.value) return
    let saved: FormTemplate
    try { saved = version ? keepVersion(draft.value) : clone(draft.value) }
    catch (caught) { error.value = errorText(caught); return }
    const next = clone(library.value)
    const index = next.templates.findIndex(template => template.id === saved.id)
    if (index < 0) next.templates.push(saved)
    else next.templates[index] = saved
    if (persist(next)) {
      draft.value = clone(saved)
      authoring.saved()
      dirty.value = false
    }
  }
  async function importDeviceDraft(id: string) {
    if (disposed || !context.allowed.value || !serverAvailable.value || serverBusy.value || publishPhase.value || dirty.value) return
    const source = library.value.templates.find(item => item.id === id && !item.archived)
    if (!source) return
    draft.value = duplicateTemplate(source)
    authoring.reset(true)
    options.onDraftSelected?.()
    await saveServer()
  }
  return {
    serverTemplates, serverBusy, serverAvailable, publishPhase,
    loadServer, saveServer, issueServer, removeServer, duplicateServer, persist, save, importDeviceDraft,
  }
}
