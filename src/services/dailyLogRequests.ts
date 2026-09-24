// Only use this for operations that the server can safely accept more than once.
export function isInterruptedDailyLogRequest(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as { code?: string; message?: string }
  return (
    code === 'functions/unavailable' ||
    code === 'functions/deadline-exceeded' ||
    (code === 'functions/internal' && /\[0\]\s*$/.test(message || ''))
  )
}

export async function retryDailyLogSubmission<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request()
    } catch (error) {
      if (attempt >= 2 || !isInterruptedDailyLogRequest(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt))
    }
  }
}

export function dailyLogRequestError(error: unknown, fallback: string): Error {
  if (isInterruptedDailyLogRequest(error)) {
    return Object.assign(
      new Error(
        'The connection was interrupted, so the server response could not be confirmed. Your entries are still on this page. Check your connection and try again.',
      ),
      { cause: error },
    )
  }
  return Object.assign(new Error(fallback), { cause: error })
}
