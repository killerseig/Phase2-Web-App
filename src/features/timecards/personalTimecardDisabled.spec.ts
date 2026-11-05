import { describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'
import { handlePersonalTimecard } from '../../../functions/src/personalTimecardWorkspace'

describe('paused personal timecard endpoint', () => {
  const database = new Proxy({}, { get() { throw new Error('No database access permitted while paused') } }) as Firestore
  it.each(['context', 'load', 'save', 'link-status', 'auto-link'])('rejects %s before accessing or changing records', async personalAction => {
    const makeCard = vi.fn()
    await expect(handlePersonalTimecard({ auth: { uid: 'synthetic-account' }, data: { personalAction } }, database, makeCard))
      .rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('unavailable') })
    expect(makeCard).not.toHaveBeenCalled()
  })
  it('retains authentication enforcement', async () => {
    await expect(handlePersonalTimecard({ data: { personalAction: 'save' } }, database, vi.fn()))
      .rejects.toMatchObject({ code: 'unauthenticated' })
  })
})
