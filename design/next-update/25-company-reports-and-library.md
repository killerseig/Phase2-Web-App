# Company reports and library: local implementation, October 10

Scope: existing personal Phase 2 project. No deployment, form publication,
production record changes, security changes, credential provisioning or email.
The previously blocked builder-release checkout is separate and unchanged.

## Implemented locally

- Permanent Reports and Company Library links in the current AppShell workspace
  navigation, alongside unchanged Jobs. Routes require existing workspace login;
  they add no role, edit or record permissions. Login return targets include them.
- Reports lists existing published, nonarchived forms allowed by the existing
  respondent policy, with search/loading/empty/error states. It links the original
  /forms/<templateId> workflow. Admin authoring remains /admin/forms. The current
  template list endpoint has a 100-template bound; this is not a claim of unlimited
  discovery or administrator-wide entry visibility.
- Company Library offers SDS, Safety and AHA. SDS uses the existing compact,
  searchable Documents explorer. Safety/AHA reuse existing top-level folders named
  Safety/AHA and the same explorer/preview. Missing folders are explicitly shown
  as unconfigured; no files, category data, AHA activities or questions are invented.
  Existing upload/edit controls and backend permissions remain authoritative.
- The Committee, BBS and General Site Visit local starter configurations reuse
  the source-faithful native definitions. A generic delivery helper appends only
  the requested optional recipient control, and selects the all-answer layout.
  All original fields/order, wording, repeat stops and access policy remain intact.
  No fixed recipients are invented. Near Miss is unchanged and deferred.
- Form Builder output settings can apply the same configuration to an existing
  selected draft. This edits the local draft only until an authorized user saves.
  Existing saved production templates were not changed by this implementation.
- HTML email thumbnail/gallery URLs now address the exact repeat stop/photo row.
  The private viewer supplies matching anchors and scrolls after loading. It still
  checks entry/photo access server-side; emails do not grant private gallery access.

## Reused delivery implementation

formEmailContent uses prepareDailyLogInlinePhotos and buildSubmissionEmailRouting;
formDelivery uses the existing sendEmail Graph transport. Answers are escaped and
rendered from the immutable submitted version. Photo CID thumbnails have bounded
byte/dimension budgets and validated record/owner/field/repeat-instance storage
references. Fallback HTML retains a private-gallery link. No public storage URLs
are inserted. Email delivery state/transactional claims prevent automatic repeated
send attempts; uncertain provider results require reconciliation rather than blindly
retrying. Submission retention is separate from delivery success.

Recipient fields validate addresses, deduplicate and enforce the existing caps.
Fixed/job groups are combined with selected recipients. Public extra recipients
must have exact-address verification proofs; unverified answers cannot become an
arbitrary outbound mail relay. Recipients acquire no viewer rights automatically.
The public verification endpoint is prepared, not confirmed live.

The sender is the existing OUTLOOK_SENDER_EMAIL secret used by the Daily Log
transport. No secret value was read and no configuration changed. The requested
no-reply@phase2co.com sender is therefore not independently verified. Revised
email handlers are local; their prior deployment was not part of the three-core
release. They currently also bind FORM_TRANSLATION_API_KEY: keep that separate
provisioning/release dependency visible rather than silently deploying or creating it.

## API contract and readiness

Local exported HTTP endpoint: scopedIntegrationApi. POST only; Authorization:
Bearer <keyId>.<secret>. JSON envelope: requestId (UUID), operation, optional
resourceId/folderId, and payload object. Existing scopes/resources, unexpired
nonrevoked hashed credential, and an existing active Admin actor are required.
No credential-provisioning route exists. No key was created or supplied to Laura.

| Operation | Scope | Payload / boundary |
| --- | --- | --- |
| forms.draft.create | forms:draft:write | definition; optional resourceId defaults to requestId; no overwrite or publication |
| forms.draft.update | forms:draft:write | definition and current revision; existing form must be explicitly granted |
| sds.metadata.update | sds:metadata:write | name/manufacturer/productCode/language/version; document must belong to granted folder; cannot rewrite file revision date |
| sds.upload.stage | sds:upload:stage | PDF base64, expectedSize, expectedSha256, originalName; readable PDF <=20 MB, validated against size/hash; granted existing folder |
| sds.upload.finalize | sds:upload:commit | uploadId, explicit create/revision mode and reviewed metadata/version; staging binds key/actor/folder, expiry and revalidated PDF; immutable revision behavior |

Request-ID payload fingerprints support replay of completed results and reject
conflicting reuse/pending or failed writes without blindly repeating them. Quotas:
60 requests/hour and 100 MiB/hour per key; 29 MiB raw request limit. Unknown keys
do not create unlimited audit records. Failures return bounded messages rather
than internal details. There are no publish, user/role/security or delete operations.

Status: implementation and local mocked authorization/schema/policy/quota tests
pass. Follow-up HTTP + Firestore/Storage demo-emulator integration passed **40
checks**, using disposable synthetic fixtures and no usable production credentials.
Emulators were shut down after success. Production endpoint, credentials, network/IAM and real acceptance
are unverified; last captured deployment inventory did not contain this API.
Do not tell Laura that the API or revised sending is live or usable yet.

## Verification and remaining acceptance

Both compilers passed. The stubbed repeat email/photo ownership preparation test
passed with no storage/network/send operations. Eight initial focused UI/source
checks passed. The first full run had one new test-hook failure (1,787 passing);
focused diagnosis found the UI handled errors correctly. Test hooks had returned
mockReset's function, registering an unintended rejected teardown call; corrected.
Final full suite: **374 files / 1,791 tests passed**. Vue and Functions compilers
passed; production build passed. No failures remain in the completed checks.

Changed source groups: companyReports/reportingStarters and their source-fidelity
tests; companyGallery test; appShellNavigation and its test; authViewHelpers;
router/index; ReportsView and CompanyLibraryView with UI tests; SdsExplorerModule
initial-folder input; FormOutputSettings delivery helper control;
FormSubmissionView gallery anchors; functions/src/formEmailRender repeat targets.
Compiler output for the modified email renderer was regenerated locally.

187 core business/auth/bootstrap files remain byte-identical to the preserved
original checkout. Sources and existing permissions were preserved; only authorized
navigation/return targets and Documents initial-folder plumbing changed shared UI.

Follow-up gallery/API unit tests passed **14 tests** in four files. They verify
per-photo viewer requests and deny entry/photo access without rendering private
content. This mocked boundary test is distinct from genuine browser sign-in.

Unrun: real signed-in browser acceptance, real submission, actual delivery/sender
verification, publication, production gallery/PDF access
and production API acceptance. Those must not be replaced with production test
records or emails under this local scope. Safety/AHA category contents and maintainer
mapping still need genuine source/folder evidence before claiming populated lists.

Live read-only gallery acceptance needs an existing signed-in browser session and
an existing submitted entry with photos accessible to that account. No session
has been supplied/verified for this test. No new credentials or production records
are necessary. Local browser-emulator acceptance instead needs Auth/Firestore/
Storage emulators and an isolated guarded demo UI harness; the current native
browser script is bound to port 5173, so it must not replace the ordinary dev app.

The final denied status command was:
git -C 'C:\Users\atlas\OneDrive\Documents\GitHub\Phase2-Web-App' status --short
It returned: fatal: cannot change to that path: Permission denied. This was a
filesystem/process access error, not an automatic-review deployment rejection.
It was not retried. The successful 187-file byte comparison is separate evidence.

Evidence: .forms-local-data/release-baseline/oct10-company-regression-final.log,
oct10-company-build.log and overnight-scope-verification.json; focused specs beside
ReportsView, CompanyLibraryView, companyReports and companyGallery. Existing API
specs: apiScopePolicy.spec.ts, integrationApiRequest.spec.ts and integrationApi.spec.ts.
Follow-up logs: oct10-gallery-api-followup.log and oct10-api-emulator.log.
