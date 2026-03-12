/**
 * Lightweight centralized logger for UI/runtime diagnostics.
 * Keeps call sites consistent and makes future log routing easy.
 */

export function logInfo(context: string, message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.info(`[${context}] ${message}`)
    return
  }
  console.info(`[${context}] ${message}`, payload)
}

export function logWarn(context: string, message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.warn(`[${context}] ${message}`)
    return
  }
  console.warn(`[${context}] ${message}`, payload)
}

export function logError(context: string, message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.error(`[${context}] ${message}`)
    return
  }
  console.error(`[${context}] ${message}`, payload)
}
