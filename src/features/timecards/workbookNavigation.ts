export type TimecardNavigableInputElement = HTMLInputElement | HTMLTextAreaElement
export type TimecardNavigationDirection = 'up' | 'down' | 'left' | 'right'

interface TimecardGridInputMeta {
  rowStart: number
  rowEnd: number
  col: number
}

const TIMECARD_NAVIGABLE_INPUT_SELECTOR = [
  '.timecard-card__inline-input',
  '.timecard-card__header-input',
  '.timecard-card__footer-input',
  '.timecard-grid__input',
].join(', ')

export function isTimecardNavigableInput(
  target: EventTarget | null,
): target is TimecardNavigableInputElement {
  return (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    && target.matches(TIMECARD_NAVIGABLE_INPUT_SELECTOR)
  )
}

export function focusAndSelectTimecardInput(input: TimecardNavigableInputElement) {
  if (input.disabled || input.readOnly) return
  if (document.activeElement !== input) {
    input.focus()
  }
  if (document.activeElement !== input) return
  input.select()
}

export function getTimecardNavigationDirection(key: string): TimecardNavigationDirection | null {
  if (key === 'ArrowUp') return 'up'
  if (key === 'ArrowDown') return 'down'
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  return null
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA <= endB && startB <= endA
}

function getRangeGap(startA: number, endA: number, startB: number, endB: number) {
  if (rangesOverlap(startA, endA, startB, endB)) return 0
  if (endB < startA) return startA - endB
  return startB - endA
}

function getGridInputMeta(input: TimecardNavigableInputElement): TimecardGridInputMeta | null {
  const rowStart = Number(input.dataset.navRowStart)
  const rowEnd = Number(input.dataset.navRowEnd)
  const col = Number(input.dataset.navCol)

  if (!Number.isFinite(rowStart) || !Number.isFinite(rowEnd) || !Number.isFinite(col)) {
    return null
  }

  return { rowStart, rowEnd, col }
}

export function shouldUseHorizontalTimecardNavigation(
  input: TimecardNavigableInputElement,
  direction: 'left' | 'right',
) {
  const selectionStart = input.selectionStart
  const selectionEnd = input.selectionEnd
  if (selectionStart == null || selectionEnd == null) return true

  const valueLength = input.value.length
  const fullySelected = selectionStart === 0 && selectionEnd === valueLength
  if (fullySelected) return true

  if (direction === 'left') {
    return selectionStart === 0 && selectionEnd === 0
  }

  return selectionStart === valueLength && selectionEnd === valueLength
}

export function findNextGridTimecardInput(
  current: TimecardNavigableInputElement,
  direction: TimecardNavigationDirection,
): TimecardNavigableInputElement | null {
  const currentMeta = getGridInputMeta(current)
  if (!currentMeta) return null

  const sheet = current.closest('.timecard-card__sheet')
  if (!(sheet instanceof HTMLElement)) return null

  const candidates = Array.from(sheet.querySelectorAll<TimecardNavigableInputElement>(TIMECARD_NAVIGABLE_INPUT_SELECTOR))
    .filter((input) => input !== current && !input.disabled)
    .map((input) => {
      const meta = getGridInputMeta(input)
      return meta ? { input, meta } : null
    })
    .filter((candidate): candidate is {
      input: TimecardNavigableInputElement
      meta: TimecardGridInputMeta
    } => candidate !== null)

  const scoredCandidates = candidates
    .map((candidate) => {
      if (direction === 'up') {
        if (candidate.meta.rowEnd >= currentMeta.rowStart) return null
        return {
          ...candidate,
          axisPenalty: candidate.meta.col === currentMeta.col ? 0 : 1,
          primaryDistance: currentMeta.rowStart - candidate.meta.rowEnd,
          secondaryDistance: Math.abs(candidate.meta.col - currentMeta.col),
        }
      }

      if (direction === 'down') {
        if (candidate.meta.rowStart <= currentMeta.rowEnd) return null
        return {
          ...candidate,
          axisPenalty: candidate.meta.col === currentMeta.col ? 0 : 1,
          primaryDistance: candidate.meta.rowStart - currentMeta.rowEnd,
          secondaryDistance: Math.abs(candidate.meta.col - currentMeta.col),
        }
      }

      if (direction === 'left') {
        if (candidate.meta.col >= currentMeta.col) return null
        if (!rangesOverlap(candidate.meta.rowStart, candidate.meta.rowEnd, currentMeta.rowStart, currentMeta.rowEnd)) return null
        return {
          ...candidate,
          axisPenalty: 0,
          primaryDistance: currentMeta.col - candidate.meta.col,
          secondaryDistance: getRangeGap(candidate.meta.rowStart, candidate.meta.rowEnd, currentMeta.rowStart, currentMeta.rowEnd),
        }
      }

      if (candidate.meta.col <= currentMeta.col) return null
      if (!rangesOverlap(candidate.meta.rowStart, candidate.meta.rowEnd, currentMeta.rowStart, currentMeta.rowEnd)) return null
      return {
        ...candidate,
        axisPenalty: 0,
        primaryDistance: candidate.meta.col - currentMeta.col,
        secondaryDistance: getRangeGap(candidate.meta.rowStart, candidate.meta.rowEnd, currentMeta.rowStart, currentMeta.rowEnd),
      }
    })
    .filter((
      candidate,
    ): candidate is {
      input: TimecardNavigableInputElement
      meta: TimecardGridInputMeta
      axisPenalty: number
      primaryDistance: number
      secondaryDistance: number
    } => candidate !== null)

  scoredCandidates.sort((left, right) => (
    left.axisPenalty - right.axisPenalty
    || left.primaryDistance - right.primaryDistance
    || left.secondaryDistance - right.secondaryDistance
  ))

  return scoredCandidates[0]?.input ?? null
}

export function findNextTimecardInputByGeometry(
  current: TimecardNavigableInputElement,
  direction: TimecardNavigationDirection,
): TimecardNavigableInputElement | null {
  const sheet = current.closest('.timecard-card__sheet')
  if (!(sheet instanceof HTMLElement)) return null

  const currentRect = current.getBoundingClientRect()
  const currentCenterX = currentRect.left + currentRect.width / 2
  const currentCenterY = currentRect.top + currentRect.height / 2

  const candidates = Array.from(sheet.querySelectorAll<TimecardNavigableInputElement>(TIMECARD_NAVIGABLE_INPUT_SELECTOR))
    .filter((input) => input !== current && !input.disabled)
    .map((input) => {
      const rect = input.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      if (direction === 'up' && centerY >= currentCenterY) return null
      if (direction === 'down' && centerY <= currentCenterY) return null
      if (direction === 'left' && centerX >= currentCenterX) return null
      if (direction === 'right' && centerX <= currentCenterX) return null

      return {
        input,
        primaryDistance: direction === 'up' || direction === 'down'
          ? Math.abs(centerY - currentCenterY)
          : Math.abs(centerX - currentCenterX),
        secondaryDistance: direction === 'up' || direction === 'down'
          ? Math.abs(centerX - currentCenterX)
          : Math.abs(centerY - currentCenterY),
      }
    })
    .filter((
      candidate,
    ): candidate is {
      input: TimecardNavigableInputElement
      primaryDistance: number
      secondaryDistance: number
    } => candidate !== null)

  candidates.sort((left, right) => (
    left.primaryDistance - right.primaryDistance
    || left.secondaryDistance - right.secondaryDistance
  ))

  return candidates[0]?.input ?? null
}
