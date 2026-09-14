import { createHash } from 'node:crypto'
import { db } from './runtime'

const WINDOW_MS = 60 * 60 * 1000

export function nextResetAllowance(data: Record<string, unknown>, limit: number, now: number) {
  const start = Number(data.windowStart)
  const count = Number(data.count)
  const current = Number.isFinite(start) && start > now - WINDOW_MS && start <= now
  if (current && (!Number.isFinite(count) || count >= limit)) return null
  return { windowStart: current ? start : now, count: current ? count + 1 : 1 }
}

export async function consumePasswordResetAllowance(email: string, ip: string) {
  const key = (value: string) => createHash('sha256').update(value).digest('hex')
  const emailRef = db.collection('passwordResetLimits').doc(key(`email:${email}`))
  const ipRef = db.collection('passwordResetLimits').doc(key(`ip:${ip}`))
  return db.runTransaction(async (transaction) => {
    const [emailSnapshot, ipSnapshot] = await Promise.all([transaction.get(emailRef), transaction.get(ipRef)])
    const now = Date.now()
    const emailNext = nextResetAllowance(emailSnapshot.data() || {}, 3, now)
    const ipNext = nextResetAllowance(ipSnapshot.data() || {}, 20, now)
    if (!emailNext || !ipNext) return false
    transaction.set(emailRef, emailNext)
    transaction.set(ipRef, ipNext)
    return true
  })
}
