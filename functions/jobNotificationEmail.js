"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_NOTIFICATION_CLAIM_LEASE_MS = void 0;
exports.isValidJobNotificationRecipient = isValidJobNotificationRecipient;
exports.getJobNotificationClaimDisposition = getJobNotificationClaimDisposition;
exports.claimJobNotificationEventInTransaction = claimJobNotificationEventInTransaction;
exports.normalizeJobNotificationRecord = normalizeJobNotificationRecord;
exports.getNewlyAssignedFieldUserIds = getNewlyAssignedFieldUserIds;
exports.buildNewJobNotificationSubject = buildNewJobNotificationSubject;
exports.buildFieldUserAssignmentNotificationSubject = buildFieldUserAssignmentNotificationSubject;
exports.buildNewJobNotificationEmail = buildNewJobNotificationEmail;
exports.buildFieldUserAssignmentNotificationEmail = buildFieldUserAssignmentNotificationEmail;
exports.handleNewJobNotification = handleNewJobNotification;
exports.handleFieldUserAssignmentNotification = handleFieldUserAssignmentNotification;
const firestore_1 = require("firebase-admin/firestore");
const constants_1 = require("./constants");
exports.JOB_NOTIFICATION_CLAIM_LEASE_MS = 10 * 60 * 1000;
const JOB_NOTIFICATION_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
function text(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return '';
}
function textOrNull(value) {
    return text(value) || null;
}
function normalizeIdList(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !entry.includes('/'))));
}
function isValidJobNotificationRecipient(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function timestampToMillis(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'object') {
        const candidate = value;
        if (typeof candidate.toMillis === 'function') {
            const millis = candidate.toMillis();
            return Number.isFinite(millis) ? millis : null;
        }
        if (typeof candidate.toDate === 'function') {
            const date = candidate.toDate();
            return Number.isNaN(date.getTime()) ? null : date.getTime();
        }
        if (typeof candidate.seconds === 'number' && Number.isFinite(candidate.seconds)) {
            return candidate.seconds * 1000 + Math.floor((candidate.nanoseconds || 0) / 1000000);
        }
    }
    return null;
}
function getJobNotificationClaimDisposition(value, nowMs = Date.now(), leaseMs = exports.JOB_NOTIFICATION_CLAIM_LEASE_MS) {
    if (!value || typeof value !== 'object')
        return 'claim';
    const data = value;
    if (data.status === 'sent')
        return 'sent';
    if (data.status === 'failed-permanent')
        return 'failed-permanent';
    if (data.status !== 'processing')
        return 'claim';
    const leaseExpiresAt = timestampToMillis(data.leaseExpiresAt);
    if (leaseExpiresAt !== null) {
        return leaseExpiresAt > nowMs ? 'in-progress' : 'claim';
    }
    const claimedAt = timestampToMillis(data.claimedAt);
    if (claimedAt === null)
        return 'claim';
    return nowMs - claimedAt < leaseMs ? 'in-progress' : 'claim';
}
function normalizeAttemptCount(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}
async function claimJobNotificationEventInTransaction(transaction, eventRef, eventKey, metadata, now = new Date()) {
    const snapshot = await transaction.get(eventRef);
    const existing = snapshot.exists ? snapshot.data() : null;
    const disposition = getJobNotificationClaimDisposition(existing, now.getTime());
    if (disposition === 'sent' || disposition === 'failed-permanent')
        return false;
    if (disposition === 'in-progress') {
        throw new Error(`Notification event ${eventKey} is already processing.`);
    }
    transaction.set(eventRef, {
        eventKey,
        jobId: metadata.jobId,
        notificationKey: metadata.notificationKey,
        status: 'processing',
        attemptCount: normalizeAttemptCount(existing?.attemptCount) + 1,
        claimedAt: firestore_1.FieldValue.serverTimestamp(),
        leaseExpiresAt: firestore_1.Timestamp.fromMillis(now.getTime() + exports.JOB_NOTIFICATION_CLAIM_LEASE_MS),
        // A Firestore TTL policy can safely remove old dedupe records after the event retry horizon.
        expiresAt: firestore_1.Timestamp.fromMillis(now.getTime() + JOB_NOTIFICATION_EVENT_RETENTION_MS),
    }, { merge: true });
    return true;
}
function normalizeRecipients(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter(isValidJobNotificationRecipient)));
}
function escapeHtml(value) {
    return text(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function formatJobType(value) {
    return (value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ') || 'General');
}
function formatJobLabel(job) {
    return [job.code ? `#${job.code}` : '', job.name].filter(Boolean).join(' ');
}
function renderRow(label, value) {
    return `
    <tr>
      <th style="width: 180px;">${escapeHtml(label)}</th>
      <td>${value ? escapeHtml(value) : '&mdash;'}</td>
    </tr>
  `;
}
function renderFieldUserList(names) {
    if (!names.length)
        return '<p style="margin: 0; color: #666;">No field users assigned.</p>';
    return `
    <ul style="margin: 0; padding-left: 22px;">
      ${names.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}
    </ul>
  `;
}
function buildNotificationEmail(options) {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        ${constants_1.EMAIL_STYLES}
      </head>
      <body>
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHtml(options.previewText)}</div>
        <div class="email-container">
          <div class="header"><h1>${escapeHtml(options.heading)}</h1></div>
          <div class="content">
            <p>${escapeHtml(options.intro)}</p>
            <table>
              ${renderRow('Job Number', options.job.code)}
              ${renderRow('Job Name', options.job.name)}
              ${renderRow('Job Type', formatJobType(options.job.type))}
              ${renderRow('General Contractor', options.job.gc)}
              ${renderRow('Job Address', options.job.jobAddress)}
              ${renderRow('Start Date', options.job.startDate)}
              ${renderRow('Finish Date', options.job.finishDate)}
            </table>
            <h2 style="font-size: 18px; margin: 24px 0 10px;">${escapeHtml(options.fieldUserHeading)}</h2>
            ${renderFieldUserList(options.fieldUserNames)}
          </div>
          <div class="footer"><p>This is an automated Phase 2 notification.</p></div>
        </div>
      </body>
    </html>
  `;
}
function normalizeJobNotificationRecord(jobId, value) {
    if (!value || typeof value !== 'object')
        return null;
    const data = value;
    return {
        id: text(jobId),
        name: text(data.name) || 'Untitled Job',
        code: textOrNull(data.code ?? data.number),
        type: text(data.type) || 'general',
        gc: textOrNull(data.gc),
        jobAddress: textOrNull(data.jobAddress),
        startDate: textOrNull(data.startDate),
        finishDate: textOrNull(data.finishDate),
        assignedFieldUserIds: normalizeIdList(data.assignedForemanIds),
    };
}
function getNewlyAssignedFieldUserIds(beforeValue, afterValue) {
    const before = normalizeJobNotificationRecord('', beforeValue);
    const after = normalizeJobNotificationRecord('', afterValue);
    if (!after)
        return [];
    const previousIds = new Set(before?.assignedFieldUserIds ?? []);
    return after.assignedFieldUserIds.filter((userId) => !previousIds.has(userId));
}
function buildNewJobNotificationSubject(job) {
    return `New Job | ${formatJobLabel(job)}`;
}
function buildFieldUserAssignmentNotificationSubject(job) {
    return `Field User Assignment | ${formatJobLabel(job)}`;
}
function buildNewJobNotificationEmail(job, fieldUserNames) {
    const subject = buildNewJobNotificationSubject(job);
    return buildNotificationEmail({
        heading: 'New Job Created',
        previewText: subject,
        intro: 'A new job was added to Phase 2.',
        job,
        fieldUserHeading: 'Initial Assigned Field Users',
        fieldUserNames,
    });
}
function buildFieldUserAssignmentNotificationEmail(job, fieldUserNames) {
    const subject = buildFieldUserAssignmentNotificationSubject(job);
    return buildNotificationEmail({
        heading: 'Field User Assignment',
        previewText: subject,
        intro: fieldUserNames.length === 1
            ? 'A field user was assigned to this job.'
            : 'Field users were assigned to this job.',
        job,
        fieldUserHeading: 'Newly Assigned Field Users',
        fieldUserNames,
    });
}
async function deliverOnce(options) {
    const claimed = await options.deps.claimEvent(options.eventKey, {
        notificationKey: options.notificationKey,
        jobId: options.jobId,
    });
    if (!claimed)
        return 'skipped-duplicate';
    try {
        await options.deps.sendEmail({
            to: options.recipients,
            subject: options.subject,
            html: options.html,
        });
    }
    catch (error) {
        const failure = options.deps.classifySendError(error);
        if (!failure.retryable) {
            await options.deps.failEvent(options.eventKey, failure);
            return 'failed-permanent';
        }
        try {
            await options.deps.releaseEvent(options.eventKey);
        }
        catch (releaseError) {
            console.error('[jobNotification] Failed to release notification claim after a send error', {
                eventKey: options.eventKey,
                releaseError,
            });
        }
        throw error;
    }
    try {
        await options.deps.completeEvent(options.eventKey);
    }
    catch (error) {
        // The email is already sent. Keep the claim so a retry cannot send it twice.
        console.error('[jobNotification] Email sent, but the notification claim could not be completed', {
            eventKey: options.eventKey,
            error,
        });
    }
    return 'sent';
}
async function handleNewJobNotification(input, deps) {
    if (!deps.isEmailEnabled())
        return 'skipped-email-disabled';
    const job = normalizeJobNotificationRecord(input.jobId, input.jobData);
    if (!job)
        return 'skipped-missing-job';
    const recipients = normalizeRecipients(await deps.getGlobalRecipients('newJobs'));
    if (!recipients.length)
        return 'skipped-no-recipients';
    const fieldUserNames = job.assignedFieldUserIds.length
        ? await deps.getFieldUserNames(job.assignedFieldUserIds)
        : [];
    return deliverOnce({
        eventKey: `newJobs:${input.eventId}`,
        jobId: job.id,
        notificationKey: 'newJobs',
        recipients,
        subject: buildNewJobNotificationSubject(job),
        html: buildNewJobNotificationEmail(job, fieldUserNames),
        deps,
    });
}
async function handleFieldUserAssignmentNotification(input, deps) {
    if (!deps.isEmailEnabled())
        return 'skipped-email-disabled';
    const job = normalizeJobNotificationRecord(input.jobId, input.afterData);
    if (!job)
        return 'skipped-missing-job';
    const newlyAssignedIds = getNewlyAssignedFieldUserIds(input.beforeData, input.afterData);
    if (!newlyAssignedIds.length)
        return 'skipped-no-new-assignments';
    const recipients = normalizeRecipients(await deps.getGlobalRecipients('fieldUserAssignments'));
    if (!recipients.length)
        return 'skipped-no-recipients';
    const fieldUserNames = await deps.getFieldUserNames(newlyAssignedIds);
    return deliverOnce({
        eventKey: `fieldUserAssignments:${input.eventId}`,
        jobId: job.id,
        notificationKey: 'fieldUserAssignments',
        recipients,
        subject: buildFieldUserAssignmentNotificationSubject(job),
        html: buildFieldUserAssignmentNotificationEmail(job, fieldUserNames),
        deps,
    });
}
//# sourceMappingURL=jobNotificationEmail.js.map