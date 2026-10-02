"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formWorkspace = exports.formTemplates = void 0;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const sharp_1 = __importDefault(require("sharp"));
const runtime_1 = require("./runtime");
const roleAccess_1 = require("./roleAccess");
const formModel_1 = require("./formModel");
const templates = runtime_1.db.collection('formTemplates'), records = runtime_1.db.collection('formRecords'), assets = runtime_1.db.collection('formAssets');
const hash = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
const requestId = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
function fail(code, message) {
    throw new https_1.HttpsError(code, message);
}
async function user(uid, admin = false) {
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to use forms.');
    const snapshot = await runtime_1.db.doc('users/' + uid).get(), profile = (0, roleAccess_1.buildCurrentFunctionUser)(uid, snapshot.data() || {});
    if (!snapshot.exists ||
        !profile.active ||
        (admin
            ? profile.role !== 'admin'
            : !['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(profile.role)))
        fail('permission-denied', 'Your account cannot use this form workflow.');
    return profile;
}
function revision(actual, expected) {
    if (actual !== expected)
        fail('aborted', 'Another edit changed this draft. Reload before saving.');
}
function payload(value) {
    if (!value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Buffer.byteLength(JSON.stringify(value)) > 3000000)
        fail('invalid-argument', 'Invalid form request.');
    return value;
}
function validId(value) {
    if (!(0, formModel_1.formId)(value))
        fail('invalid-argument', 'Choose a valid form or record.');
    return value;
}
function validate(action) {
    try {
        return action();
    }
    catch (error) {
        fail('invalid-argument', error instanceof Error ? error.message : 'Check this form.');
    }
}
function allowedRecord(record, profile, write = false) {
    if (!record)
        fail('not-found', 'Form record not found.');
    if (record.ownerUid !== profile.uid && (write || profile.role !== 'admin'))
        fail('permission-denied', 'This form record belongs to another user.');
    return record;
}
async function output(record) {
    const delivery = await runtime_1.db.doc('formDeliveries/' + record.id).get();
    return {
        ...record,
        definition: (0, formModel_1.respondentDefinition)(record.definition),
        emailStatus: delivery.data()?.status || 'not-submitted',
    };
}
exports.formTemplates = (0, https_1.onCall)({ memory: '512MiB', timeoutSeconds: 60 }, async (request) => {
    const profile = await user(request.auth?.uid), data = payload(request.data || {});
    if (data.action === 'list') {
        const docs = (await templates.limit(100).get()).docs;
        const list = [];
        for (const doc of docs) {
            const stored = doc.data();
            if (profile.role === 'admin') {
                const issued = stored.latestVersion
                    ? await doc.ref
                        .collection('versions')
                        .doc('v' + stored.latestVersion)
                        .get()
                    : undefined;
                list.push({
                    id: doc.id,
                    ...stored,
                    ...(issued?.exists
                        ? { definition: (0, formModel_1.respondentDefinition)(issued.data()) }
                        : {}),
                });
            }
            else if (!stored.archived && stored.latestVersion) {
                const issued = await doc.ref
                    .collection('versions')
                    .doc('v' + stored.latestVersion)
                    .get();
                list.push({
                    id: doc.id,
                    definition: (0, formModel_1.respondentDefinition)(issued.data()),
                    latestVersion: stored.latestVersion,
                });
            }
        }
        return { templates: list };
    }
    await user(profile.uid, true);
    const id = validId(data.id), ref = templates.doc(id);
    return runtime_1.db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref), stored = snapshot.data();
        if (data.action === 'duplicate') {
            if (!snapshot.exists || stored?.archived)
                fail('failed-precondition', 'Choose an active template to duplicate.');
            const targetId = validId(data.targetId);
            if (!requestId(targetId) || targetId === id)
                fail('invalid-argument', 'Choose a new copy identity.');
            const target = templates.doc(targetId), existing = await tx.get(target);
            if (existing.exists) {
                const copy = existing.data();
                if (copy.duplicateOf !== id ||
                    copy.duplicateRevision !== data.revision ||
                    copy.createdBy !== profile.uid)
                    fail('already-exists', 'This copy identity already exists.');
                return { id: targetId, ...copy };
            }
            revision(stored.revision, data.revision);
            const draft = validate(() => (0, formModel_1.validateFormDefinition)(stored.draft));
            draft.title = draft.title.slice(0, 153) + ' (copy)';
            const ids = new Map(draft.fields.map((field) => [field.id, (0, node_crypto_1.randomUUID)()]));
            for (const field of draft.fields) {
                field.id = ids.get(field.id);
                if (field.requiredWhen)
                    field.requiredWhen.fieldId = ids.get(field.requiredWhen.fieldId);
            }
            const copy = {
                draft,
                revision: 1,
                latestVersion: 0,
                archived: false,
                used: false,
                updatedAt: Date.now(),
                createdBy: profile.uid,
                duplicateOf: id,
                duplicateRevision: data.revision,
            };
            tx.create(target, copy);
            return { id: targetId, ...copy };
        }
        revision(stored?.revision || 0, data.revision);
        if (data.action === 'save') {
            if (stored?.archived)
                fail('failed-precondition', 'Archived forms cannot be edited.');
            const draft = validate(() => (0, formModel_1.validateFormDefinition)(data.definition));
            const next = {
                draft,
                revision: (stored?.revision || 0) + 1,
                latestVersion: stored?.latestVersion || 0,
                archived: false,
                used: stored?.used || false,
                updatedAt: Date.now(),
            };
            tx.set(ref, next);
            return { id, ...next };
        }
        if (!snapshot.exists)
            fail('not-found', 'Form template not found.');
        if (data.action === 'issue') {
            if (stored.archived)
                fail('failed-precondition', 'Archived forms cannot be issued.');
            const draft = validate(() => (0, formModel_1.validateFormDefinition)(stored.draft));
            const version = stored.latestVersion + 1;
            tx.create(ref.collection('versions').doc('v' + version), {
                ...draft,
                version,
                createdAt: new Date().toISOString(),
            });
            tx.update(ref, { latestVersion: version, revision: stored.revision + 1 });
            return { id, latestVersion: version, revision: stored.revision + 1 };
        }
        if (data.action === 'remove') {
            if (stored.used || stored.latestVersion)
                tx.update(ref, { archived: true, revision: stored.revision + 1 });
            else
                tx.delete(ref);
            return { archived: !!(stored.used || stored.latestVersion) };
        }
        fail('invalid-argument', 'Unknown template action.');
    });
});
exports.formWorkspace = (0, https_1.onCall)({ memory: '512MiB', timeoutSeconds: 60, maxInstances: 10 }, async (request) => {
    const profile = await user(request.auth?.uid), data = payload(request.data || {});
    if (data.action === 'list') {
        const docs = await records.where('ownerUid', '==', profile.uid).limit(100).get();
        return {
            records: await Promise.all(docs.docs.map((doc) => output(doc.data()))),
        };
    }
    if (data.action === 'create') {
        const templateId = validId(data.templateId);
        if (!requestId(data.requestId) ||
            !Number.isSafeInteger(data.version) ||
            Number(data.version) < 1)
            fail('invalid-argument', 'Choose an issued form version.');
        const id = hash(profile.uid + ':' + data.requestId), ref = records.doc(id), template = templates.doc(templateId);
        const record = await runtime_1.db.runTransaction(async (tx) => {
            const [existing, current, issued] = await tx.getAll(ref, template, template.collection('versions').doc('v' + data.version));
            if (existing.exists) {
                const old = existing.data();
                if (old.templateId !== templateId || old.templateVersion !== data.version)
                    fail('already-exists', 'This draft request was already used.');
                return old;
            }
            if (!current.exists || current.data()?.archived || !issued.exists)
                fail('failed-precondition', 'This form version is not available for new drafts.');
            const definition = issued.data(), now = Date.now();
            const record = {
                id,
                ownerUid: profile.uid,
                templateId,
                templateVersion: Number(data.version),
                definition,
                answers: (0, formModel_1.validateFormAnswers)(definition, {}, false),
                revision: 1,
                status: 'draft',
                createdAt: now,
                updatedAt: now,
            };
            tx.create(ref, record);
            tx.update(template, { used: true });
            return record;
        });
        return output(record);
    }
    const id = validId(data.id), ref = records.doc(id);
    if (data.action === 'get')
        return output(allowedRecord((await ref.get()).data(), profile));
    if (data.action === 'photo') {
        const record = allowedRecord((await ref.get()).data(), profile);
        const assetId = validId(data.assetId);
        if (!record.definition.fields.some((field) => field.kind === 'photo' &&
            Array.isArray(record.answers[field.id]) &&
            record.answers[field.id].includes(assetId)))
            fail('permission-denied', 'This photo is not attached to this record.');
        const asset = (await assets.doc(assetId).get()).data();
        if (!asset || asset.recordId !== id)
            fail('not-found', 'Photo not found.');
        const [bytes] = await runtime_1.storageBucket.file(asset.path).download();
        return { base64: bytes.toString('base64'), contentType: 'image/webp' };
    }
    if (data.action === 'upload') {
        const record = allowedRecord((await ref.get()).data(), profile, true);
        revision(record.revision, data.revision);
        if (record.status !== 'draft' ||
            !record.definition.fields.some((field) => field.id === data.fieldId && field.kind === 'photo'))
            fail('failed-precondition', 'Photos can be attached only to photo fields on your draft.');
        if (typeof data.base64 !== 'string' ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64) ||
            !['image/jpeg', 'image/png', 'image/webp'].includes(String(data.contentType)))
            fail('invalid-argument', 'Choose a JPEG, PNG or WebP photo.');
        const input = Buffer.from(data.base64, 'base64');
        if (input.length > 2 * 1024 * 1024 || !input.length)
            fail('invalid-argument', 'Photos must be at most 2 MB.');
        let bytes;
        try {
            bytes = await (0, sharp_1.default)(input, { limitInputPixels: 16000000, animated: false })
                .rotate()
                .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 82 })
                .toBuffer();
        }
        catch {
            fail('invalid-argument', 'This image could not be read.');
        }
        const assetId = (0, node_crypto_1.randomUUID)(), path = 'form-photos/' + id + '/' + assetId + '.webp', file = runtime_1.storageBucket.file(path);
        await file.save(bytes, {
            contentType: 'image/webp',
            resumable: false,
            metadata: {
                metadata: { recordId: id, fieldId: String(data.fieldId), ownerUid: profile.uid },
            },
        });
        try {
            await runtime_1.db.runTransaction(async (tx) => {
                const current = allowedRecord((await tx.get(ref)).data(), profile, true);
                revision(current.revision, data.revision);
                if (current.status !== 'draft')
                    fail('failed-precondition', 'Submitted photos cannot be changed.');
                const list = current.answers[String(data.fieldId)];
                if (list.length >= 5 ||
                    (0, formModel_1.attachedPhotoCount)(current.definition, current.answers) >= 20 ||
                    Number(current.uploadedCount || 0) >= 40)
                    fail('failed-precondition', 'The photo limit has been reached.');
                tx.create(assets.doc(assetId), {
                    recordId: id,
                    fieldId: data.fieldId,
                    path,
                    ownerUid: profile.uid,
                });
                tx.update(ref, {
                    answers: { ...current.answers, [String(data.fieldId)]: [...list, assetId] },
                    revision: current.revision + 1,
                    updatedAt: Date.now(),
                    uploadedCount: Number(current.uploadedCount || 0) + 1,
                });
            });
        }
        catch (error) {
            await file.delete({ ignoreNotFound: true });
            throw error;
        }
        return output((await ref.get()).data());
    }
    const record = await runtime_1.db.runTransaction(async (tx) => {
        const current = allowedRecord((await tx.get(ref)).data(), profile, true);
        if (!requestId(data.requestId))
            fail('invalid-argument', 'A stable request identifier is required.');
        if (data.action === 'submit' && current.status === 'submitted') {
            const saved = current;
            if (saved.submissionRequestId !== data.requestId)
                fail('already-exists', 'This form was already submitted.');
            return current;
        }
        if (current.status !== 'draft')
            fail('failed-precondition', 'Submitted forms are immutable.');
        const answers = validate(() => (0, formModel_1.validateFormAnswers)(current.definition, data.action === 'save' ? data.answers : current.answers, data.action === 'submit'));
        const fingerprint = hash(JSON.stringify(answers));
        const previous = current;
        if (data.action === 'save' && previous.saveRequestId === data.requestId) {
            if (previous.answerFingerprint !== fingerprint)
                fail('already-exists', 'This save request was already used with different answers.');
            return current;
        }
        revision(current.revision, data.revision);
        const photos = current.definition.fields
            .filter((field) => field.kind === 'photo')
            .flatMap((field) => answers[field.id].map((assetId) => ({ assetId, fieldId: field.id })));
        const snapshots = photos.length
            ? await tx.getAll(...photos.map((photo) => assets.doc(photo.assetId)))
            : [];
        snapshots.forEach((snapshot, index) => {
            const photo = snapshot.data();
            if (!photo ||
                photo.recordId !== id ||
                photo.fieldId !== photos[index].fieldId ||
                photo.ownerUid !== profile.uid)
                fail('permission-denied', 'A photo belongs to another form record.');
        });
        const now = Date.now();
        if (data.action === 'save') {
            const next = {
                ...current,
                answers,
                revision: current.revision + 1,
                updatedAt: now,
                saveRequestId: data.requestId,
                answerFingerprint: fingerprint,
            };
            tx.set(ref, next);
            return next;
        }
        if (data.action !== 'submit')
            fail('invalid-argument', 'Unknown form action.');
        const next = {
            ...current,
            answers,
            status: 'submitted',
            revision: current.revision + 1,
            updatedAt: now,
            submittedAt: now,
            submissionRequestId: data.requestId,
        };
        tx.create(runtime_1.db.doc('formSubmissions/' + id), next);
        tx.create(runtime_1.db.doc('formDeliveries/' + id), {
            submissionId: id,
            recipients: current.definition.recipients,
            status: current.definition.recipients.length ? 'queued' : 'not-configured',
            attempts: 0,
            updatedAt: now,
        });
        tx.set(ref, next);
        return next;
    });
    return output(record);
});
//# sourceMappingURL=formFunctions.js.map