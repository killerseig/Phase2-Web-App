import type { BuilderHelpGroup } from '@/components/builder/BuilderHelpDialog.vue'

export const commandKey =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl'
export const editorHelp: BuilderHelpGroup[] = [
  {
    title: 'Choose what to edit',
    items: [
      {
        action: 'Content mode',
        detail: 'Click supported text or an image to edit it. Layout controls stay out of the way.',
      },
      {
        action: 'Design mode',
        detail:
          'Click to select a widget or an element inside it. Double-click text, an image or a button to edit its content.',
      },
      {
        action: 'Code mode',
        detail:
          'Edit page HTML and page or site CSS/JavaScript. Site code applies across the website.',
      },
      {
        action: 'Follow a site menu link',
        detail:
          'Click an internal navbar or footer link to visit its page in the builder. Double-click or press F2 to edit the label; Enter follows the link.',
      },
      {
        action: 'Select several widgets',
        keys: 'Shift + click',
        detail:
          'In Design, add or remove widgets from the selection. Drag empty canvas space to select an area.',
      },
      {
        action: 'Find an overlapping object',
        keys: 'Right-click',
        detail:
          'Use the canvas menu to choose an object underneath the pointer, or select it in Layers.',
      },
      {
        action: 'Find a layer',
        keys: 'Double-click / Enter',
        detail: 'In Layers, reveal the selected widget or element on the canvas.',
      },
    ],
  },
  {
    title: 'Widget shortcuts',
    items: [
      {
        action: 'Undo / redo',
        keys: `${commandKey} + Z / ${commandKey} + Shift + Z`,
        detail: 'Undo or redo draft edits while focus is in the workspace.',
      },
      {
        action: 'Copy / paste',
        keys: `${commandKey} + C / V`,
        detail: 'In Design, copy selected widgets and paste them within this editor.',
      },
      {
        action: 'Duplicate',
        keys: `${commandKey} + D`,
        detail: 'In Design, make independent copies of selected widgets.',
      },
      {
        action: 'Select all',
        keys: `${commandKey} + A`,
        detail: 'In Design, select visible widgets on the current page.',
      },
      {
        action: 'Remove widgets',
        keys: 'Delete / Backspace',
        detail:
          'With widgets selected, review the removal confirmation. Inside text fields, keys edit text normally.',
      },
      {
        action: 'Cancel a drag',
        keys: 'Escape',
        detail:
          'Restore the position from before the drag. Escape also closes menus and exits editing.',
      },
    ],
  },
  {
    title: 'Move, resize and rotate',
    items: [
      {
        action: 'Direct controls',
        detail:
          'In Design, drag selected text, images or buttons to move them. Use the edge/corner circles to resize and the rotation handle to turn them.',
      },
      {
        action: 'Keyboard adjustments',
        keys: 'Arrow keys',
        detail:
          'Focus a move, resize or rotation handle first. Shift makes larger adjustments; Home resets a focused rotation handle.',
      },
      {
        action: 'Precise rotation',
        keys: 'Alt / Shift',
        detail:
          'Slow rotation stays precise. Faster motion can snap near 45° alignments. Alt bypasses rotation assistance; Shift uses 15° steps.',
      },
      {
        action: 'Element alignment',
        keys: 'Alt while dragging',
        detail:
          'Bypass alignment guides and snapping when moving elements or widgets. Nearby guides snap the selection while dragging. Page settings control the underlying widget grid.',
      },
      {
        action: 'Reorder layers',
        keys: 'Alt + Up / Down',
        detail:
          'Focus a widget row in Layers to raise or lower it within its container. This changes stacking, not page content order.',
      },
    ],
  },
  {
    title: 'Workspace and saving',
    items: [
      {
        action: 'Resize panels',
        keys: 'Drag / Arrow keys',
        detail:
          'Drag a divider beside the canvas, or focus it and use arrow keys. Shift uses larger steps. Enter or double-click resets its width.',
      },
      {
        action: 'Screen-size settings',
        detail:
          'Desktop provides base styles. Tablet and Phone overrides affect only that screen size. Text and images are shared across sizes.',
      },
      {
        action: 'Save versus publish',
        detail:
          'Draft edits save automatically and keep a browser recovery copy when available. Publish separately when the saved draft is ready to go live.',
      },
      {
        action: 'Open this guide',
        keys: '?',
        detail:
          'Press ? in the builder outside a text field, or use the help button in the header.',
      },
    ],
  },
]
