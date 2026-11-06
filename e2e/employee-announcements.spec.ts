import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
for(const width of [1280,390]) test(`Employee has a read-only announcement inbox at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900})
  const api=await mockDashboard(page,false)
  api.announcements.push(
    {id:'all',title:'Company update',body:'For everyone',audience:'everyone',publishedAt:3},
    {id:'job',title:'Assigned job update',body:'For my assigned job',audience:'job',jobId:'job-1',publishedAt:2},
    {id:'self',title:'Personal update',body:'For this person',audience:'people',publishedAt:1},
  )
  const fixture=createJobsFixture()
  fixture.auth.profile.role='employee'
  fixture.auth.profile.assignedJobIds=['job-1']
  await gotoPhase2App(page,'/login?redirect=/jobs/job-1',fixture)
  await expect(page).toHaveURL(/\/dashboards\/announcements$/)
  await expect(page.getByRole('heading',{name:'Announcements',exact:true})).toBeVisible()
  for(const title of ['Company update','Assigned job update','Personal update'])
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible()
  const links=page.locator('.app-shell__nav a')
  await expect(links).toHaveCount(1)
  await expect(links).toHaveAttribute('href','/dashboards/announcements')
  await expect(page.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Save my timecard',exact:true})).toHaveCount(0)
  await page.screenshot({path:test.info().outputPath(`employee-announcements-${width}.png`)})
  for(const route of ['/jobs','/dashboards/personal','/users','/company-library','/jobs/job-1/timecards']){
    await page.goto(route)
    await expect(page).toHaveURL(/\/dashboards\/announcements$/)
  }
  await page.reload()
  await expect(page.getByRole('heading',{name:'Personal update',exact:true})).toBeVisible()
  expect(api.requests.every(request=>request.action==='list-announcements'&&request.scope==='personal')).toBe(true)
  await page.goto('/jobs/my-timecard')
  await expect(page.getByText('My Timecard is temporarily unavailable',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Save my timecard',exact:true})).toHaveCount(0)
})
