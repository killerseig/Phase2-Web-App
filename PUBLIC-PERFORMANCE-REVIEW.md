# Public website performance review

Updated October 14 on `codex/frontpages-navigation-current`, based on current live commit `e234fb7eb09ce1fbe440856906f7200a5f1c1113`. The old performance checkout is preserved separately. No deployment, website publication, production data write, credential, IAM or infrastructure change occurred during this task. Source and existing uncommitted work in the preserved checkout and other release workspaces were not edited.

## Result

Admin publication now generates real Vue-rendered page HTML from the existing sanitized published representation and stores the page bodies in server-only versioned snapshots. Anonymous HTML requests receive that body, current asset pointers and inert public data in one response. Visitors do not wait for a separate site-content callable before ordinary page content appears. Public pages use a separate entry without the private app bootstrap, lazy service imports, client navigation and a short in-memory public snapshot cache.

Existing shared layouts, authored CSS, widgets, images and script sandbox behavior remain supported. Scripted pages still initialize their content inside the existing browser sandbox; author JavaScript is never executed during publication. Already-published sites and renderer upgrades regenerate public HTML on demand in a bounded process cache until the next approved publication. Regeneration retains the current public asset version.

The navbar bug was reproduced: URL/title/navigation updated while the hydrated shared-layout slot kept Home's body. A page key alone did not resolve it. The public renderer now loads before mounting and creates a client-owned tree from the embedded published data, keeping generated HTML visible until then. Page/publication keys reset page widget/script state. No additional content fetch or document reload is needed. JavaScript-disabled visitors retain the generated HTML.

The October 14 Shop Orders catalog components and all three required browser suites/config remain unchanged. Hosting retains its `test:shop-order-layout` predeploy gate. The live CSS verifier now also recognizes the explicit `employee-app.html` shell while retaining all existing container-query and exact CSS hash checks; both old and new shell paths passed local verification.

The private source `index.html` remains unchanged. The build moves its output to `employee-app.html`, because Firebase Hosting's static index otherwise wins over the public-root function rewrite. Private routes retain the app fallback. Hashed assets are immutable; stable public boot/style pointers and HTML revalidate. Website image caching is permitted only by the function for current versioned public assets. Private data and authentication responses are not cached by this change.

## Paired local measurements

Chromium, 1280x900, simulated 4 Mbps / 80 ms, normal browser cache, identical public content and equal synthetic images. Baseline uses the release source with a test-only local public-read transport substitution. These are local observations, not production promises or field percentiles.

| Measurement | Baseline | Optimized |
| --- | ---: | ---: |
| Cold useful content | 1,408 ms | 1,144 ms |
| Warm useful content | 1,255 ms | 287 ms |
| Company link navigation | 1,268 ms | 210 ms |
| Warm script transfer including HTTP overhead | 108,382 bytes | 361 bytes |
| Navigation keeps document | No | Yes |

Earlier read-only live comparison under similar throttling observed Phase2 cold/warm useful content at 1,720/1,438 ms and Company navigation at 1,415 ms; Study4Wyoming was 608/51 ms and 70 ms. That live investigation used different assets/servers and must not be presented as this change's deployed before/after result.

## Validation

- Full regression: 376 files / 1,799 tests passed after final runtime changes. Both compilers and production client/server builds passed.
- Required Shop Orders gate: all 47 synthetic browser tests passed; CSS/hash verifier passed against legacy and public-HTML root layouts.
- Seven targeted shared-layout, script restart/isolation, public-form preview and desktop/tablet/mobile editor parity browser cases passed. Endpoint mocks now accept the JSON query string; initial failures were fixtures waiting on an unmatched request, not accepted as passing checks.
- New navbar regression: all 144 directed page pairs (72 desktop, 72 mobile) passed against hard loads, with return/back/forward per pair. Compares section count/content/geometry, shared-layout CSS, images, active navigation, title/description, inputs/widgets/frame attributes and removal of previous-page markers. No document replacement and no horizontal overflow. This replaces the inadequate earlier URL-only navigation checks.
- Paired production browser harness: exact visible-text parity for all nine pages; direct deep links; same-document repeated navigation; correct Company body after navbar click; back/forward; 390-pixel mobile overflow check; publication refresh; unpublish redirect; JavaScript-disabled ordinary HTML with heading/images/authored CSS; sandbox script initialization.
- Demo emulator checks cover publication, hidden/draft/private exclusion, image permissions, version conflicts, HTML/JSON legacy protocol, conditional 304, stale-version 410, unknown/removed page 404, unpublish, draft restoration and republished rollback, and obsolete-renderer fallback.
- Business/auth/bootstrap sources remain unchanged from the October 14 baseline. Daily Logs, Timecards, Shop Orders and Users were not changed; no protected business source appears in the diff.

Evidence is local under `.forms-local-data/`: `current-build.log`, `current-regression.log`, `shop-order-gate.log`, `shop-css-verifier.log`, `current-lifecycle.log`, `current-performance.log`, `public-browser-results.json`, `public-navigation-all.log`, `public-navigation-results.json`, `navigation-inspection.json` and `public-widget-browser-final.log`. Review-only benchmark baseline config reads the October 14 `phase2-shop-sizing` checkout without modifying it.

Persistent public review preview: http://127.0.0.1:5822/website. It uses the saved public site snapshot and published-image reads, has no login/emulator requirement, and disables submissions, emails, employee pages, editing and publishing. This is the current-baseline generated-HTML preview; the older 5812 preview should not be used to verify this fix.

## Clean public URLs, completed October 14

Current preview is **http://127.0.0.1:5822/**, with pages such as `/company`, `/services` and `/safety`. Generated page/navigation/canonical links use clean paths. Older `/website` links redirect with query strings and browser fragments preserved. Existing stored drafts are not rewritten; the sanitized public representation normalizes legacy links, including rich text, markdown and supported HTML. Author JavaScript is retained unchanged. Draft copying still recognizes legacy self-links and produces clean links for the new copy.

No current public slug collides with an app route. Existing auth/admin/forms/jobs/reports/library/users/settings/dashboard/export routes remain reserved; the builder rejects reserved public slugs. `/safety` remains public, and `/safety/sds` remains an employee route. Hosting keeps private routes on the employee shell before generic one-segment public routing. Explicit legacy redirects use regex to avoid the Windows emulator's glob normalization; future legacy page links have a function redirect fallback.

Verified: clean-path 144 desktop/mobile page pairs with direct-load, return/back/forward, DOM/CSS/geometry/image/widget/canonical parity; Hosting emulator 301/query redirects and exact employee-shell responses for 13 reserved routes; browser fragment preservation; 377 full regression files/1,802 tests plus 27 focused route/link tests (including the new app-route collision tests); production build; 347 demo lifecycle rejection checks; 47 Shop Orders gate tests. Evidence: `clean-navigation.log`, `hosting-clean-routes-final.log`, `clean-regression-final.log`, `clean-focused.log`, `clean-build-final.log`, `clean-lifecycle-final.log`, `clean-shop-gate.log`.

Read-only Study/live/candidate comparison is in `read-only-site-comparison.json`. Same Chromium, 4Mbps/80ms imposed throttle plus actual server latency, two cold/warm pairs per site/device; mobile is 390px/CPU4x simulation. Live desktop cold FCP/LCP: Study 632/632ms, Phase2 1,134/3,600ms; warm: 84/84ms vs 992/3,246ms. Live mobile cold: 1,138/1,138ms vs 2,444/4,438ms; warm: 238/238ms vs 1,318/3,738ms. Local candidate is separate: desktop cold 318/1,920ms and warm 288/314ms; mobile cold 814/814ms and warm 376/754ms. These paint measurements differ from the earlier DOMContentLoaded-plus-content benchmark and are not a live candidate claim. Startup JS is approximately 61KB Study, 270KB live Phase2 and 92KB candidate; only live Phase2 repeats that script transfer warm. CDP image-cache transfer accounting for Study remains unsuitable for a confident total-wire-byte comparison, so do not quote its warm total-byte column as network traffic.

## Public/private startup isolation

The earlier candidate already deferred Firebase, authentication stores, business views and the rich-text editor. Its shared multi-entry build still retained unused exports/editor gesture/decorative code and private PrimeVue UI styling in the public path. Do not characterize the live 270KB bootstrap as entirely private code.

A separate public build now emits `/public-assets/`, substitutes a read-only text-box layout hook and omits editor handles/guides/rich-editor implementations. The private app/editor build keeps its original implementations. Public CSS retains necessary typography/reset/layout styles and omits private PrimeVue UI styles. A required build-time dependency audit rejects static Firebase/auth/app-store/business-view/Tiptap/PrimeVue/editor imports on the public entry. Public inquiry forms retain their deferred backend transport on user action; this is separate from public startup.

Actual browser requests confirm no private bootstrap/Firebase/editor/business chunks on cold public load. Clicking Employee Login loads the separate private bootstrap and Firebase and shows the login screen, using demo configuration without sign-in or business writes. Nine public pages have identical before/after content and geometry; all 144 desktop/mobile page pairs pass. Full suite: 379 files/1,805 tests; Shop Orders gate: 47 passed; seven shared-layout/script/editor parity cases passed. The existing CSS/hash verifier passes both shell arrangements. All e234fb7 Shop Orders source fixes and its mandatory Hosting gate remain intact.

Matched local before/after (1280px,4Mbps/80ms,normal cache,equal synthetic images): cold script transfer 91,158 -> 71,222 bytes (~22% less), script requests 18 -> 9. Time to public interactivity plus a fixed 200 ms settle: cold 1,420 -> 1,185 ms; warm 601 -> 588 ms. These are small local observations, not production FCP/LCP or field claims. Remaining costs are primarily public Vue/router/widget rendering and public images/fonts. Isolated builds may download a separate Vue runtime when entering the app; that is the deliberate public/private separation tradeoff.

Evidence: `public-build-graph.json`, `public-startup-audit.json`, `public-startup-comparison.json`, `public-startup-final.log`, `isolation-navigation-final.log`, `isolation-regression.log`, `isolation-shop-gate.log`, `isolation-editor-browser.log`, `isolation-shop-css.log`, `isolation-release-build.log`, `isolation-final-focused.log`. Original before-build assets are preserved in `startup-before-dist`. No deployment or publication occurred.

## Remaining operational limits

Deployment is not authorized. A later approved release must coordinate Hosting rewrites, generated renderer/template and the existing `getPublishedWebsite` callable-to-HTTP conversion; the endpoint preserves legacy POST results. The historical October 13 release verifier targets the old shell and is not a verifier for this release.

HTML still uses an existing function and Firestore; platform cold starts and real CDN behavior have not been measured after deployment. The change adds server-only generated snapshot records; older snapshots are retained and have no cleanup policy yet. Published image bytes already cached can remain available for up to five minutes after removal/unpublish. Open visible pages refresh on focus or at 30-second intervals, subject to successful network access. Scripted pages still require JavaScript, and mobile adaptation occurs during client initialization. A previous hashed private-app chunk can be unavailable after a future release; the existing preload-error reload behavior is unchanged.

The benchmark uses synthetic images and desktop network simulation, not real phone hardware, actual live image LCP or authenticated intranet performance. No private app performance claim is made.
