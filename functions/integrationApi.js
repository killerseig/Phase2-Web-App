"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scopedIntegrationApi = void 0;
const https_1 = require("firebase-functions/v2/https");
const node_crypto_1 = require("node:crypto");
const runtime_1 = require("./runtime");
const apiScopePolicy_1 = require("./apiScopePolicy");
const integrationApiRequest_1 = require("./integrationApiRequest");
const roleAccess_1 = require("./roleAccess");
const formFunctions_1 = require("./formFunctions");
const sdsModel_1 = require("./sdsModel");
const documentFormats_1 = require("./documentFormats");
const integrationSdsFinalize_1 = require("./integrationSdsFinalize");
/** No provisioning route: existing credentials must be separately authorized and securely provisioned. */
exports.scopedIntegrationApi = (0, https_1.onRequest)({ timeoutSeconds: 120, memory: '512MiB', cors: false }, async (req, res) => {
    res.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'POST required.' });
        return;
    }
    const bearer = /^Bearer ([A-Za-z0-9_-]{1,80})\.([A-Za-z0-9_-]{43,128})$/.exec(req.get('Authorization') ?? '');
    if (!bearer) {
        res.status(401).json({ error: 'Invalid integration credential.' });
        return;
    }
    const [, keyId, secret] = bearer;
    const now = Date.now();
    let request;
    try {
        request = (0, integrationApiRequest_1.parseIntegrationEnvelope)(req.body);
    }
    catch {
        res.status(400).json({ error: 'Invalid request.' });
        return;
    }
    const keyRef = runtime_1.db.doc(`integrationKeys/${keyId}`);
    const keySnap = await keyRef.get(), credential = keySnap.exists
        ? { ...keySnap.data(), id: keyId }
        : null;
    const decision = (0, apiScopePolicy_1.evaluateIntegrationRequest)(credential, secret, request, now);
    const auditRef = runtime_1.db.collection('integrationAudit').doc();
    if (!decision.allowed) {
        // Unknown credentials cannot create an unbounded unauthenticated audit stream.
        if (keySnap.exists && decision.reason !== 'invalid-key')
            await auditRef.create((0, apiScopePolicy_1.integrationAuditEvent)(keyId, request, decision, now));
        res.status(403).json({ error: 'Integration access denied.' });
        return;
    }
    if (!credential?.actorUid || !/^[A-Za-z0-9_-]{1,128}$/.test(credential.actorUid)) {
        res.status(403).json({ error: 'Integration actor unavailable.' });
        return;
    }
    const actorSnap = await runtime_1.db.doc(`users/${credential.actorUid}`).get();
    const actor = (0, roleAccess_1.buildCurrentFunctionUser)(credential.actorUid, actorSnap.data() ?? {});
    if (!actorSnap.exists || !actor.active || actor.role !== 'admin') {
        res.status(403).json({ error: 'Integration actor unavailable.' });
        return;
    }
    const rawBytes = req.rawBody?.length ?? Buffer.byteLength(JSON.stringify(req.body));
    if (rawBytes > 29 * 1024 * 1024) {
        res.status(413).json({ error: 'Request too large.' });
        return;
    }
    const fingerprint = (0, integrationApiRequest_1.integrationPayloadHash)(request);
    const requestRef = keyRef.collection('requests').doc(request.requestId);
    const quotaRef = keyRef.collection('quota').doc(String(Math.floor(now / 3600000)));
    let accepted = false;
    try {
        const previous = await runtime_1.db.runTransaction(async (tx) => {
            const [currentKey, currentActor, prior, quota] = await Promise.all([
                tx.get(keyRef),
                tx.get(actorSnap.ref),
                tx.get(requestRef),
                tx.get(quotaRef),
            ]);
            const current = currentKey.exists
                ? { ...currentKey.data(), id: keyId }
                : null;
            const profile = (0, roleAccess_1.buildCurrentFunctionUser)(actor.uid, currentActor.data() ?? {});
            if (!(0, apiScopePolicy_1.evaluateIntegrationRequest)(current, secret, request, Date.now()).allowed ||
                currentKey.data()?.actorUid !== actor.uid ||
                !currentActor.exists ||
                !profile.active ||
                profile.role !== 'admin')
                throw new Error('Access revoked.');
            if (prior.exists) {
                if (prior.data()?.fingerprint !== fingerprint)
                    throw new Error('Request ID already has different content.');
                return prior.data();
            }
            tx.set(quotaRef, (0, integrationApiRequest_1.reserveIntegrationQuota)(quota.data() ?? {}, rawBytes));
            tx.create(requestRef, {
                fingerprint,
                state: 'running',
                createdAt: now,
                operation: request.operation,
            });
            tx.create(auditRef, {
                ...(0, apiScopePolicy_1.integrationAuditEvent)(keyId, request, decision, now),
                actorUid: actor.uid,
                requestId: request.requestId,
                state: 'accepted',
                bytes: rawBytes,
            });
            return undefined;
        });
        if (previous) {
            res.status(previous.state === 'complete' ? 200 : 409).json(previous.state === 'complete'
                ? previous.result
                : {
                    error: 'Request is pending or failed. Reconcile before retrying.',
                    state: previous.state,
                });
            return;
        }
        accepted = true;
        const result = await applyIntegrationOperation(request, actor.uid, keyId, secret);
        await runtime_1.db.runTransaction(async (tx) => {
            tx.update(requestRef, { state: 'complete', result, completedAt: Date.now() });
            tx.create(runtime_1.db.collection('integrationAudit').doc(), {
                keyId,
                requestId: request.requestId,
                operation: request.operation,
                actorUid: actor.uid,
                state: 'complete',
                at: Date.now(),
            });
        });
        res.json(result);
    }
    catch (error) {
        const existing = await requestRef.get();
        if (accepted &&
            existing.data()?.fingerprint === fingerprint &&
            existing.data()?.state === 'running') {
            await requestRef.update({ state: 'failed', failedAt: Date.now() });
            await runtime_1.db.collection('integrationAudit').add({
                keyId,
                requestId: request.requestId,
                operation: request.operation,
                actorUid: actor.uid,
                state: 'failed',
                at: Date.now(),
            });
        }
        // Never expose arbitrary internal error text or client content.
        res.status(409).json({
            error: 'Request could not complete. Check quota, revision, scope and validated input.',
        });
    }
});
async function applyIntegrationOperation(request, actorUid, keyId, secret) {
    const auth = { uid: actorUid, token: { uid: actorUid } };
    const invoke = (data) => ({ data, auth });
    if (request.operation === 'sds.upload.finalize')
        return (0, integrationSdsFinalize_1.finalizeIntegrationSds)(request, actorUid, keyId, secret);
    if (request.operation === 'forms.draft.create' || request.operation === 'forms.draft.update') {
        const id = request.resourceId ?? request.requestId;
        const existing = await runtime_1.db.doc(`formTemplates/${id}`).get();
        if ((request.operation === 'forms.draft.create' && existing.exists) ||
            (request.operation === 'forms.draft.update' && !existing.exists))
            throw new Error('Form state mismatch.');
        const saved = (await formFunctions_1.formTemplates.run(invoke({
            action: 'save',
            id,
            revision: request.operation === 'forms.draft.create' ? 0 : request.payload.revision,
            definition: request.payload.definition,
        })));
        return { id, revision: saved.revision, state: 'draft' };
    }
    if (request.operation === 'sds.metadata.update') {
        if (!request.resourceId)
            throw new Error('Document required.');
        const values = {
            name: (0, sdsModel_1.sdsText)(request.payload.name, 'File name', 160, true),
            manufacturer: (0, sdsModel_1.sdsText)(request.payload.manufacturer ?? '', 'Manufacturer', 160),
            productCode: (0, sdsModel_1.sdsText)(request.payload.productCode ?? '', 'Product identifier', 100),
            language: (0, sdsModel_1.sdsText)(request.payload.language, 'Language', 40, true),
        };
        // Validate current membership atomically so concurrent folder moves cannot bypass scope.
        await runtime_1.db.runTransaction(async (tx) => {
            const sheetRef = runtime_1.db.doc(`sdsDocuments/${request.resourceId}`), stateRef = runtime_1.db.doc('sdsState/master');
            const [sheet, state] = await Promise.all([tx.get(sheetRef), tx.get(stateRef)]);
            if (!sheet.exists || sheet.data()?.folderId !== request.folderId)
                throw new Error('Document folder outside scope.');
            if (!Number.isSafeInteger(request.payload.version) ||
                request.payload.version !== (state.data()?.version ?? 0))
                throw new Error('SDS revision conflict.');
            if (request.payload.revisionDate !== undefined &&
                request.payload.revisionDate !== sheet.data()?.revisionDate)
                throw new Error('Metadata cannot change file revision date.');
            tx.update(sheetRef, { ...values, updatedBy: actorUid, updatedAt: new Date().toISOString() });
            tx.set(stateRef, { version: Number(request.payload.version) + 1 });
        });
        return { id: request.resourceId, state: 'metadata-saved' };
    }
    if (request.operation === 'sds.upload.stage') {
        const folder = await runtime_1.db.doc(`sdsFolders/${request.folderId}`).get();
        if (!folder.exists)
            throw new Error('Folder unavailable.');
        const encoded = request.payload.base64;
        if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
            throw new Error('Invalid PDF bytes.');
        const bytes = Buffer.from(encoded, 'base64');
        if (!bytes.length || bytes.length > 20 * 1024 * 1024)
            throw new Error('PDF size exceeded.');
        await (0, documentFormats_1.validateDocument)(bytes, 'pdf');
        const checksum = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
        if (request.payload.expectedSize !== bytes.length ||
            request.payload.expectedSha256 !== checksum)
            throw new Error('PDF index mismatch.');
        const uploadId = (0, node_crypto_1.createHash)('sha256').update(`${keyId}:${request.requestId}`).digest('hex');
        const originalName = (0, sdsModel_1.sdsText)(request.payload.originalName ?? 'uploaded.pdf', 'Original filename', 180).replace(/[\\/\x00-\x1f]/g, '_');
        await runtime_1.storageBucket.file(`sds-uploads/${actorUid}/${uploadId}.pdf`).save(bytes, {
            resumable: false,
            contentType: 'application/pdf',
            metadata: { metadata: { integrationKeyStaged: 'true', folderId: request.folderId, keyId } },
        });
        await runtime_1.db.doc(`sdsIntegrationUploads/${uploadId}`).create({
            keyId,
            actorUid,
            folderId: request.folderId,
            status: 'staged',
            size: bytes.length,
            sha256: checksum,
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000,
            originalName,
        });
        return {
            uploadId,
            extension: 'pdf',
            size: bytes.length,
            sha256: checksum,
            state: 'staged-only',
            version: (await runtime_1.db.doc('sdsState/master').get()).data()?.version ?? 0,
        };
    }
    throw new Error('Unsupported operation.');
}
//# sourceMappingURL=integrationApi.js.map