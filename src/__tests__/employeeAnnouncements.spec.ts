import { describe, expect, it } from 'vitest'
import { isActiveAnnouncementProfile } from '../../functions/src/announcementAccess'
import { buildCurrentFunctionUser } from '../../functions/src/roleAccess'
import { getRouteAccessDecision } from '@/router/routeAccess'
import { getWorkspaceRedirectTarget } from '@/features/auth/authViewHelpers'
describe('Employee announcement-only access', () => {
  it('includes Employee for announcements without enabling general backend capabilities', () => {
    expect(isActiveAnnouncementProfile({role:'Employee',active:true})).toBe(true)
    expect(buildCurrentFunctionUser('self',{role:'employee',active:true}).role).toBe('none')
    for(const profile of [{role:'employee',active:false},{role:'none'},{role:'unknown'},{}]) expect(isActiveAnnouncementProfile(profile)).toBe(false)
  })
  it('allows the inbox and redirects unrelated pages without restoring timecards', () => {
    expect(getRouteAccessDecision({rawRole:'employee',hasWorkspaceAccess:true,routeName:'announcements',routeJobId:''})).toBe(true)
    expect(getRouteAccessDecision({rawRole:'employee',hasWorkspaceAccess:true,routeName:'my-timecard',routeJobId:''})).toBe(true)
    for(const routeName of ['jobs','personal-workspace','role-workspace','users','company-library','timecards'])
      expect(getRouteAccessDecision({rawRole:'employee',hasWorkspaceAccess:true,routeName,routeJobId:'job-a',assignedJobIds:['job-a']})).toEqual({name:'announcements'})
    expect(getRouteAccessDecision({rawRole:'employee',hasWorkspaceAccess:false,routeName:'announcements',routeJobId:''})).toEqual({name:'login'})
    expect(getWorkspaceRedirectTarget('/dashboards/announcements')).toBe('/dashboards/announcements')
  })
})
