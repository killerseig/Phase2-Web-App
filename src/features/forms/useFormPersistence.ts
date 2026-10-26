import { ref, type Ref } from 'vue'
import { formApi, type ServerFormTemplate } from '@/services/forms'
import { formOutputIssues } from '../../../functions/src/formOutputTemplate'
import {
  clone,
  definitionErrors,
  duplicateTemplate,
  keepVersion,
  type FormLibrary,
  type FormTemplate,
} from './model'
import { saveLibrary } from './localLibrary'
import type { useFormAuthoring } from './useFormAuthoring'

interface FormPersistenceOptions {
  uid: Readonly<Ref<string>>
  draft: Ref<FormTemplate | undefined>
  library: Ref<FormLibrary>
  dirty: Ref<boolean>
  blocked: Ref<boolean>
  message: Ref<string>
  error: Ref<string>
  serverEnabled: boolean
  localPreview: boolean
  authoring: Pick<ReturnType<typeof useFormAuthoring>, 'saved' | 'reset'>
  storage: () => Pick<Storage, 'getItem' | 'setItem'>
  confirmPublish: () => Promise<boolean | undefined>
  showPublicationIssues: () => void
}

/** Persistence only: authoring history, navigation and field editing stay with the editor. */
export function useFormPersistence(options: FormPersistenceOptions) {
  const {
    uid,
    draft,
    library,
    dirty,
    blocked,
    message,
    error,
    authoring,
    serverEnabled,
    localPreview,
  } = options
  const serverTemplates = ref<ServerFormTemplate[]>([])
  const serverBusy = ref(false)
  const serverAvailable = ref(false)
  const publishPhase = ref<'' | 'confirming' | 'saving' | 'publishing'>('')
  async function loadServer() {
    if (!serverEnabled || !uid.value) return
    const owner = uid.value
    try {
      const result = await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', {
        action: 'list',
      })
      if (uid.value === owner) {
        serverTemplates.value = result.templates
        serverAvailable.value = true
      }
    } catch (caught) {
      if (uid.value === owner) {
        serverAvailable.value = false
        error.value = (caught as Error).message
      }
    }
  }
  async function saveServer(): Promise<ServerFormTemplate | undefined> {
    if (!draft.value || serverBusy.value || !serverAvailable.value) return
    const owner = uid.value,
      submitted = JSON.stringify(draft.value)
    serverBusy.value = true
    try {
      const existing = serverTemplates.value.find((item) => item.id === draft.value!.id)
      const definition = clone(draft.value)
      const result = await formApi<ServerFormTemplate>('formTemplates', {
        action: 'save',
        id: definition.id,
        revision: existing?.revision || 0,
        definition,
      })
      if (uid.value !== owner) return
      await loadServer()
      if (JSON.stringify(draft.value) === submitted) authoring.saved()
      message.value = localPreview ? 'Draft saved to the local server.' : 'Draft saved.'
      if (serverAvailable.value) error.value = ''
      return result
    } catch (caught) {
      error.value = (caught as Error).message
    } finally {
      serverBusy.value = false
    }
  }
  async function issueServer() {
    if (
      serverBusy.value ||
      publishPhase.value ||
      !draft.value ||
      localPreview ||
      draft.value.archived ||
      !serverAvailable.value
    )
      return
    message.value = ''
    const issues = [
      ...definitionErrors(draft.value),
      ...formOutputIssues(draft.value)
        .filter((issue) => issue.severity === 'error')
        .map((issue) => issue.message),
    ]
    if (issues.length) {
      error.value = issues.join(' ')
      options.showPublicationIssues()
      return
    }
    const owner = uid.value,
      id = draft.value.id,
      submitted = JSON.stringify(draft.value)
    const stillCurrent = () =>
      uid.value === owner && draft.value?.id === id && JSON.stringify(draft.value) === submitted
    publishPhase.value = 'confirming'
    try {
      if (!(await options.confirmPublish())) return
      if (!stillCurrent()) {
        error.value = 'The draft or signed-in account changed. Review it before publishing again.'
        return
      }
      publishPhase.value = 'saving'
      const saved = await saveServer()
      if (!saved) return
      if (!stillCurrent() || saved.id !== id) {
        error.value = 'The draft changed during saving. Review it before publishing again.'
        return
      }
      publishPhase.value = 'publishing'
      serverBusy.value = true
      await formApi('formTemplates', { action: 'issue', id: saved.id, revision: saved.revision })
      if (uid.value !== owner) return
      await loadServer()
      message.value = 'Draft saved and immutable form version published.'
      if (serverAvailable.value) error.value = ''
    } catch (caught) {
      if (uid.value === owner) {
        message.value = ''
        error.value =
          (publishPhase.value === 'publishing' ? 'Draft saved, but publication failed: ' : '') +
          (caught as Error).message
      }
    } finally {
      serverBusy.value = false
      publishPhase.value = ''
    }
  }
  function persist(next = library.value) {
    try {
      library.value = saveLibrary(options.storage(), uid.value, next)
      error.value = ''
      message.value = 'Saved on this device.'
      return true
    } catch (caught) {
      error.value = (caught as Error).message
      return false
    }
  }
  function save(version = false) {
    if (!draft.value || blocked.value || !uid.value) return
    let saved: FormTemplate
    try {
      saved = version ? keepVersion(draft.value) : clone(draft.value)
    } catch (caught) {
      error.value = (caught as Error).message
      return
    }
    const next = clone(library.value)
    const index = next.templates.findIndex((template) => template.id === saved.id)
    if (index < 0) next.templates.push(saved)
    else next.templates[index] = saved
    if (persist(next)) {
      draft.value = clone(saved)
      authoring.saved()
      dirty.value = false
    }
  }
  async function importDeviceDraft(id: string) {
    if (!serverAvailable.value || serverBusy.value || dirty.value) return
    const source = library.value.templates.find((item) => item.id === id && !item.archived)
    if (!source) return
    draft.value = duplicateTemplate(source)
    authoring.reset(true)
    await saveServer()
  }
  return {
    serverTemplates,
    serverBusy,
    serverAvailable,
    publishPhase,
    loadServer,
    saveServer,
    issueServer,
    persist,
    save,
    importDeviceDraft,
  }
}
