import { afterEach, describe, expect, it } from 'vitest'
import {
  findNextGridTimecardInput,
  findNextTimecardInputByGeometry,
  focusAndSelectTimecardInput,
  getTimecardNavigationDirection,
  isTimecardNavigableInput,
  shouldUseHorizontalTimecardNavigation,
} from '@/features/timecards/workbookNavigation'

function appendSheet() {
  const sheet = document.createElement('div')
  sheet.className = 'timecard-card__sheet'
  document.body.append(sheet)
  return sheet
}

function createInput(
  sheet: HTMLElement,
  id: string,
  rowStart?: number,
  rowEnd?: number,
  col?: number,
) {
  const input = document.createElement('input')
  input.id = id
  input.className = 'timecard-grid__input'
  if (rowStart != null) input.dataset.navRowStart = String(rowStart)
  if (rowEnd != null) input.dataset.navRowEnd = String(rowEnd)
  if (col != null) input.dataset.navCol = String(col)
  sheet.append(input)
  return input
}

function setRect(input: HTMLElement, rect: Partial<DOMRect>) {
  input.getBoundingClientRect = () => ({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    left: rect.left ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? ((rect.left ?? 0) + (rect.width ?? 0)),
    bottom: rect.bottom ?? ((rect.top ?? 0) + (rect.height ?? 0)),
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON: () => ({}),
  })
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('timecard workbook navigation helpers', () => {
  it('maps supported arrow keys to navigation directions', () => {
    expect(getTimecardNavigationDirection('ArrowUp')).toBe('up')
    expect(getTimecardNavigationDirection('ArrowDown')).toBe('down')
    expect(getTimecardNavigationDirection('ArrowLeft')).toBe('left')
    expect(getTimecardNavigationDirection('ArrowRight')).toBe('right')
    expect(getTimecardNavigationDirection('Tab')).toBeNull()
    expect(getTimecardNavigationDirection('Enter')).toBeNull()
  })

  it('recognizes only timecard workbook inputs as navigable targets', () => {
    const sheet = appendSheet()
    const gridInput = createInput(sheet, 'grid')
    const headerInput = document.createElement('input')
    headerInput.className = 'timecard-card__header-input'
    const textarea = document.createElement('textarea')
    textarea.className = 'timecard-card__footer-input'
    const unrelated = document.createElement('input')
    unrelated.className = 'plain-input'
    sheet.append(headerInput, textarea, unrelated)

    expect(isTimecardNavigableInput(gridInput)).toBe(true)
    expect(isTimecardNavigableInput(headerInput)).toBe(true)
    expect(isTimecardNavigableInput(textarea)).toBe(true)
    expect(isTimecardNavigableInput(unrelated)).toBe(false)
    expect(isTimecardNavigableInput(null)).toBe(false)
  })

  it('only uses horizontal arrow navigation when the cursor is at the edge or the value is selected', () => {
    const sheet = appendSheet()
    const input = createInput(sheet, 'current')
    input.value = '12345'

    input.setSelectionRange(2, 2)
    expect(shouldUseHorizontalTimecardNavigation(input, 'left')).toBe(false)
    expect(shouldUseHorizontalTimecardNavigation(input, 'right')).toBe(false)

    input.setSelectionRange(0, 0)
    expect(shouldUseHorizontalTimecardNavigation(input, 'left')).toBe(true)
    expect(shouldUseHorizontalTimecardNavigation(input, 'right')).toBe(false)

    input.setSelectionRange(5, 5)
    expect(shouldUseHorizontalTimecardNavigation(input, 'left')).toBe(false)
    expect(shouldUseHorizontalTimecardNavigation(input, 'right')).toBe(true)

    input.setSelectionRange(0, 5)
    expect(shouldUseHorizontalTimecardNavigation(input, 'left')).toBe(true)
    expect(shouldUseHorizontalTimecardNavigation(input, 'right')).toBe(true)
  })

  it('focuses and selects editable timecard inputs without stealing focus from locked fields', () => {
    const sheet = appendSheet()
    const editable = createInput(sheet, 'editable')
    editable.value = '8.00'
    const disabled = createInput(sheet, 'disabled')
    disabled.disabled = true

    focusAndSelectTimecardInput(editable)

    expect(document.activeElement).toBe(editable)
    expect(editable.selectionStart).toBe(0)
    expect(editable.selectionEnd).toBe(editable.value.length)

    focusAndSelectTimecardInput(disabled)

    expect(document.activeElement).toBe(editable)
  })

  it('uses grid metadata to choose the nearest valid input in each arrow direction', () => {
    const sheet = appendSheet()
    const current = createInput(sheet, 'current', 10, 12, 4)
    const upSameColumn = createInput(sheet, 'up-same-column', 6, 8, 4)
    createInput(sheet, 'up-closer-different-column', 8, 9, 5)
    const downSameColumn = createInput(sheet, 'down-same-column', 13, 15, 4)
    const leftOverlap = createInput(sheet, 'left-overlap', 11, 11, 3)
    createInput(sheet, 'left-no-row-overlap', 13, 13, 2)
    const rightOverlap = createInput(sheet, 'right-overlap', 10, 12, 6)
    const disabledRight = createInput(sheet, 'right-disabled', 10, 12, 5)
    disabledRight.disabled = true

    expect(findNextGridTimecardInput(current, 'up')).toBe(upSameColumn)
    expect(findNextGridTimecardInput(current, 'down')).toBe(downSameColumn)
    expect(findNextGridTimecardInput(current, 'left')).toBe(leftOverlap)
    expect(findNextGridTimecardInput(current, 'right')).toBe(rightOverlap)
  })

  it('returns null for grid navigation when the active input has no metadata or sheet', () => {
    const orphan = document.createElement('input')
    orphan.className = 'timecard-grid__input'
    const sheet = appendSheet()
    const missingMetadata = createInput(sheet, 'missing-metadata')

    expect(findNextGridTimecardInput(orphan, 'down')).toBeNull()
    expect(findNextGridTimecardInput(missingMetadata, 'down')).toBeNull()
  })

  it('falls back to element geometry when grid metadata cannot decide the next input', () => {
    const sheet = appendSheet()
    const current = createInput(sheet, 'current')
    const nearRight = createInput(sheet, 'near-right')
    const farRight = createInput(sheet, 'far-right')
    const above = createInput(sheet, 'above')

    setRect(current, { left: 100, top: 100, width: 20, height: 20 })
    setRect(nearRight, { left: 140, top: 104, width: 20, height: 20 })
    setRect(farRight, { left: 220, top: 100, width: 20, height: 20 })
    setRect(above, { left: 100, top: 40, width: 20, height: 20 })

    expect(findNextTimecardInputByGeometry(current, 'right')).toBe(nearRight)
    expect(findNextTimecardInputByGeometry(current, 'up')).toBe(above)
    expect(findNextTimecardInputByGeometry(current, 'left')).toBeNull()
  })

  it('ignores disabled elements during geometry fallback navigation', () => {
    const sheet = appendSheet()
    const current = createInput(sheet, 'current')
    const disabledNearRight = createInput(sheet, 'disabled-near-right')
    const enabledFarRight = createInput(sheet, 'enabled-far-right')

    disabledNearRight.disabled = true
    setRect(current, { left: 100, top: 100, width: 20, height: 20 })
    setRect(disabledNearRight, { left: 130, top: 100, width: 20, height: 20 })
    setRect(enabledFarRight, { left: 180, top: 100, width: 20, height: 20 })

    expect(findNextTimecardInputByGeometry(current, 'right')).toBe(enabledFarRight)
  })
})
