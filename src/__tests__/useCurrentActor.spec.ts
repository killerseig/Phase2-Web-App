import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'

import { useCurrentActor } from '@/composables/useCurrentActor'

interface ActorSource {
  displayName: string | null | undefined
  email: string | null | undefined
  userId: string | null
}

function createActor(source: ActorSource) {
  return useCurrentActor({
    getUserId: () => source.userId,
    getDisplayName: () => source.displayName,
    getEmail: () => source.email,
  })
}

describe('useCurrentActor', () => {
  it('builds an actor from the current user id and display name', () => {
    const source = reactive<ActorSource>({
      displayName: 'Chris Larsen',
      email: 'chris@example.com',
      userId: 'user-1',
    })
    const actor = createActor(source)

    expect(actor.currentUserId.value).toBe('user-1')
    expect(actor.currentActorDisplayName.value).toBe('Chris Larsen')
    expect(actor.getActor()).toEqual({
      userId: 'user-1',
      displayName: 'Chris Larsen',
    })
  })

  it('falls back to email when the display name is empty', () => {
    const source = reactive<ActorSource>({
      displayName: '',
      email: 'foreman@example.com',
      userId: 'user-2',
    })
    const actor = createActor(source)

    expect(actor.currentActorDisplayName.value).toBe('foreman@example.com')
    expect(actor.getActor()).toEqual({
      userId: 'user-2',
      displayName: 'foreman@example.com',
    })
  })

  it('returns a null display name when neither display name nor email exists', () => {
    const source = reactive<ActorSource>({
      displayName: null,
      email: null,
      userId: 'user-3',
    })
    const actor = createActor(source)

    expect(actor.currentActorDisplayName.value).toBeNull()
    expect(actor.getActor()).toEqual({
      userId: 'user-3',
      displayName: null,
    })
  })

  it('reacts to source changes', () => {
    const source = reactive<ActorSource>({
      displayName: null,
      email: 'initial@example.com',
      userId: 'initial-user',
    })
    const actor = createActor(source)

    expect(actor.getActor()).toEqual({
      userId: 'initial-user',
      displayName: 'initial@example.com',
    })

    source.userId = 'updated-user'
    source.displayName = 'Updated User'

    expect(actor.currentUserId.value).toBe('updated-user')
    expect(actor.currentActorDisplayName.value).toBe('Updated User')
    expect(actor.getActor()).toEqual({
      userId: 'updated-user',
      displayName: 'Updated User',
    })
  })
})
