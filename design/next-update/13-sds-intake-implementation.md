# Local SDS intake implementation checkpoint

This is local code, not deployment or release evidence. Existing authenticated SDS access and Admin management are preserved. No real SDS files were uploaded.

The master explorer now loads folder/state metadata and bounded document pages. Each request reads at most 500 document records and returns at most 100 matches. Continue with **Load more files**, including when a filtered page contains no results. Search matches name, manufacturer and product identifier case-insensitively. This is a bounded metadata scan, not indexed full-text search or OCR. Document ID cursors have stable ordering but are not a frozen snapshot while other Admins modify the library.

The master capacity is 10,000 documents; saving a document uses an aggregate count rather than loading every document. Job selection and book generation retain their existing limits and full metadata retrieval. Large books and job binders require a separate capacity/performance pass.

Admin opens **Bulk PDF import**, selects a JSON index and matching PDFs, validates the preview, then explicitly starts ingestion into the current folder. The index contract is:

```json
{
  "version": 1,
  "files": [{
    "path": "SelectedFolder/product.pdf",
    "size": 12345,
    "sha256": "64 lowercase hexadecimal characters",
    "name": "Product name",
    "manufacturer": "Manufacturer",
    "productCode": "Product identifier",
    "revisionDate": "2026-01-31",
    "language": "English",
    "provenance": "Source and revision evidence"
  }]
}
```

`path`, `size`, `sha256`, `name`, and `language` are required. Other text fields may be empty; revision dates must be actual ISO dates. Only nonempty PDFs up to 20 MB are accepted by this initial bulk contract. Paths are relative, cannot contain traversal, and must be unique case-insensitively. Folder-picker paths include the selected folder's name; selecting individual files uses their filenames. Selection must match the complete index with no missing or orphan files. Folder paths identify sources; they do not automatically create or authorize destination folders.

Preflight checks actual selected file sizes and hashes before writes. The server repeats byte/hash checks and the existing document validator. Source path and provenance are retained with immutable uploaded revisions; imported currency is explicitly unverified. Matching byte groups are reported and remain separate records; preflight does not certify revision currency or silently merge product evidence.

Uploads run one file at a time. Pause takes effect after the current file finishes. Failed rows retain retry status and saved rows are skipped. After closing the page, reselect the same index/files and destination; stable scoped row IDs and server source/hash verification reuse previously committed rows. This is restartable batch ingestion, not a persistent background worker or resumed partially transferred bytes after a browser restart. Original PDFs remain unchanged.

Validation: functions TypeScript build; four intake tests including 6,001 index rows; ten component tests across bulk import, single upload, explorer and viewer. A local emulator run also verified 6,001 synthetic metadata records, bounded reads, search continuation, hash rejection, two tiny synthetic PDF uploads and idempotent committed-row reuse. No real-library ingestion, Firestore production cost/latency, actual-device or production tests were performed. Indexed search, uncertain-metadata review workflow, multi-folder automatic mapping, explicit revision replacement/import decisions and large job books remain follow-on work.
