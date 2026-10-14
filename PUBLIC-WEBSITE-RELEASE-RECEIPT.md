# Verified public website release — October 14, 2026

The approved project release is live at https://phase2-website.web.app/. The reviewed public pages, clean URLs, navigation fix and isolated public startup were released together with their compatible website backend. The current Shop Orders sizing fix was preserved.

- Production source commit: `5ae4dba1175a76af65a0ab5e350b0b6fb5c1d46d` (website implementation and compatible reader: `32cea2a3f378f84f5f265b7caa60c30a334d5fa3`).
- Hosting version: `projects/792793988588/sites/phase2-website/versions/a74a305059c0de35`, released `2026-10-14T22:46:21.068Z`.
- Previous Hosting version: `f2df05ae19323fd5` from the current Shop Orders release.
- Existing website services updated first: `websiteBuilder` → `websitebuilder-00005-nal`; `getPublishedWebsite` → `getpublishedwebsite-00005-qod`; `websiteImage` → `websiteimage-00005-geh`. All are active.
- All 51 other functions have unchanged update times. Runtime identities, secret bindings and selected service invocation policies are unchanged. The deploy guard suppressed redundant identity/IAM operations; no provisioning or IAM write was sent.
- Published website content is unchanged under equivalent URL aliases. The callable reader retains callable POST validation and legacy links while browser requests receive generated HTML. No website publish, form submission, email, business-record write, SDS upload, rules deployment or permission change was performed.

## Validation

Production build and all 379 regression files / 1,806 tests passed before the final callable bridge. The bridge additionally passed eight focused tests and the full 347-check demo publication/privacy lifecycle verification. Hosting reran the required 47 Shop Orders browser tests successfully before releasing.

Live Shop Orders CSS is `/assets/ShopOrdersView-TfnAGeLX.css`, SHA-256 `a117cedbe649000076764eaf222238e3e24629234871538feb8aa3ccd369a39b`. It matches the local production build and the previous live fix; catalog container sizing and its compact-layout query are present. No Shop Orders, Timecards, Daily Logs, Users, authentication, rules or index source was changed from the current `e234fb7` baseline.

Live read-only checks passed for all nine generated public pages, the legacy query-preserving 301 redirect, and five reserved employee routes. Actual browser navigation at 1280px and 390px matched direct page loads for Company, Services and Safety, including back/forward history, clean canonical URLs and no horizontal overflow. Public startup did not request private bootstrap/Firebase code; Employee Login subsequently loaded the separate employee app and displayed the email field. Browser writes were blocked; no sign-in was attempted. The local full navigation gate also passed all 144 desktop/mobile page pairs.

The authenticated live Shop Orders screen was not opened: no existing authenticated browser connection was available. Sizing verification is based on the 47 browser fixture tests, unchanged protected source, and exact delivered CSS hash, rather than a production order interaction.

Evidence is in `.forms-local-data/public-release/`: `functions-deploy.log`, `hosting-deploy.log`, `after.json`, `backend-compatibility.json`, `audit-functions.json`, `audit-hosting.json`, `live-shop-css.log`, `live-readonly-verification.json`, `compatibility-tests.log`, and `compatibility-lifecycle.log`. Public HTML checks explicitly request `Accept: text/html`; the reader also serves negotiated JSON.

The matched post-release live performance comparison with Study4Wyoming has not started. This receipt is the release/Shop Orders checkpoint requested before that comparison.
