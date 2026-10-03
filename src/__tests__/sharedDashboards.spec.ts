import { describe, it, expect } from 'vitest'
import {
  defaultSharedWidgets,
  sharedDashboardKey,
  sharedWidgetTypes,
  validateSharedWidgets,
  validateSharedCalendar,
} from '../../functions/src/sharedDashboardModel'
import { resolveDashboardText } from '@/features/dashboard/sharedText'
describe('parallel shared dashboard contracts', () => {
  it('shares the job template across roles and keeps role templates distinct', () => {
    expect(sharedDashboardKey('job', 'admin')).toBe(sharedDashboardKey('job', 'foreman'))
    expect(sharedDashboardKey('role', 'foreman')).not.toBe(
      sharedDashboardKey('role', 'shop-foreman'),
    )
    expect(sharedWidgetTypes('job')).toEqual(sharedWidgetTypes('role'))
    expect(defaultSharedWidgets('job')[0]?.text).toContain('{{ job.name }}')
  })
  it('rejects duplicate tool identities, unsafe styling and an unusable default navigation', () => {
    const widgets = defaultSharedWidgets('job')
    expect(() => validateSharedWidgets([...widgets, { ...widgets[0]! }], 'job')).toThrow()
    expect(() =>
      validateSharedWidgets(
        widgets.filter((w) => w.type !== 'workflows'),
        'job',
      ),
    ).toThrow()
    expect(() =>
      validateSharedWidgets(
        widgets.map((w) => ({
          ...w,
          textStyle: {
            size: 25,
            color: 'url(javascript:alert(1))',
            weight: 400,
            align: 'left',
            lineHeight: 1.5,
          },
        })),
        'job',
      ),
    ).toThrow()
    const styled = structuredClone(widgets)
    styled[0]!.textStyle = {
      size: 32,
      color: '#123abc',
      weight: 700,
      align: 'center',
      lineHeight: 1.25,
    }
    expect(validateSharedWidgets(styled, 'job')[0]?.textStyle).toEqual(styled[0]?.textStyle)
  })
  it('validates dates, strips surrounding title spaces and sorts them', () => {
    expect(
      validateSharedCalendar([
        { id: 'late', title: ' Review ', date: '2026-10-10' },
        { id: 'early', title: 'Start', date: '2026-10-03' },
      ]).map((e) => e.id),
    ).toEqual(['early', 'late'])
    expect(() =>
      validateSharedCalendar([{ id: 'bad', title: 'Bad', date: '2026-02-30' }]),
    ).toThrow()
    expect(() =>
      validateSharedCalendar([
        { id: 'bad', title: 'Bad', date: '2026-10-03', ownerUid: 'another-user' },
      ]),
    ).toThrow()
  })
  it('resolves only supported variables and never evaluates executable expressions', () => {
    const context = {
      job: { name: '<img src=x onerror=alert(1)>', code: '101' },
      user: { name: 'Pat', role: 'Foreman' },
    }
    expect(resolveDashboardText('{{ job.name }} / {{user.name}}', context).text).toBe(
      '<img src=x onerror=alert(1)> / Pat',
    )
    expect(
      resolveDashboardText('{{ constructor }} {{ user.name.toUpperCase() }}', context).unknown,
    ).toEqual(['constructor', 'user.name.toUpperCase()'])
    expect(
      resolveDashboardText('{{job.name}} {{job.name}}', { user: context.user }).unavailable,
    ).toEqual(['job.name'])
    expect(resolveDashboardText('{{ toString }}', context).unknown).toEqual(['toString'])
  })
})
