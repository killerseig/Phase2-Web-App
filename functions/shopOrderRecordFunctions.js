"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteShopOrderRecordCallable = exports.updateShopOrderRecordCallable = exports.createShopOrderRecordCallable = exports.listShopOrdersForCurrentUser = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const roleAccess_1 = require("./roleAccess");
const fieldWorkflowAccess_1 = require("./fieldWorkflowAccess");
const firestoreService_1 = require("./firestoreService");
const jobIdentity_1 = require("./jobIdentity");
const runtime_1 = require("./runtime");
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function textOrNull(value) {
    const normalized = text(value);
    return normalized || null;
}
function toStatus(value) {
    return value === 'submitted' ? 'submitted' : 'draft';
}
function toQuantity(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value >= 1 ? Math.round(value) : null;
    }
    if (typeof value === 'string' && value.trim().length) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : null;
    }
    return null;
}
function toPrice(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.round(value * 100) / 100;
    }
    if (typeof value === 'string' && value.trim().length) {
        const parsed = Number(value.replace(/[$,]/g, ''));
        return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
    }
    return null;
}
function makeItemId() {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
const shopOrderItemCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
});
function sanitizeItem(item) {
    return {
        id: text(item?.id) || makeItemId(),
        sourceType: text(item?.sourceType) === 'custom' ? 'custom' : 'catalog',
        catalogItemId: textOrNull(item?.catalogItemId),
        description: text(item?.description),
        quantity: toQuantity(item?.quantity),
        price: toPrice(item?.price),
        note: text(item?.note),
        categoryId: textOrNull(item?.categoryId),
        sku: textOrNull(item?.sku),
    };
}
function getShopOrderItemDisplayName(item) {
    const description = text(item?.description) || 'Untitled Item';
    if (text(item?.sourceType) !== 'catalog')
        return description;
    return description
        .split(' / ')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .at(-1) || description;
}
function sortShopOrderItems(items) {
    return items.slice().sort((left, right) => {
        const displayComparison = shopOrderItemCollator.compare(getShopOrderItemDisplayName(left), getShopOrderItemDisplayName(right));
        if (displayComparison !== 0)
            return displayComparison;
        const descriptionComparison = shopOrderItemCollator.compare(text(left.description), text(right.description));
        if (descriptionComparison !== 0)
            return descriptionComparison;
        return text(left.id).localeCompare(text(right.id));
    });
}
function sanitizeItems(items) {
    return sortShopOrderItems(items.map((item) => sanitizeItem(item)).filter((item) => item.description.length > 0));
}
async function getAuthorizedUser(uid) {
    const userSnap = await runtime_1.db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Your user profile was not found.');
    }
    const data = userSnap.data() || {};
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, data);
    if (!user.active) {
        throw new https_1.HttpsError('permission-denied', 'Your account is inactive.');
    }
    if (!(0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin', 'foreman', 'shop-foreman', 'project-manager'])) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to shop orders.');
    }
    return user;
}
async function getAuthorizedReader(uid) {
    const userSnap = await runtime_1.db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Your user profile was not found.');
    }
    const data = userSnap.data() || {};
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, data);
    if (!user.active) {
        throw new https_1.HttpsError('permission-denied', 'Your account is inactive.');
    }
    if (!(0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin', 'foreman', 'shop-foreman', 'project-manager'])) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to shop orders.');
    }
    return user;
}
function canReadJobShopOrders(user, jobId, jobDetails) {
    if (user.role === 'admin')
        return true;
    const assignedJobIds = new Set(user.assignedJobIds);
    if ((jobDetails?.assignedForemanIds ?? []).includes(user.uid)) {
        assignedJobIds.add(jobId);
    }
    if (assignedJobIds.has(jobId))
        return true;
    return user.role === 'shop-foreman' && (0, jobIdentity_1.isFunctionShopJob)(jobDetails);
}
function assertCanWriteJob(user, jobId, jobDetails, action) {
    if ((0, fieldWorkflowAccess_1.canWriteFieldWorkflowForJob)(user, jobId, jobDetails, action))
        return;
    throw new https_1.HttpsError('permission-denied', 'You are not assigned to this job.');
}
async function getShopOrderDoc(orderId) {
    const orderRef = runtime_1.db.collection('shopOrders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Shop order not found.');
    }
    const order = orderSnap.data() || {};
    const jobId = text(order.jobId);
    if (!jobId) {
        throw new https_1.HttpsError('failed-precondition', 'Shop order is missing its job assignment.');
    }
    return { orderRef, orderSnap, order, jobId };
}
function serializeFirestoreValue(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((entry) => serializeFirestoreValue(entry));
    }
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeFirestoreValue(entry)]));
    }
    return value;
}
function normalizeOrderForResponse(doc) {
    return {
        id: doc.id,
        ...serializeFirestoreValue(doc.data() || {}),
    };
}
function getOrderSortTimestamp(order) {
    const submitted = Date.parse(text(order?.submittedAt));
    if (Number.isFinite(submitted))
        return submitted;
    const updated = Date.parse(text(order?.updatedAt));
    if (Number.isFinite(updated))
        return updated;
    const created = Date.parse(text(order?.createdAt));
    return Number.isFinite(created) ? created : 0;
}
function sortOrderResponses(orders) {
    return orders.slice().sort((left, right) => (getOrderSortTimestamp(right) - getOrderSortTimestamp(left)
        || text(right.id).localeCompare(text(left.id))));
}
exports.listShopOrdersForCurrentUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const jobId = text(request.data?.jobId);
    if (!jobId || jobId.includes('/')) {
        throw new https_1.HttpsError('invalid-argument', 'jobId is required.');
    }
    const user = await getAuthorizedReader(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    if (!canReadJobShopOrders(user, jobId, jobDetails)) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to this job shop order workspace.');
    }
    const snapshot = await runtime_1.db.collection('shopOrders').where('jobId', '==', jobId).get();
    return {
        orders: sortOrderResponses(snapshot.docs.map(normalizeOrderForResponse)),
    };
});
exports.createShopOrderRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const jobId = text(request.data?.jobId);
    if (!jobId)
        throw new https_1.HttpsError('invalid-argument', 'jobId is required');
    const user = await getAuthorizedUser(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    assertCanWriteJob(user, jobId, jobDetails, 'create');
    const created = await runtime_1.db.collection('shopOrders').add({
        jobId,
        jobCode: textOrNull(request.data?.jobCode),
        jobName: textOrNull(request.data?.jobName),
        deliveryDate: textOrNull(request.data?.deliveryDate),
        status: 'draft',
        comments: '',
        foremanUserId: request.auth.uid,
        foremanName: user.displayName,
        createdByUserId: request.auth.uid,
        updatedByUserId: request.auth.uid,
        submittedByUserId: null,
        items: [],
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        submittedAt: null,
    });
    return { id: created.id };
});
exports.updateShopOrderRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const orderId = text(request.data?.orderId);
    if (!orderId)
        throw new https_1.HttpsError('invalid-argument', 'orderId is required');
    const { orderRef, order, jobId } = await getShopOrderDoc(orderId);
    const user = await getAuthorizedUser(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    const writeAction = ('status' in request.data && toStatus(request.data?.status) === 'submitted') ? 'submit' : 'edit-draft';
    assertCanWriteJob(user, jobId, jobDetails, writeAction);
    if (toStatus(order.status) === 'submitted' && user.role !== 'admin') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted shop orders cannot be changed by field users.');
    }
    const payload = {
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedByUserId: request.auth.uid,
    };
    if ('deliveryDate' in request.data) {
        payload.deliveryDate = textOrNull(request.data?.deliveryDate);
    }
    if ('comments' in request.data) {
        payload.comments = text(request.data?.comments);
    }
    if ('items' in request.data && Array.isArray(request.data?.items)) {
        payload.items = sanitizeItems(request.data.items);
    }
    if ('status' in request.data && request.data?.status) {
        const status = toStatus(request.data.status);
        payload.status = status;
        if (status === 'submitted') {
            payload.submittedAt = firestore_1.FieldValue.serverTimestamp();
            payload.submittedByUserId = request.auth.uid;
            payload.submittedByName = user.displayName;
        }
    }
    await orderRef.update(payload);
    return { success: true };
});
exports.deleteShopOrderRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const orderId = text(request.data?.orderId);
    if (!orderId)
        throw new https_1.HttpsError('invalid-argument', 'orderId is required');
    const { orderRef, order, jobId } = await getShopOrderDoc(orderId);
    const user = await getAuthorizedUser(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    assertCanWriteJob(user, jobId, jobDetails, 'edit-draft');
    if (toStatus(order.status) === 'submitted' && user.role !== 'admin') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted shop orders cannot be deleted by field users.');
    }
    await orderRef.delete();
    return { success: true };
});
//# sourceMappingURL=shopOrderRecordFunctions.js.map