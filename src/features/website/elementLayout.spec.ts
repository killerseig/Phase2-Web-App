import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { changeElementBox, resetElementBox, resolveElementBox } from './elementLayout'
import { validateTextBoxes } from '../../../functions/src/websiteTextBox'
import { responsiveSection } from './responsive'
import { newSection, newItem } from './types'
import { copySection } from './pageTools'

describe('responsive element placement', () => {
  it('stores only changed device values and preserves desktop inheritance through reset', () => {
    const original = reactive({ x: 10, width: 600, rotation: 98 })
    const mobile = changeElementBox(original, 'mobile', { x: 10, width: 280, rotation: 98 })
    expect(mobile.devices).toEqual({ mobile: { width: 280 } })
    const desktop = changeElementBox(mobile, 'desktop', { rotation: 45 })
    expect(resolveElementBox(desktop, 'mobile')).toEqual({ x: 10, width: 280, rotation: 45 })
    expect(resolveElementBox(desktop, 'tablet').width).toBe(600)
    expect(resetElementBox(desktop, 'mobile', ['width', 'height'])).toEqual({
      x: 10,
      width: 600,
      rotation: 45,
    })
    expect(resetElementBox(desktop, 'desktop', ['rotation']).devices).toEqual(mobile.devices)
    expect(original).toEqual({ x: 10, width: 600, rotation: 98 })
  })
  it('renders nested item overrides and copies them independently', () => {
    const section = newSection('cards')
    section.items = [
      {
        ...newItem(),
        textBoxes: {
          image: { width: 400, devices: { mobile: { width: 200, lockAspect: false } } },
        },
      },
    ]
    const copy = copySection(section)
    copy.items[0]!.textBoxes!.image!.devices!.mobile!.width = 250
    expect(responsiveSection(section, 'mobile').items[0]!.textBoxes!.image).toEqual({
      width: 200,
      lockAspect: false,
    })
    expect(responsiveSection(section, 'desktop').items[0]!.textBoxes!.image).toEqual({ width: 400 })
  })
  it('validates responsive dimensions and rejects malformed or nested device settings', () => {
    const boxes = {
      image: {
        rotation: 98,
        lockAspect: true,
        devices: { mobile: { width: 220, lockAspect: false }, tablet: { x: 0 } },
      },
    }
    expect(validateTextBoxes(boxes)).toEqual(boxes)
    for (const devices of [
      { phone: {} },
      { mobile: [] },
      { mobile: { width: -1 } },
      { mobile: { devices: {} } },
      { tablet: { lockAspect: 'yes' } },
    ])
      expect(() => validateTextBoxes({ image: { devices } })).toThrow('text layout')
  })
})
