import { computed } from 'vue'

export interface AppActor {
  userId: string | null
  displayName: string | null
}

interface UseCurrentActorOptions {
  getUserId: () => string | null
  getDisplayName: () => string | null | undefined
  getEmail?: () => string | null | undefined
}

export function useCurrentActor({
  getUserId,
  getDisplayName,
  getEmail,
}: UseCurrentActorOptions) {
  const currentUserId = computed(() => getUserId())
  const currentActorDisplayName = computed(() => getDisplayName() || getEmail?.() || null)

  function getActor(): AppActor {
    return {
      userId: currentUserId.value,
      displayName: currentActorDisplayName.value,
    }
  }

  return {
    currentActorDisplayName,
    currentUserId,
    getActor,
  }
}
