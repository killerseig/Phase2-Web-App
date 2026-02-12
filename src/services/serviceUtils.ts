export const normalizeError = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as any).message
    if (typeof msg === 'string' && msg.trim().length > 0) {
      return msg
    }
  }
  return fallback
}
