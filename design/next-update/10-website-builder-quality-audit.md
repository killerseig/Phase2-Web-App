# Website Builder quality audit

September 23, 2026. Local verification before visual polish and construction of the Phase 2 public site.

## Acceptance standard

The builder should let an administrator create, edit, preview, save and publish a responsive site without losing content or changing unrelated device settings. A large widget catalog alone does not establish that quality. The same content must survive switching editor modes, undo/redo, reload, publication and restoration.

This audit uses local fixtures and Firebase demo emulators. It does not publish a real site, modify production data, send real email, or change existing Jobs pages.

## Findings corrected

| Finding | Change | Regression coverage |
| --- | --- | --- |
| Editing one phone/tablet sizing field copied the effective desktop values into that device's overrides. Later desktop changes could stop flowing through. | Write only the changed sizing overrides. Clearing a field or choosing Use desktop removes its override. | Phone sizing changes, individual reset, later desktop changes, save and reload; Chromium, Firefox and WebKit. |
| In WebKit, closing an inline editor could reveal a floating toolbar under the pointer before a Shift-click completed. The second widget was not selected. | Handle Shift-selection at pointer down and suppress a duplicate toggle on the following click. | Multi-selection followed by keyboard editing, formatting, undo and Escape focus restoration. |
| Editor selection/blur updates could erase an uncommitted font-size entry. | Keep a local input draft while the size field is being edited; validate the input before applying it. | Change typography, finish editing, save, reload and publish, including WebKit. |
| WebKit could not load the script runtime's modules using a CSP based only on self inside an opaque-origin sandbox. | Explicitly allow local development assets and the two existing Phase 2 Firebase Hosting origins for runtime assets. Keep the opaque sandbox, blocked direct connections and parent-mediated form submission. | Script execution and page changes in isolation; preview form blocking and public form submission in all three engines. |
| Two browser-test assumptions hid useful evidence: a removed toolbar selector and host-based keyboard modifiers. | Target the accessible Widget actions group and use the browser's keyboard conventions for editor shortcuts. | Existing scenarios now exercise the current toolbar and Mac-style WebKit shortcuts on the Windows runner. |

The production runtime policy explicitly supports `phase2-website.web.app` and `phase2-website.firebaseapp.com`. Any future custom domain needs an explicit trusted runtime asset origin and a deployment check. This is not a general launch-settings feature.

## Verification

- Website unit suite: 89 tests across 21 files passed.
- Firebase demo-emulator verification passed, including 330 rejection checks, private drafts/images, validated publication, version conflicts, restoration and unpublishing. Email delivery was mocked.
- Full Chromium regression suite: 58 scenarios passed after the fixes, including the new responsive-sizing scenario. The initial baseline's obsolete-toolbar-selector failure is resolved.
- Cross-browser regression checks: 27 passed (nine scenarios each in Chromium, Firefox and WebKit). These cover sizing inheritance, rich text, selection/focus, workspace controls, phone image editing, flow layouts, public forms and isolated scripts. This is targeted coverage, not the entire suite in all browsers.
- `npm.cmd run build` passed: frontend type checking, production assets and Functions compilation. Vite still reports large chunks and plugin timing warnings.
- Targeted ESLint: zero errors; 23 existing conditional-test warnings remain.

Browser tests use intercepted backend responses. They verify browser behavior; the emulator suite separately verifies backend validation and persistence boundaries. Neither substitutes for a staging deployment with the final hosting configuration.

## Capability assessment

| Area | Evidence and remaining boundary |
| --- | --- |
| Editing and layout | Content, Design and Code share the draft. Coverage includes rich text, images, grid transforms, flow containers, layers, shared widgets and mode transitions. Inline editing covers the supported main text/image fields; other widget content uses its inspector or code settings. |
| Responsive behavior | Desktop defaults and device overrides are covered, including sparse sizing overrides and narrow editor viewports. Final page composition still requires phone/tablet review with real content. |
| Save and recovery | Tests cover undo, saved revisions, optimistic version conflicts, restore and explicit publication. This does not establish offline editing or automatic merging of simultaneous administrators' changes. |
| Preview and publication | Tests cover private drafts, published rendering, forms and isolated custom scripts. Arbitrary administrator-authored HTML/CSS/JS can still introduce layout, accessibility or performance problems. |
| Accessibility | Keyboard editing, toolbar navigation and focus return are exercised. Complete screen-reader testing, content contrast and reading-order review remain manual acceptance work. |
| Performance | Production build succeeds, but large-chunk warnings remain. A build is not a performance benchmark; real photography, long pages and slower devices must be measured. |

## Remaining gates before calling it high-end quality

1. Build a representative private acceptance site: navigation/footer, projects with real-sized photos, company/team content, a long page and a contact form. Check wrapping, crops, stacking and reading order at desktop, tablet and phone widths.
2. Run a production-build staging rehearsal: save conflicts, revision restore, publish/unpublish, private asset access and sandboxed scripts under actual hosting headers. Verify form routing with an explicitly authorized test recipient when that stage is approved.
3. Measure initial page load and editor interaction with representative content and slower hardware/network conditions. Use measurements to decide which remaining bundle or rendering costs need work.
4. Review keyboard-only and screen-reader operation, focus visibility, labels, contrast, heading structure and reduced-motion behavior. Validate the authored public pages as well as the editor controls.
5. During the following usability/polish phase, have an owner complete a short edit-and-publish task without coaching. Use observed friction to simplify the interface.

Passing these automated checks supports the functional foundation. It does not yet certify every widget combination, every browser/device, accessibility conformance, or an A-grade finished public site.

## Editing consistency follow-up

Button labels now use the inline rich-text editor, with a destination shortcut that opens the correct field. Individual card, gallery, team, testimonial and list fields target their owning item; the inspector can focus on that item or show all widget content. Dropdown arrows open menus independently of label editing and support keyboard opening and closing. Initial editor focus waits for its DOM to attach, and destination shortcuts center the field in the inspector on phones.

Verification for this pass:

- 94 website unit tests across 23 files passed, including button-label validation, publication formatting, independent copies and item targeting.
- The full Chromium run passed 61 of 62 scenarios initially. A menu-label replacement assertion exposed unreliable direct DOM text replacement in the test. That regression now uses keyboard selection and typing and passes in Chromium, Firefox and WebKit.
- Fifteen focused cross-browser checks passed. Subsequent checks also passed for nested-item undo/redo, dropdown keyboard controls and phone destination visibility after the final adjustments.
- Firebase demo-emulator verification passed with 330 rejection checks and mocked email delivery.
- Targeted lint has zero errors; the 23 existing conditional-test warnings remain. Production build retains the existing chunk-size and plugin-timing warnings.
- Desktop and phone screenshots were reviewed locally. No deployment or production publication was performed.

## Section spacing and height follow-up

Sections now support uniform and per-side padding/margins. Fixed-grid margins reserve space within the allocated frame; flow margins separate neighboring sections. Flow sections, shared-layout navigation/footer widgets and container children support an optional pixel height, a bottom drag handle and the floating Resize action. Device overrides stay sparse. Clearing the height restores automatic sizing. Drag cancellation, history and keyboard adjustments use the existing editing workflow.

Empty navbar descriptions no longer add an editor-only text row. Logos fit the available fixed navbar height. Height keyboard adjustments use authored values to avoid accumulating browser zoom rounding.

Verification: 95 website unit tests passed; production build passed with existing bundle warnings. Both new grid/shared-navbar scenarios passed in Chromium, Firefox and WebKit, covering spacing, resizing, cancellation, undo/redo, responsive overrides, save/reload and public rendering. Existing flow, navigation and floating-toolbar regression checks also passed in those browsers. No deployment performed.

## Inline transform access follow-up

Design-mode text editing now includes the same Move, Resize and Rotate controls as widget selection. Starting a transform finishes the text history group, preserves the text change and transfers keyboard focus to the matching widget control. Content mode keeps formatting controls only, and layout locks still disable transforms.

Verification: five focused Chromium scenarios passed, plus six checks across Chromium, Firefox and WebKit for direct transforms, undo separation, keyboard focus, layout locks and phone toolbar fit. The production build passed. Targeted lint has no errors and retains the 23 existing test warnings. No deployment performed.

Transform button gestures now capture the pointer on the stable preview workspace while the inline toolbar closes, and consume the release click even without a drag. This prevents release events from reaching another widget below the toolbar. Capture is limited to transform buttons so palette buttons retain their normal click-to-add behavior. An overlapping text/background regression covers all three controls. Final verification passed 21 browser checks across Chromium, Firefox and WebKit, including palette actions, cancellation, rotation, height resizing and undo; the production build passed. No deployment performed.

## Direct text selection

Supersedes the transform buttons in the text toolbar. In Design, headings and paragraphs now select independently of their banner/card: eight circular resize handles, a rotation handle, and dragging the text itself. Double-click or Enter edits the text; Content mode retains single-click editing. Widget locks prevent text transforms. Text geometry is validated on the server, included in copies and publication, and restored by undo/redo. Public pages render the geometry without editor controls.

The exact “Build your next chapter” scenario passed in Chromium, Firefox and WebKit, covering movement without changing banner geometry, pointer resizing/rotation, keyboard rotation, cancellation, undo, text editing, save and publication. The full Chromium pass initially passed 60 of 66 cases; the six remaining scenarios passed after updating interaction expectations and stale test selectors. The focused cross-browser pass passed 26 of 27 checks; the remaining navigation test used direct DOM replacement for rich text and now passes in all three engines with keyboard replacement. All 100 website unit tests and the production build passed. Targeted lint has no errors and retains 23 existing test warnings. The selection screenshot was reviewed. No deployment performed.

## Direct image/button controls and alignment assistance

Images and buttons now share the direct selection handles used by text. Design mode selects and transforms the whole element; double-click opens image editing or button-label formatting. Content mode keeps single-click editing. Geometry passes server validation and persists through save, reload and publication. Moving elements shows nearby edge/center guides with mild attraction during quick movement. Whole widgets retain configured grid snapping.

Rotation assistance uses pointer speed: quick motion catches nearby 45-degree alignments, while slow adjustment remains free, including 98 degrees. Alt bypasses snapping and Shift requests 15-degree steps. Pausing or releasing at the same position preserves the last displayed angle. An angle badge identifies a snapped rotation.

Verification: 103 website unit tests passed, including slow/fast rotation, angle wraparound, modifier overrides, alignment tolerance and server validation. Four focused Chromium scenarios and 18 checks across Chromium, Firefox and WebKit passed, covering direct handles, mobile image editing, navigation/footer editing, cancellation, history, save/reload and public rendering. Production build passed with existing bundle-size and plugin-timing warnings. Targeted lint has zero errors and retains the 23 existing test warnings. No deployment or production publication performed.

## Responsive element controls and nested selection

Headings, text, images and buttons now support per-device geometry with sparse tablet/phone overrides. Desktop remains the base; individual resets remove overrides or restore natural desktop placement. Numeric position, dimensions and angle controls appear for the selected element. Image corner resizing and numeric dimensions preserve proportions by default, with a checkbox and pointer Shift override. Keyboard corner resizing follows the lock. Layers expands to show mounted editable elements, including collection items; double-click or Enter reveals and focuses the selected element. Phone pointer movement accounts for the scaled canvas.

Verification: 106 website unit tests passed, plus a focused server publication rerun covering responsive geometry. Fifteen regression checks passed across Chromium, Firefox and WebKit; three additional checks passed for actual pointer movement in scaled phone previews. Coverage includes inheritance, selective resets, undo, proportional resizing, nested selection, save/reload and public rendering. Production build passed. Targeted lint has no errors and retains 23 existing test warnings. No deployment or production publication performed.

## Contextual inspector and selection navigation

The Design inspector now shows content controls for the selected heading, text, image or button, with element placement and responsive padding. Typography uses the existing rich-text editor; button destinations remain separate. Breadcrumbs show page, widget ancestry, collection item and element, and return to parent settings. Right-click offers front-to-back object selection beneath the pointer without changing geometry or stacking. Image cropping returns to the originating selection, and image-library dialogs preserve that selection.

Content stress testing exposed horizontal overflow from long unbroken button labels on narrow screens. Buttons now wrap within their available width. A phone-sized public-page test covers long headings, large type, long body text, long button labels and missing images.

Verification: production build and all 106 website unit tests passed. Twenty-one focused checks passed across Chromium, Firefox and WebKit, including contextual typography, breadcrumbs, overlap selection, content isolation, image cropping, nested cards, responsive geometry, save/publication and narrow-screen rendering. Targeted lint has no errors and retains 23 existing test warnings. Existing build bundle-size/plugin-timing warnings remain. No deployment or production publication performed.
