import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { answerFingerprint, hydrateDraftAnswers } from './formDirtyState'
import { newTemplate, type FormTemplate } from './model'
import { useFormAuthoring } from './useFormAuthoring'
describe('form dirty baselines', () => {
  it('keeps hydrated defaults and reordered objects clean, but catches real edits synchronously', async () => {
    const scope = effectScope(), draft = ref<FormTemplate | undefined>(newTemplate()), dirty = ref(false)
    const history = scope.run(() => useFormAuthoring(draft, dirty))!; history.reset()
    draft.value!.output = { template: '', pdf: false, requireLogin: true }
    await nextTick(); expect(dirty.value).toBe(false)
    dirty.value = true; expect(dirty.value).toBe(false) // No-op control notifications cannot invent edits.
    draft.value!.title = 'Actual edit'; expect(dirty.value).toBe(true)
    history.saved(); expect(dirty.value).toBe(false)
    draft.value = { ...newTemplate(), title: 'Other form' }; history.reset()
    await nextTick(); expect(dirty.value).toBe(false); expect(history.canUndo.value).toBe(false)
    scope.stop()
  })
  it('establishes minimum repeat rows as clean hydration and distinguishes invalid or real answers', () => {
    const definition = { title: 'Visit', description: '', recipients: [], fields: [{ id: 'sites', kind: 'repeat' as const, label: 'Sites', required: false, options: [], minInstances: 1, maxInstances: 3, fields: [{ id: 'notes', kind: 'text' as const, label: 'Notes', required: false, options: [] }] }] }
    const answers = hydrateDraftAnswers(definition.fields, { sites: [] }), baseline = answerFingerprint(definition, answers)
    expect(answerFingerprint(definition, hydrateDraftAnswers(definition.fields, answers))).toBe(baseline)
    expect(answerFingerprint(definition, { sites: [{ instanceId: 'initial-0', answers: { notes: '' } }] })).toBe(baseline)
    expect(answerFingerprint(definition, { sites: [{ instanceId: 'initial-0', answers: { notes: 'Actual edit' } }] })).not.toBe(baseline)
    expect(answerFingerprint(definition, { sites: 'invalid' })).not.toBe(baseline)
  })
})
