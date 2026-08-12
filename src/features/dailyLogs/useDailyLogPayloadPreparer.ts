import type { DailyLogPayload } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'
import {
  prepareDailyLogPayload,
  type DailyLogSiteInfoDisplay,
} from '@/features/dailyLogs/viewHelpers'

export interface UseDailyLogPayloadPreparerOptions {
  form: ReadonlyRef<DailyLogPayload>
  siteInfo: ReadonlyRef<DailyLogSiteInfoDisplay>
}

export function useDailyLogPayloadPreparer(options: UseDailyLogPayloadPreparerOptions) {
  function clonePreparedPayload(payload?: DailyLogPayload) {
    return prepareDailyLogPayload(
      payload ?? options.form.value,
      options.siteInfo.value,
    )
  }

  return {
    clonePreparedPayload,
  }
}
