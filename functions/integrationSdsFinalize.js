"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeIntegrationSds = finalizeIntegrationSds;
const node_crypto_1 = require("node:crypto");
const runtime_1 = require("./runtime");
const sdsModel_1 = require("./sdsModel");
const documentFormats_1 = require("./documentFormats");
const sdsIntake_1 = require("./sdsIntake");
const apiScopePolicy_1 = require("./apiScopePolicy");
const roleAccess_1 = require("./roleAccess");
/** Commits only server-validated, key/actor/folder-bound staging. No public storage URLs. */
async function finalizeIntegrationSds(request, actorUid, keyId, secret) {
    const id = request.resourceId;
    const uploadId = request.payload.uploadId;
    if (!id ||
        typeof uploadId !== 'string' ||
        !/^[a-f0-9]{64}$/.test(uploadId) ||
        !['create', 'revision'].includes(String(request.payload.mode)))
        throw new Error('Choose an explicit document and create/revision mode.');
    const stageRef = runtime_1.db.doc(`sdsIntegrationUploads/${uploadId}`), sheetRef = runtime_1.db.doc(`sdsDocuments/${id}`);
    const stage = await stageRef.get(), staged = stage.data();
    const assertStage = (value) => {
        if (!value ||
            value.keyId !== keyId ||
            value.actorUid !== actorUid ||
            value.folderId !== request.folderId ||
            value.status !== 'staged' ||
            value.expiresAt <= Date.now())
            throw new Error('Staged upload unavailable or outside scope.');
    };
    assertStage(staged);
    const stagedFile = runtime_1.storageBucket.file(`sds-uploads/${actorUid}/${uploadId}.pdf`);
    const [metadata] = await stagedFile.getMetadata();
    if (Number(metadata.size) < 1 ||
        Number(metadata.size) > 20 * 1024 * 1024 ||
        metadata.contentType !== 'application/pdf' ||
        metadata.metadata?.keyId !== keyId ||
        metadata.metadata?.folderId !== request.folderId)
        throw new Error('Invalid staged PDF.');
    const [bytes] = await stagedFile.download(), checksum = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
    if (bytes.length !== staged.size || checksum !== staged.sha256)
        throw new Error('Staged PDF bytes changed.');
    const validated = await (0, documentFormats_1.validateDocument)(bytes, 'pdf');
    const revisionDate = (0, sdsModel_1.sdsText)(request.payload.revisionDate ?? '', 'Revision date', 10);
    if (revisionDate &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(revisionDate) ||
            !Number.isFinite(Date.parse(revisionDate)) ||
            new Date(revisionDate).toISOString().slice(0, 10) !== revisionDate))
        throw new Error('Invalid revision date.');
    const order = request.payload.order ?? 0;
    if (!Number.isInteger(order) || Math.abs(Number(order)) > 1000000)
        throw new Error('Invalid order.');
    const sourcePath = request.payload.sourcePath === undefined ? undefined : (0, sdsIntake_1.importPath)(request.payload.sourcePath);
    const values = {
        name: (0, sdsModel_1.sdsText)(request.payload.name, 'File name', 160, true),
        manufacturer: (0, sdsModel_1.sdsText)(request.payload.manufacturer ?? '', 'Manufacturer', 160),
        productCode: (0, sdsModel_1.sdsText)(request.payload.productCode ?? '', 'Product identifier', 100),
        language: (0, sdsModel_1.sdsText)(request.payload.language, 'Language', 40, true),
        folderId: request.folderId,
        order: Number(order),
        revisionDate,
        provenance: (0, sdsModel_1.sdsText)(request.payload.provenance ?? '', 'Provenance', 1000),
        currencyStatus: 'unverified',
        ...(sourcePath ? { sourcePath } : {}),
    };
    const revisionId = (0, node_crypto_1.randomUUID)(), filePath = `sds-files/${id}/${revisionId}.pdf`;
    const masterCount = (await runtime_1.db.collection('sdsDocuments').count().get()).data().count;
    await runtime_1.storageBucket
        .file(filePath)
        .save(bytes, {
        resumable: false,
        contentType: 'application/pdf',
        metadata: { cacheControl: 'private, max-age=0' },
    });
    try {
        await runtime_1.db.runTransaction(async (tx) => {
            const stateRef = runtime_1.db.doc('sdsState/master'), keyRef = runtime_1.db.doc(`integrationKeys/${keyId}`), actorRef = runtime_1.db.doc(`users/${actorUid}`);
            const [currentStage, current, state, key, actor, folders] = await Promise.all([
                tx.get(stageRef),
                tx.get(sheetRef),
                tx.get(stateRef),
                tx.get(keyRef),
                tx.get(actorRef),
                tx.get(runtime_1.db.collection('sdsFolders')),
            ]);
            assertStage(currentStage.data());
            const profile = (0, roleAccess_1.buildCurrentFunctionUser)(actorUid, actor.data() ?? {});
            if (!key.exists ||
                key.data()?.actorUid !== actorUid ||
                !actor.exists ||
                !profile.active ||
                profile.role !== 'admin' ||
                !(0, apiScopePolicy_1.evaluateIntegrationRequest)({ ...key.data(), id: keyId }, secret, request, Date.now()).allowed)
                throw new Error('Integration access revoked.');
            if (!Number.isSafeInteger(request.payload.version) ||
                request.payload.version !== (state.data()?.version ?? 0))
                throw new Error('Master library version changed.');
            (0, sdsModel_1.folderPath)(values.folderId, folders.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
            if (request.payload.mode === 'create') {
                if (current.exists ||
                    request.payload.expectedRevisionId !== undefined ||
                    masterCount >= sdsIntake_1.SDS_MASTER_CAPACITY)
                    throw new Error('Cannot create this document.');
            }
            else if (!current.exists ||
                current.data()?.folderId !== request.folderId ||
                typeof request.payload.expectedRevisionId !== 'string' ||
                request.payload.expectedRevisionId !== current.data()?.revisionId)
                throw new Error('Document revision or folder changed.');
            const saved = {
                ...current.data(),
                ...values,
                ...validated,
                id,
                revisionId,
                extension: 'pdf',
                mimeType: 'application/pdf',
                originalName: staged.originalName ?? '',
                size: bytes.length,
                checksum,
                archived: current.data()?.archived ?? false,
                updatedAt: new Date().toISOString(),
                updatedBy: actorUid,
            };
            tx.set(sheetRef, saved);
            tx.create(sheetRef.collection('revisions').doc(revisionId), { ...saved, filePath });
            tx.set(stateRef, { version: Number(request.payload.version) + 1 });
            tx.update(stageRef, {
                status: 'consumed',
                documentId: id,
                revisionId,
                consumedAt: Date.now(),
            });
        });
    }
    catch (error) {
        await runtime_1.storageBucket
            .file(filePath)
            .delete()
            .catch(() => undefined);
        throw error;
    }
    await stagedFile.delete().catch(() => undefined);
    return { id, revisionId, version: Number(request.payload.version) + 1, state: 'library-saved' };
}
//# sourceMappingURL=integrationSdsFinalize.js.map