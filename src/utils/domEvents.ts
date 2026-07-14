export function readInputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement ? target.value : ''
}

export function readCheckboxChecked(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement ? target.checked : false
}

export function openNativeDatePicker(event: Event) {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement)) return
  if (typeof target.showPicker !== 'function') return

  try {
    target.showPicker()
  } catch {
    // Some browsers block programmatic picker opening even when the method exists.
  }
}
