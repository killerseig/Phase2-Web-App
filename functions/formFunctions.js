"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formWorkspace = exports.formTemplates = void 0;
const formOutputTemplate_1 = require("./formOutputTemplate");
const formAccess_1 = require("./formAccess");
const formRecipients_1 = require("./formRecipients");
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const sharp_1 = __importDefault(require("sharp"));
const runtime_1 = require("./runtime");
const roleAccess_1 = require("./roleAccess");
const targetJobAccess_1 = require("./targetJobAccess");
const jobIdentity_1 = require("./jobIdentity");
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
function photoSlots(record, answers = record.answers) {
    return record.definition.fields.flatMap((field) => {
        if (field.kind === 'photo')
            return (answers[field.id] || []).map((assetId) => ({
                assetId,
                fieldId: field.id,
                groupId: '',
                instanceId: '',
            }));
        if (field.kind !== 'repeat')
            return [];
        return (answers[field.id] || []).flatMap((instance) => (field.fields || [])
            .filter((child) => child.kind === 'photo')
            .flatMap((child) => (instance.answers[child.id] || []).map((assetId) => ({
            assetId,
            fieldId: child.id,
            groupId: field.id,
            instanceId: instance.instanceId,
        }))));
    });
}
function photoTarget(record, data) {
    const group = data.groupId
        ? record.definition.fields.find((field) => field.id === data.groupId && field.kind === 'repeat')
        : undefined;
    const instance = group
        ? (record.answers[group.id] || []).find((item) => item.instanceId === data.instanceId)
        : undefined;
    const field = (group ? group.fields : record.definition.fields)?.find((item) => item.id === data.fieldId && item.kind === 'photo');
    if (!field || (data.groupId && !instance))
        fail('failed-precondition', 'Choose a saved photo field and site instance.');
    return { group, instance, field, answers: instance ? instance.answers : record.answers };
}
async function output(record) {
    const delivery = await runtime_1.db.doc('formDeliveries/' + record.id).get();
    const safe = { ...record };
    delete safe.publicCapabilityHash;
    delete safe.publicExpiresAt;
    delete safe.publicRecipientConsents;
    return {
        ...safe,
        definition: (0, formModel_1.respondentDefinition)(record.definition),
        emailStatus: delivery.data()?.status || 'not-submitted',
    };
}
exports.formTemplates = (0, https_1.onCall)({ memory: '512MiB', timeoutSeconds: 60 }, async (request) => {
    const incoming = payload(request.data || {});
    if (incoming.action === 'respondent') {
        const id = validId(incoming.id), snapshot = await templates.doc(id).get(), stored = snapshot.data();
        if (!stored || stored.archived || !stored.latestVersion)
            fail('not-found', 'This form is unavailable.');
        const version = incoming.version === undefined ? stored.latestVersion : incoming.version;
        if (!Number.isSafeInteger(version) || Number(version) < 1)
            fail('invalid-argument', 'Invalid form version.');
        const issued = await snapshot.ref
            .collection('versions')
            .doc('v' + version)
            .get();
        if (!issued.exists)
            fail('not-found', 'This form version is unavailable.');
        const definition = issued.data();
        const current = version === stored.latestVersion
            ? issued
            : await snapshot.ref
                .collection('versions')
                .doc('v' + stored.latestVersion)
                .get();
        const access = current.data()?.access;
        const profile = (0, formAccess_1.validateFormAccess)(access).respondents === 'signed-in' && request.auth?.uid
            ? await user(request.auth.uid)
            : undefined;
        if (!(0, formAccess_1.canSubmitForm)(access, profile) || !(0, formAccess_1.canSubmitForm)(definition.access, profile))
            throw new https_1.HttpsError('unauthenticated', 'Sign in to complete this form.');
        return { id, latestVersion: version, definition: (0, formModel_1.respondentDefinition)(definition) };
    }
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
                    ...(issued?.exists ? { definition: issued.data() } : {}),
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
            if (draft.output?.template)
                draft.output.template = draft.output.template.replace(/{{(.*?)}}/gs, (_match, key) => '{{' + (ids.get(key.trim()) || key.trim()) + '}}');
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
            const outputErrors = (0, formOutputTemplate_1.formOutputIssues)(stored.draft).filter((issue) => issue.severity === 'error');
            if (outputErrors.length)
                fail('invalid-argument', outputErrors.map((issue) => issue.message).join(' '));
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
async function authorizedFormJob(profile, value) {
    if (value === undefined)
        return undefined;
    const jobId = validId(value), job = await runtime_1.db.doc('jobs/' + jobId).get();
    const assigned = new Set(profile.assignedJobIds);
    if (job.data()?.assignedForemanIds?.includes(profile.uid))
        assigned.add(jobId);
    if (!job.exists ||
        !(0, targetJobAccess_1.targetFunctionRoleCanOpenJobDashboard)({
            role: profile.role,
            jobId,
            assignedJobIds: [...assigned],
            isShopJob: (0, jobIdentity_1.isFunctionShopJob)(job.data()),
        }))
        fail('permission-denied', 'You cannot use a form for this job.');
    return jobId;
}
exports.formWorkspace = (0, https_1.onCall)({ memory: '512MiB', timeoutSeconds: 60, maxInstances: 10 }, async (request) => {
    const data = payload(request.data || {});
    const capability = typeof data.publicCapability === 'string' && /^[a-f0-9]{64}$/.test(data.publicCapability)
        ? data.publicCapability
        : '';
    let profile;
    if (capability) {
        if (data.dashboardJobId !== undefined)
            fail('permission-denied', 'Public forms cannot select private job context.');
        profile = {
            uid: 'public-' + hash(capability),
            role: 'none',
            active: true,
            assignedJobIds: [],
            displayName: null,
        };
        if (data.action !== 'create') {
            const saved = (await records.doc(validId(data.id)).get()).data();
            if (!saved ||
                saved.publicCapabilityHash !== hash(capability) ||
                saved.publicExpiresAt < Date.now())
                fail('permission-denied', 'This form session expired. Start a new response.');
            const active = await templates.doc(saved.templateId).get();
            if (!active.exists || active.data()?.archived)
                fail('failed-precondition', 'This form is no longer accepting responses.');
            const latest = await active.ref
                .collection('versions')
                .doc('v' + active.data()?.latestVersion)
                .get();
            if ((0, formAccess_1.validateFormAccess)(latest.data()?.access).respondents !== 'public')
                fail('permission-denied', 'This form now requires sign in.');
        }
    }
    else
        profile = await user(request.auth?.uid);
    const dashboardJobId = await authorizedFormJob(profile, data.dashboardJobId);
    if (data.action === 'list') {
        const docs = await records.where('ownerUid', '==', profile.uid).limit(100).get();
        return {
            records: (await Promise.all(docs.docs
                .filter((doc) => dashboardJobId === undefined || doc.data().jobId === dashboardJobId)
                .map(async (doc) => {
                const record = doc.data();
                if (record.jobId) {
                    try {
                        await authorizedFormJob(profile, record.jobId);
                    }
                    catch (error) {
                        if (error instanceof https_1.HttpsError && error.code === 'permission-denied')
                            return undefined;
                        throw error;
                    }
                }
                return output(record);
            }))).filter(Boolean),
        };
    }
    if (data.action === 'create') {
        const templateId = validId(data.templateId);
        if (!requestId(data.requestId) ||
            !Number.isSafeInteger(data.version) ||
            Number(data.version) < 1)
            fail('invalid-argument', 'Choose an issued form version.');
        const id = hash(profile.uid + ':' + data.requestId + (dashboardJobId ? ':job:' + dashboardJobId : '')), ref = records.doc(id), template = templates.doc(templateId);
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
            const liveVersion = current.data()?.latestVersion === data.version
                ? issued
                : await tx.get(template.collection('versions').doc('v' + current.data()?.latestVersion));
            if (!liveVersion.exists ||
                !(0, formAccess_1.canSubmitForm)(liveVersion.data()?.access, capability ? undefined : profile))
                fail('permission-denied', 'This form audience changed. Open the current form link.');
            if (!(0, formAccess_1.canSubmitForm)(definition.access, capability ? undefined : profile))
                fail('permission-denied', 'You cannot complete this form.');
            if (capability && (0, formAccess_1.validateFormAccess)(definition.access).respondents !== 'public')
                fail('permission-denied', 'This form requires sign in.');
            let respondentIdentity;
            if (capability && (0, formAccess_1.validateFormAccess)(definition.access).identity === 'identified') {
                const identity = payload(data.respondentIdentity);
                const name = typeof identity.name === 'string' ? identity.name.trim() : '';
                const email = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '';
                if (!name ||
                    name.length > 160 ||
                    email.length > 254 ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                    fail('invalid-argument', 'Enter your name and email address. These contact details are self-reported, not verified.');
                respondentIdentity = { name, email };
            }
            if (capability) {
                const bucket = runtime_1.db.doc('formPublicRateLimits/' +
                    hash(request.rawRequest?.ip || 'unknown') +
                    '-' +
                    Math.floor(now / 3600000));
                const usage = await tx.get(bucket);
                if (Number(usage.data()?.count || 0) >= 20)
                    throw new https_1.HttpsError('resource-exhausted', 'Too many form starts. Try later.');
                tx.set(bucket, { count: Number(usage.data()?.count || 0) + 1, expiresAt: now + 7200000 });
            }
            const record = {
                id,
                ownerUid: profile.uid,
                ...(dashboardJobId ? { jobId: dashboardJobId } : {}),
                templateId,
                templateVersion: Number(data.version),
                definition,
                answers: (0, formModel_1.validateFormAnswers)(definition, {}, false),
                revision: 1,
                status: 'draft',
                createdAt: now,
                updatedAt: now,
                ...(capability
                    ? { publicCapabilityHash: hash(capability), publicExpiresAt: now + 4 * 3600000 }
                    : {}),
                ...(respondentIdentity ? { respondentIdentity } : {}),
            };
            tx.create(ref, record);
            tx.update(template, { used: true });
            return record;
        });
        return output(record);
    }
    const id = validId(data.id), ref = records.doc(id);
    const storedJob = (await ref.get()).data()?.jobId;
    if (storedJob)
        await authorizedFormJob(profile, storedJob);
    if (dashboardJobId !== undefined && storedJob !== dashboardJobId)
        fail('permission-denied', 'This form record belongs to another job.');
    if (data.action === 'get')
        return output(allowedRecord((await ref.get()).data(), profile));
    if (data.action === 'photo') {
        const record = allowedRecord((await ref.get()).data(), profile);
        const assetId = validId(data.assetId);
        if (!photoSlots(record).some((photo) => photo.assetId === assetId))
            fail('permission-denied', 'This photo is not attached to this record.');
        const asset = (await assets.doc(assetId).get()).data();
        const slot = photoSlots(record).find((photo) => photo.assetId === assetId);
        if (!asset ||
            asset.recordId !== id ||
            asset.ownerUid !== record.ownerUid ||
            asset.path !== 'form-photos/' + id + '/' + assetId + '.webp' ||
            !slot ||
            asset.fieldId !== slot.fieldId ||
            (asset.groupId || '') !== slot.groupId ||
            (asset.instanceId || '') !== slot.instanceId)
            fail('not-found', 'Photo not found.');
        const [bytes] = await runtime_1.storageBucket.file(asset.path).download();
        if (bytes.length > 2 * 1024 * 1024)
            fail('failed-precondition', 'This photo exceeds the view limit.');
        return { base64: bytes.toString('base64'), contentType: 'image/webp' };
    }
    if (data.action === 'upload') {
        const record = allowedRecord((await ref.get()).data(), profile, true);
        revision(record.revision, data.revision);
        if (record.status !== 'draft')
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
        photoTarget(record, data);
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
                const target = photoTarget(current, data);
                const list = target.answers[String(data.fieldId)];
                if (list.length >= 5 ||
                    (0, formModel_1.attachedPhotoCount)(current.definition, current.answers) >= 20 ||
                    Number(current.uploadedCount || 0) >= 40)
                    fail('failed-precondition', 'The photo limit has been reached.');
                tx.create(assets.doc(assetId), {
                    recordId: id,
                    fieldId: data.fieldId,
                    ...(target.group
                        ? { groupId: target.group.id, instanceId: target.instance.instanceId }
                        : {}),
                    path,
                    ownerUid: profile.uid,
                });
                tx.update(ref, {
                    answers: target.group
                        ? {
                            ...current.answers,
                            [target.group.id]: current.answers[target.group.id].map((instance) => instance.instanceId === target.instance.instanceId
                                ? {
                                    ...instance,
                                    answers: {
                                        ...instance.answers,
                                        [String(data.fieldId)]: [...list, assetId],
                                    },
                                }
                                : instance),
                        }
                        : { ...current.answers, [String(data.fieldId)]: [...list, assetId] },
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
    const pendingRecord = (await ref.get()).data();
    const consents = data.action === 'submit' && capability && pendingRecord
        ? await (0, formRecipients_1.publicRecipientConsentSnapshot)(runtime_1.db, pendingRecord.id)
        : [];
    const submissionRecipients = data.action === 'submit' && pendingRecord
        ? await (0, formRecipients_1.resolveFormSubmissionRecipients)(runtime_1.db, pendingRecord.definition, pendingRecord.answers, pendingRecord.jobId, {
            publicRespondent: !!capability,
            verifiedEmails: consents.map((proof) => proof.email),
        })
        : [];
    function enteredAddresses(fields, answers) {
        return fields.flatMap((field) => field.kind === 'recipients'
            ? (answers[field.id] || [])
            : field.kind === 'repeat'
                ? (answers[field.id] || []).flatMap((instance) => enteredAddresses(field.fields || [], instance.answers))
                : []);
    }
    const publicRecipientConsents = consents.filter((proof) => submissionRecipients.includes(proof.email));
    const recipientExclusionCount = capability && pendingRecord
        ? [
            ...new Set(enteredAddresses(pendingRecord.definition.fields, pendingRecord.answers).map((email) => email.trim().toLowerCase())),
        ].filter((email) => !submissionRecipients.includes(email)).length
        : 0;
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
        const photos = photoSlots(current, answers);
        const snapshots = photos.length
            ? await tx.getAll(...photos.map((photo) => assets.doc(photo.assetId)))
            : [];
        snapshots.forEach((snapshot, index) => {
            const photo = snapshot.data();
            if (!photo ||
                photo.recordId !== id ||
                photo.fieldId !== photos[index].fieldId ||
                (photo.groupId || '') !== photos[index].groupId ||
                (photo.instanceId || '') !== photos[index].instanceId ||
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
            ...(capability ? { publicRecipientConsents, recipientExclusionCount } : {}),
        };
        tx.create(runtime_1.db.doc('formSubmissions/' + id), next);
        tx.create(runtime_1.db.doc('formDeliveries/' + id), {
            submissionId: id,
            recipients: submissionRecipients,
            ...(capability ? { publicRecipientConsents, recipientExclusionCount } : {}),
            status: submissionRecipients.length ? 'queued' : 'not-configured',
            attempts: 0,
            updatedAt: now,
        });
        tx.set(ref, next);
        return next;
    });
    return output(record);
});
//# sourceMappingURL=formFunctions.js.map