"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.websiteFormAdmin = exports.deliverWebsiteFormEmail = exports.submitWebsiteForm = void 0;
exports.submissionEmailHtml = submissionEmailHtml;
exports.deliverWebsiteSubmission = deliverWebsiteSubmission;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const runtime_1 = require("./runtime");
const roleAccess_1 = require("./roleAccess");
const functionConfig_1 = require("./functionConfig");
const emailService_1 = require("./emailService");
const websiteForms_1 = require("./websiteForms");
const submissions = runtime_1.db.collection('websiteSubmissions');
const hash = (text) => (0, node_crypto_1.createHash)('sha256').update(text).digest('hex');
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
const LEASE_MS = 10 * 60 * 1000;
exports.submitWebsiteForm = (0, https_1.onCall)({ timeoutSeconds: 30, maxInstances: 10 }, async (request) => {
    const data = request.data || {};
    if (Buffer.byteLength(JSON.stringify(data)) > 70000 ||
        !validId(data.formId) ||
        typeof data.submissionId !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(data.submissionId))
        throw new https_1.HttpsError('invalid-argument', 'Invalid form submission.');
    if (typeof data.website !== 'string')
        throw new https_1.HttpsError('invalid-argument', 'Refresh the form and try again.');
    if (data.website)
        return { received: true };
    const ip = request.rawRequest?.ip;
    if (!ip)
        throw new https_1.HttpsError('unavailable', 'Please try again.');
    const now = Date.now(), bucket = Math.floor(now / 3600000);
    const ref = submissions.doc(hash(data.formId + ':' + data.submissionId));
    const ipRef = runtime_1.db.doc(`websiteFormLimits/ip-${hash(ip)}`), siteRef = runtime_1.db.doc('websiteFormLimits/site');
    await runtime_1.db.runTransaction(async (transaction) => {
        const [published, routing, existing, ipRate, siteRate] = await transaction.getAll(runtime_1.db.doc('websitePublished/current'), runtime_1.db.doc('websitePrivate/publicForms'), ref, ipRef, siteRef);
        const form = published.data()?.site?.forms?.find((entry) => entry.id === data.formId);
        const delivery = routing.data()?.forms?.find((entry) => entry.id === data.formId)?.delivery;
        if (!form ||
            !delivery?.to.length ||
            routing.data()?.publishedAt !== published.data()?.publishedAt)
            throw new https_1.HttpsError('failed-precondition', 'This form is no longer available. Refresh the page.');
        let values;
        try {
            values = (0, websiteForms_1.validateFormValues)(form, data.values);
        }
        catch (reason) {
            throw new https_1.HttpsError('invalid-argument', reason instanceof Error ? reason.message : 'Check the form fields.');
        }
        const fingerprint = hash(JSON.stringify(values));
        if (existing.exists) {
            if (existing.data()?.fingerprint !== fingerprint)
                throw new https_1.HttpsError('already-exists', 'This submission was already received. Refresh before sending a new message.');
            return;
        }
        const ipCount = ipRate.data()?.bucket === bucket ? Number(ipRate.data()?.count || 0) : 0;
        const siteCount = siteRate.data()?.bucket === bucket ? Number(siteRate.data()?.count || 0) : 0;
        if (ipCount >= 10 || siteCount >= 200)
            throw new https_1.HttpsError('resource-exhausted', 'Too many submissions. Please try again later.');
        const answers = form.fields.map((field) => ({
            label: field.label,
            value: values[field.id],
            fieldId: field.id,
        }));
        transaction.create(ref, {
            formId: form.id,
            formName: form.name,
            createdAt: now,
            answers,
            delivery,
            replyTo: form.replyToField && typeof values[form.replyToField] === 'string'
                ? values[form.replyToField]
                : '',
            fingerprint,
            emailStatus: 'pending',
            attempts: 0,
        });
        transaction.set(ipRef, { bucket, count: ipCount + 1, updatedAt: now });
        transaction.set(siteRef, { bucket, count: siteCount + 1, updatedAt: now });
    });
    return { received: true };
});
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function submissionEmailHtml(record) {
    return `<h1>${escapeHtml(record.formName)}</h1><p>New public website submission</p>${record.answers.map((answer) => `<h3>${escapeHtml(answer.label)}</h3><p style="white-space:pre-wrap">${escapeHtml(typeof answer.value === 'boolean' ? (answer.value ? 'Yes' : 'No') : answer.value)}</p>`).join('')}`;
}
// Claim once before contacting Graph. Delivery failures retain the complete inquiry for admin review.
async function deliverWebsiteSubmission(id, retry = false) {
    const ref = submissions.doc(id), attemptId = (0, node_crypto_1.randomUUID)(), now = Date.now();
    const record = await runtime_1.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists)
            throw new https_1.HttpsError('not-found', 'Submission not found.');
        const data = snapshot.data();
        if (data.emailStatus === 'sent')
            return undefined;
        if (data.emailStatus === 'sending' && now - data.attemptStartedAt < LEASE_MS)
            return undefined;
        if (!retry && data.emailStatus !== 'pending')
            return undefined;
        transaction.update(ref, {
            emailStatus: 'sending',
            attemptId,
            attemptStartedAt: now,
            attempts: Number(data.attempts || 0) + 1,
        });
        return data;
    });
    if (!record)
        return;
    let status = 'failed';
    try {
        if (!(0, emailService_1.isEmailEnabled)())
            status = 'disabled';
        else {
            const delivery = record.delivery;
            await (0, emailService_1.sendEmail)({
                to: delivery.to,
                cc: delivery.cc,
                subject: delivery.subject,
                html: submissionEmailHtml(record),
                ...(record.replyTo ? { replyTo: record.replyTo } : {}),
            });
            status = 'sent';
        }
    }
    catch {
        // Do not put visitor data, email addresses, or provider error payloads in logs.
        status = 'failed';
    }
    await runtime_1.db.runTransaction(async (transaction) => {
        const current = await transaction.get(ref);
        if (current.data()?.attemptId === attemptId)
            transaction.update(ref, { emailStatus: status, attemptFinishedAt: Date.now() });
    });
}
exports.deliverWebsiteFormEmail = (0, firestore_1.onDocumentCreated)({
    document: 'websiteSubmissions/{submissionId}',
    secrets: (0, functionConfig_1.getGraphEmailSecrets)(),
    timeoutSeconds: 120,
    retry: false,
}, async (event) => {
    await deliverWebsiteSubmission(event.params.submissionId);
});
exports.websiteFormAdmin = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)(), timeoutSeconds: 120 }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to view submissions.');
    const snapshot = await runtime_1.db.doc(`users/${request.auth.uid}`).get();
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(request.auth.uid, snapshot.data() || {});
    if (!snapshot.exists || !user.active || user.role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Only active admins can view submissions.');
    const data = request.data || {};
    if (data.action === 'retry') {
        if (!validId(data.id))
            throw new https_1.HttpsError('invalid-argument', 'Choose a submission.');
        await deliverWebsiteSubmission(data.id, true);
        return { emailStatus: (await submissions.doc(data.id).get()).data()?.emailStatus };
    }
    if (data.action !== 'list')
        throw new https_1.HttpsError('invalid-argument', 'Unknown submissions action.');
    let query = submissions
        .orderBy('createdAt', 'desc')
        .orderBy(firestore_2.FieldPath.documentId(), 'desc')
        .limit(26);
    if (data.cursor !== undefined) {
        if (!validId(data.cursor))
            throw new https_1.HttpsError('invalid-argument', 'Invalid submissions cursor.');
        const cursor = await submissions.doc(data.cursor).get();
        if (!cursor.exists)
            throw new https_1.HttpsError('invalid-argument', 'Refresh the submissions list.');
        query = query.startAfter(cursor);
    }
    const records = (await query.get()).docs;
    return {
        submissions: records.slice(0, 25).map((record) => {
            const data = record.data();
            return {
                id: record.id,
                formName: data.formName,
                createdAt: data.createdAt,
                answers: data.answers,
                emailStatus: data.emailStatus,
                attempts: data.attempts,
                attemptStartedAt: data.attemptStartedAt || null,
            };
        }),
        nextCursor: records.length > 25 ? records[24].id : null,
    };
});
//# sourceMappingURL=websiteFormFunctions.js.map