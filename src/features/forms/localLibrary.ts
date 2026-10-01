import { clone, emptyLibrary, fieldKinds, type FormLibrary } from './model'
const key = (uid: string) => {
  if (!uid) throw new Error('Sign in before accessing form drafts.')
  return 'form-builder-local:v1:' + uid
}
export function readLibrary(storage: Pick<Storage, 'getItem'>, uid: string): FormLibrary {
  const value = storage.getItem(key(uid))
  if (value === null) return emptyLibrary()
  try {
    const library = JSON.parse(value) as FormLibrary
    if (
      library.schema !== 1 ||
      !Number.isSafeInteger(library.revision) ||
      library.revision < 0 ||
      !Array.isArray(library.templates) ||
      library.templates.length > 100
    )
      throw new Error()
    for (const template of library.templates) {
      if (
        typeof template.id !== 'string' ||
        typeof template.title !== 'string' ||
        typeof template.description !== 'string' ||
        typeof template.archived !== 'boolean' ||
        !Array.isArray(template.fields) ||
        !Array.isArray(template.recipients) ||
        !Array.isArray(template.versions)
      )
        throw new Error()
      for (const field of template.fields)
        if (
          typeof field.id !== 'string' ||
          typeof field.label !== 'string' ||
          !fieldKinds.includes(field.kind) ||
          typeof field.required !== 'boolean' ||
          !Array.isArray(field.options) ||
          field.options.some((option) => typeof option !== 'string')
        )
          throw new Error()
      if (template.recipients.some((email) => typeof email !== 'string')) throw new Error()
    }
    if (new Set(library.templates.map((template) => template.id)).size !== library.templates.length)
      throw new Error()
    for (const template of library.templates) {
      for (const [index, version] of template.versions.entries()) {
        if (
          !version ||
          version.version !== index + 1 ||
          typeof version.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(version.createdAt)) ||
          typeof version.title !== 'string' ||
          typeof version.description !== 'string' ||
          !Array.isArray(version.fields) ||
          !Array.isArray(version.recipients)
        )
          throw new Error()
        const snapshot = { ...template, ...version, versions: [] }
        readLibrary(
          { getItem: () => JSON.stringify({ schema: 1, revision: 0, templates: [snapshot] }) },
          uid,
        )
      }
    }
    return library
  } catch {
    throw new Error(
      'Stored form drafts could not be read. They have been preserved; do not overwrite them.',
    )
  }
}
export function saveLibrary(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  uid: string,
  library: FormLibrary,
): FormLibrary {
  if (readLibrary(storage, uid).revision !== library.revision)
    throw new Error('Another tab changed the library. Reload before saving.')
  const next = clone(library)
  next.revision += 1
  const value = JSON.stringify(next)
  readLibrary({ getItem: () => value }, uid)
  storage.setItem(key(uid), value)
  if (storage.getItem(key(uid)) !== value)
    throw new Error(
      'The browser could not verify the saved draft. Keep this editor open and retry.',
    )
  return next
}
