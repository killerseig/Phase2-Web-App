import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import { isFormServerEnabled } from '@/services/forms'
import type { SharedDashboardLayout } from '@/features/dashboard/sharedDashboards'
export async function sharedDashboardCommand<T = SharedDashboardLayout>(
  action: 'load' | 'save-template' | 'save-notes' | 'save-calendar',
  data: Record<string, unknown>,
): Promise<T> {
  if (!isFormServerEnabled())
    throw new Error('Start the local emulator profile to review the new dashboards.')
  return (
    await httpsCallable<Record<string, unknown>, T>(
      requireFirebaseServices().functions,
      'sharedDashboardWorkspace',
    )({ ...data, action })
  ).data
}
