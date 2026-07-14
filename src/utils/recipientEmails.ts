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
