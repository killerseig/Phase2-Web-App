
import { describe, expect, it } from 'vitest'
import { validatePersonalTasks, validateSharedWidgets, sharedWidgetTypes, defaultSharedWidgets } from '../../functions/src/sharedDashboardModel'
describe('private personal tasks contract', () => {
  const task = { id: 'one', title: ' Review plans ', done: false }
  it('allows tasks only on personal layouts', () => {
    expect(sharedWidgetTypes('personal')).toContain('tasks')
    for (const scope of ['role', 'job'] as const) {
      expect(sharedWidgetTypes(scope)).not.toContain('tasks')
      expect(() => validateSharedWidgets([...defaultSharedWidgets(scope), { id: 'tasks', type: 'tasks', span: 6, title: '', text: '' }], scope)).toThrow()
    }
  })
  it('trims titles and preserves order/completion without changing input', () => {
    expect(validatePersonalTasks([task, { id: 'two', title: 'Done', done: true }])).toEqual([{ ...task, title: 'Review plans' }, { id: 'two', title: 'Done', done: true }])
    expect(task.title).toBe(' Review plans ')
    expect(validatePersonalTasks([])).toEqual([])
  })
  it.each([null, {}, [task, task], [{ ...task, done: 'true' }], [{ ...task, title: ' ' }], [{ ...task, title: 'x'.repeat(201) }], [{ ...task, ownerId: 'someone' }], [{ ...task, id: '../other' }], Array.from({length: 101}, (_, i) => ({...task, id: String(i)}))])('rejects malformed or unbounded input %#', value => {
    expect(() => validatePersonalTasks(value)).toThrow()
  })
})
