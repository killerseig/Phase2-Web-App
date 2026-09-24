# Website Builder: editing guide

Open **Website Builder** from the admin navigation. Changes stay in the draft until an admin publishes them.

## Choose the right mode

- **Content:** update existing text, images, links and list entries.
- **Design:** add widgets, arrange the page, and change appearance or responsive settings.
- **Code:** edit HTML, CSS and JavaScript. Keep widget references in the HTML to preserve visual editing.

Switching modes keeps the same draft. It does not publish changes.

Content mode keeps the selected widget's editable content in the right-hand inspector, including fields exposed by custom widgets. Image and button controls are grouped; optional empty groups start collapsed. Expand a group to add content. Image labels used only by the editor, decorative layout fields and the page-layout selector stay in Design mode.

The inspector identifies shared-layout edits because they affect every page using that layout. Editing the exposed content of a linked custom widget changes that placement's values while retaining the shared design. The header shows Unsaved changes, Saving draft, or Draft saved; a failed save retains your edits and displays the error.

In Code mode, **Site settings** exposes site-wide CSS and JavaScript even without a shared layout. Use the page editor for page-specific code. Shared-layout HTML is edited under **Pages → Site layout**.

## Build and edit a page

1. Open **Pages**, then select a page or use **+ Page**. A blank page starts without navigation or a footer; add those as widgets or use a shared site layout.
2. Open **Widgets**. Search by name or purpose, or choose a category. **Clear filters** restores the full catalog.
3. Click a widget to add it below existing content, or drag a supported widget onto the desktop grid.
4. Select the widget. Use **Content** for its text and media, **Appearance** for styling, and **Layout** for position, sizing and containers.
5. On the desktop grid, drag to move, use the edge handles to resize, and drag the rotation handle to tilt the object. Locked widgets and flow layouts limit direct position changes.
6. Use **Layers** to find overlapping objects. The top row is closest to the viewer. Double-click a row to reveal it on the canvas. Layer order and the content order under **Pages → On this page** are separate controls.

Selecting one widget in **Design** shows a compact toolbar beside it. Drag its Move, Resize or Rotate icons, or focus those controls and use arrow keys. Move/resize with Shift uses larger steps; rotation with Shift uses 15° steps, and Home resets rotation. The other icons duplicate, bring to front, send to back, lock/unlock layout, delete, open full settings, or deselect. Deletion still asks for confirmation. Locked widgets and children of locked containers keep their geometry controls disabled; unlock the parent first when needed.

The toolbar stays readable at any canvas zoom and inside the preview area on phones. It hides while text is selected or edited, while editing images, and when its widget is offscreen. Shift-click selects multiple widgets; the group selection toolbar provides duplication, front/back ordering, grouping and deselection. Undo and Redo are available in the main toolbar.

## Use the settings panel

**Appearance** starts with Colors and Spacing and corners. Expand **Text** for fonts and text sizes, or **Advanced style** for borders, opacity and rotation. Image widgets also show **Image** controls; text-only controls are omitted for photos and decorative widgets. In **Layout**, width and height stay visible on the desktop grid; expand **Position and layer** for exact coordinates and stacking order.

The scope label identifies shared content, desktop base styles, or phone/tablet style overrides. Text and images are shared across devices. Desktop styles also apply to other sizes until a setting is overridden. Changing one appearance setting on phone or tablet leaves the others inherited. Use the reset arrow beside a setting to return to its default on desktop, or to its desktop value on phone/tablet. **Reset appearance** clears this device's appearance settings while respecting rotation locks. Visibility, locking and parent-container controls apply across screen sizes; **Hide on mobile/tablet** is device-specific. Undo and Redo also work for resets.

## Edit text on the page

In **Design** mode, click a heading or paragraph to select the text itself. Drag the text to move it within its widget, drag one of the eight resize circles to change its text box, or drag the rotation handle above it. These changes apply to that text, independently of its banner or card. Double-click the text (or press Enter while focused) to edit the words and formatting. In **Content** mode, a single click still starts text editing. Shift-click selects whole widgets for group operations. Locked widget layouts allow text editing but prevent text movement.

The floating toolbar opens as a compact strip with paragraph/heading style, bold, italic, underline, links, lists, clear formatting and a checkmark to finish. Use the **three-dot More formatting** button for font family/size, text/highlight colors, strikethrough, subscript/superscript, inline code, alignment, line spacing, indentation and undo/redo. Body text also supports heading levels 1–6, nested lists, quotes, code blocks and horizontal rules. Opening More preserves your text selection. On small screens the strip wraps and expanded controls can scroll.

Widget headings have the same character and alignment controls; paragraph/list controls are disabled because the widget heading remains a single line. Select words before applying character formatting or links. Use Increase/Decrease indent inside a list to nest or lift a list item. Shift+Enter adds a line break in body text. Pasted content uses plain text so outside styling is not imported.

For text with richer formatting, the sidebar offers **Edit formatted text** or **Edit formatted heading**. These open the same editor and preserve styles while you change words. Font/color changes stay with the selected text and do not change other widgets or site-wide settings.

Click **Done**, press Escape, or click elsewhere to finish. Enter also finishes a widget heading. While typing, selection and arrow keys operate on text instead of moving widgets. Tab moves to the formatting controls. The sidebar updates with your edits; after finishing, the main Undo button can undo that editing session. Save draft and Publish retain their separate meanings.

Inline editing supports the main heading and body text in hero, text, image/text, contact, gallery and cards widgets, plus the brand name and body text in navigation/footer widgets. Individual collection items, compact cards, captions, button labels and custom HTML continue to use their existing sidebar/code controls.

## Edit images on the page

In **Content** mode, click a photo to open its image editor. In **Design**, click to select the photo, drag it to move, or use its resize circles and rotation handle. Double-click to open the image editor. Keyboard users can focus the photo and press Enter or Space. Choose a replacement from the library, upload a new image, or change its image description (alt text). Each photo in a gallery, card or other image collection can be edited independently.

Open **Crop and focal point** to adjust zoom and framing. Click a point on the original image or use the focal-point sliders; arrow keys on the original move the focal point in 5% steps. The small cropped preview and the canvas update immediately. **Reset crop** restores centered framing without removing captions or overlay effects. Cropping retains the original upload.

Click **Done** to return to widget settings. Changes support Undo/Redo and stay in the draft until saved and published. Shift-click continues to select widgets in Design mode. On phones, clicking a photo opens the Editor panel; use Preview to return to the canvas. Images inside custom coded or linked widgets continue to use their existing settings.

## Adjust section height and spacing

Changing a grid section's height now shifts the rows below it by the same amount, preserving their gaps and column positions. This follows the resize live and applies to drag handles, the floating Resize control, and the Height field. Escape cancels the entire drag; Undo/Redo restores the resized section and following rows together. Widgets beside or overlapping the section keep their positions, as do locked widgets. Moving a widget or changing only its width does not shift later rows. Flow layouts continue to move following content naturally.

In **Design**, select the navbar or another widget. Drag its resize handles, or drag the floating **Resize widget** control. Shared site layouts and flow layouts have a bottom height handle; their width continues to follow the page. Up/Down on that handle or the floating Resize control changes height by 1 pixel; Shift uses 10 pixels. Escape cancels a drag, and Undo restores the previous size.

Open **Appearance ? Spacing and corners** for padding and margin. Padding is inside the section; margin is outside its content. Expand **Individual spacing sides** to set the top, right, bottom or left separately. Side values override the all-sides value. Reset a side to use the default or inherited setting again. In a fixed grid, margins use space inside the widget's allotted frame; in flow layouts, they add space between neighboring sections.

For flow layouts and container children, **Layout ? Height (px)** sets an exact height. Clear it to fit the content again. Minimum height still applies if set. Choose a phone/tablet preview to set its own height or spacing while retaining desktop settings. A navbar's logo adapts to available height, and an empty description no longer adds a placeholder row to the navbar preview.

## Edit buttons and individual items

In Content mode, click a button label to edit and format it directly. In Design, click to select the whole button and use the same movement, resize circles and rotation handle as text and images; double-click or press Enter to edit its label. Use **Edit link destination** in the text toolbar to open that button's destination field. Button labels support formatting and are limited to 80 characters; the destination applies to the whole button. Editing a plain button label in the inspector clears its previous inline formatting.

## Alignment assistance

Dragging text, images or buttons shows guides near matching edges and centers within their widget. Quick movement gives a light snap; slow movement allows precise placement. Whole widgets retain the page's configured grid snapping and show alignment guides against neighboring widgets and the canvas.

Quick rotation snaps near common 45-degree alignments. Rotate slowly to choose any angle, including 98 degrees. Hold Alt to bypass rotation snapping, or Shift to explicitly use 15-degree steps. The angle appears while rotating, with a marker when snapped. Arrow keys on the rotation handle adjust by one degree, or 15 degrees with Shift. Escape cancels the gesture, and Undo restores the previous placement.

## Precise placement and responsive elements

The inspector follows the element selected in Design mode. Headings and text show their content and a Format action for typography; buttons show their label and destination; images show replacement, description, appearance and cropping controls. Placement settings apply to that element, including its own padding. Parent widget settings remain accessible through the breadcrumb above the inspector. Content and formatting are shared across screen sizes; placement and padding support device overrides.

The breadcrumb shows the page, containing widgets, collection item when applicable, and selected element. Click a parent widget to edit its settings. Right-click the canvas to see **Select object** entries for elements and widgets beneath the pointer, listed front to back. Selecting an entry reveals and focuses it without changing its stacking order or position. The menu supports arrow keys and Enter; Escape closes it.

Selecting a heading, text block, image or button in Design shows its placement controls at the top of the inspector. Enter X/Y offsets, width, height or an angle directly. Width and height display an Auto placeholder until explicitly sized. Position uses pixel offsets from the element's normal location within its widget.

Desktop values are the base layout. Choose Tablet or Mobile before making device-specific changes. Only changed values become overrides, so remaining settings continue to follow desktop. Preview each screen size after arranging the page. The published website uses the matching device settings too.

Reset position, size or angle independently, or use Reset all. On desktop, these restore natural placement, automatic sizing and zero rotation. On tablet/phone, they remove overrides and follow desktop again. Undo/Redo includes these changes. Clearing an individual measurement resets just that value.

Images start with Keep proportions enabled. Corner handles and numeric width/height edits retain the current frame proportions; side handles allow adjusting a single dimension. Hold Shift while dragging a corner to temporarily toggle the proportion lock. The checkbox also works for text and buttons. Keyboard arrows on a corner handle respect the lock; Shift makes keyboard adjustments larger.

In Layers, expand a widget to list its editable elements. Click a heading, text block, image or button to select that element. Collection entries include their item names. Double-click or press Enter to scroll to and focus it on the canvas. Widget drag handles continue to change widget stacking order; the nested list selects elements without changing their content order.

Click a card's heading, description, image or button to edit that part. This also works for gallery captions, staff cards, testimonials and lists. The inspector focuses on that item; **Show all widget content** returns to the complete widget. Each item's edits remain independent of its neighbors. Changes support Undo/Redo and persist when saved. Numeric data, subtitles and specialized widget controls remain in the inspector.

## Edit navigation and footers

Navigation and footer widgets use the same Content, Appearance and Layout controls as other widgets. Click their brand name or body text for inline formatting, or click the logo for the image editor. Click any menu label to edit its text and formatting on the page, including automatic page links, Employee Login, dropdown headings and dropdown links. Use the separate dropdown arrow to reveal its children without editing the label. The arrow also works with Enter or Space; Escape closes the dropdown. The text toolbar's **Edit link destination** button opens the corresponding menu settings. Destinations remain separate from text formatting, and links work normally for visitors after publication.

Automatic page/login label edits apply only to this widget; they do not rename pages or change URLs. **Use page titles for links** and **Use default login label** restore their original wording. Custom labels also remain editable in the inspector; changing a plain label there clears its previous inline formatting. Labels are limited to 80 characters.

Brand names and logos initially follow Site settings. Editing a widget's brand name or logo creates a local override; other widgets keep their existing values. **Use website name** restores the default name. In the **Logo** group, removing a local logo restores the website logo. **Widget name** labels the widget in the editor; **Brand name** is the visible name. For headers/footers in a shared site layout, edit that layout to update its appearances across pages.

## Preview at different sizes

The monitor, tablet and phone buttons select the preview device. **Fit** scales the page to the available canvas and follows panel resizing. Plus/minus and the percentage button switch to manual zoom; click **Fit** to resume automatic fitting. Zoom changes your view, not the website layout.

On desktop, the canvas toolbar can hide either side panel or both. On a phone, use **Pages & sections**, **Preview**, and **Editor** to switch work areas.

## Reuse work

- A **shared site layout** places the same navigation/footer around pages that use it. Keep its page-content slot; this is where each page appears.
- A **linked custom widget** shares a reusable design between placements. Exposed content settings can vary per placement.
- An **independent copy** can be edited separately from its original.
- Saved sections let you insert a previously assembled group of widgets.

## Save and publish

1. Click **Save draft**. Visitors still see the last published version.
2. Open **Publishing**. Red-marked checks must be fixed. Suggestions can be reviewed without blocking publication.
3. Select a check to open the relevant page, widget, shared layout or site settings. Checks update as you edit.
4. Save again after correcting issues, review device previews, then click **Publish** and confirm.

The publishing panel also contains saved draft history and recovery actions. Restoring a revision changes the draft; review it before publishing. Reloading the draft can discard local changes after confirmation.

For public forms, configure recipients in the form editor. Preview submissions do not send email. Code runs only when explicitly started in code preview; publishing makes configured code part of the public page.

## Local verification versus release

The development tests use mocked website services or local emulators. They do not deploy changes, publish company content, or send real email. Production deployment, actual company content, and a review of that content on real devices are separate release activities.
