"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardWorkspace = void 0;
exports.validateDashboardWidgets = validateDashboardWidgets;
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const roleAccess_1 = require("./roleAccess");
const constants_1 = require("./constants");
function validateDashboardWidgets(value) {
    if (!Array.isArray(value) || value.length > 12)
        throw new https_1.HttpsError('invalid-argument', 'Use no more than 12 widgets.');
    const ids = new Set();
    const singletons = new Set();
    return value.map((entry) => {
        if (!entry ||
            typeof entry !== 'object' ||
            typeof entry.id !== 'string' ||
            !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
            ids.has(entry.id) ||
            !['documents', 'resources', 'notes', 'shortcuts'].includes(entry.type) ||
            ![4, 6, 8, 12].includes(entry.span) ||
            typeof entry.title !== 'string' ||
            entry.title.length > 100 ||
            typeof entry.text !== 'string' ||
            entry.text.length > 8000)
            throw new https_1.HttpsError('invalid-argument', 'Invalid dashboard widget.');
        ids.add(entry.id);
        if (entry.type !== 'notes') {
            if (singletons.has(entry.type))
                throw new https_1.HttpsError('invalid-argument', 'Add each tool only once.');
            singletons.add(entry.type);
        }
        return {
            id: entry.id,
            type: entry.type,
            span: entry.span,
            title: entry.title,
            text: entry.text,
        };
    });
}
exports.dashboardWorkspace = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in to use dashboards.');
    const data = request.data || {};
    if (!['load', 'save'].includes(data.action) || !['personal', 'role'].includes(data.scope))
        throw new https_1.HttpsError('invalid-argument', 'Choose a dashboard and an action.');
    if (data.uid !== undefined || data.ownerId !== undefined)
        throw new https_1.HttpsError('invalid-argument', 'Personal dashboards belong to the signed-in user.');
    const widgets = data.action === 'save' ? validateDashboardWidgets(data.widgets) : undefined;
    return runtime_1.db.runTransaction(async (transaction) => {
        const profile = await transaction.get(runtime_1.db.doc(`users/${uid}`));
        const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, profile.data() || {});
        if (!profile.exists || !user.active || user.role === 'none')
            throw new https_1.HttpsError('permission-denied', 'Your account does not have workspace access.');
        let role = user.role;
        if (data.scope === 'role') {
            if (data.role !== undefined) {
                if (!constants_1.VALID_ROLES.includes(data.role) || data.role === 'none')
                    throw new https_1.HttpsError('invalid-argument', 'Choose an active role.');
                role = data.role;
            }
            if (user.role !== 'admin' && role !== user.role)
                throw new https_1.HttpsError('permission-denied', 'You can only view your own role dashboard.');
        }
        const canEdit = data.scope === 'personal' || user.role === 'admin';
        if (data.action === 'save' && !canEdit)
            throw new https_1.HttpsError('permission-denied', 'Only admins can edit shared role layouts.');
        const ref = runtime_1.db.doc(data.scope === 'personal' ? `dashboardPersonal/${uid}` : `dashboardRoles/${role}`);
        const record = await transaction.get(ref);
        const version = record.data()?.version || 0;
        if (data.action === 'save') {
            if (!Number.isSafeInteger(data.version) || data.version !== version)
                throw new https_1.HttpsError('aborted', 'This dashboard changed elsewhere. Reload and review before saving.');
            transaction.set(ref, { version: version + 1, widgets, updatedBy: uid, updatedAt: Date.now() });
            return { version: version + 1, widgets, canEdit };
        }
        return {
            version,
            canEdit,
            widgets: record.data()?.widgets || [
                { id: 'documents', type: 'documents', span: 12, title: 'Documents', text: '' },
            ],
        };
    });
});
//# sourceMappingURL=dashboardFunctions.js.map