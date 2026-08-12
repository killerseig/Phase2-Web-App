export function normalizeRecipientEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isValidRecipientEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function normalizeRecipientEmailList(values: readonly string[]) {
  return Array.from(
    new Set(
      values
        .map(normalizeRecipientEmail)
        .filter(Boolean),
    ),
  )
}

export type RecipientAddResult =
  | { status: 'ready'; email: string }
  | { status: 'empty' | 'invalid' | 'duplicate'; email: string }

export function getRecipientAddResult(
  value: string,
  existingRecipients: readonly string[],
  reservedRecipients: readonly string[] = [],
): RecipientAddResult {
  const email = normalizeRecipientEmail(value)

  if (!email) {
    return { status: 'empty', email }
  }

  if (!isValidRecipientEmail(email)) {
    return { status: 'invalid', email }
  }

  const existing = new Set(normalizeRecipientEmailList([
    ...existingRecipients,
    ...reservedRecipients,
  ]))

  if (existing.has(email)) {
    return { status: 'duplicate', email }
  }

  return { status: 'ready', email }
}

export function appendRecipientEmail(recipients: readonly string[], email: string) {
  return normalizeRecipientEmailList([...recipients, email])
}

export function removeRecipientEmail(recipients: readonly string[], email: string) {
  const normalizedEmail = normalizeRecipientEmail(email)
  return recipients.filter((recipient) => normalizeRecipientEmail(recipient) !== normalizedEmail)
}
