"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphSecretExpirationDate = exports.appBaseUrl = exports.emailEnabled = exports.outlookSenderEmail = exports.graphClientSecret = exports.graphTenantId = exports.graphClientId = void 0;
exports.getGraphEmailSecrets = getGraphEmailSecrets;
exports.getAppBaseUrl = getAppBaseUrl;
exports.getGraphSecretExpirationDate = getGraphSecretExpirationDate;
const params_1 = require("firebase-functions/params");
const DEFAULT_APP_BASE_URL = 'https://phase2-website.web.app';
const DEFAULT_GRAPH_SECRET_EXPIRATION_DATE = '2027-02-09';
exports.graphClientId = (0, params_1.defineSecret)('GRAPH_CLIENT_ID');
exports.graphTenantId = (0, params_1.defineSecret)('GRAPH_TENANT_ID');
exports.graphClientSecret = (0, params_1.defineSecret)('GRAPH_CLIENT_SECRET');
exports.outlookSenderEmail = (0, params_1.defineSecret)('OUTLOOK_SENDER_EMAIL');
exports.emailEnabled = (0, params_1.defineBoolean)('EMAIL_ENABLED', { default: true });
exports.appBaseUrl = (0, params_1.defineString)('APP_BASE_URL', { default: DEFAULT_APP_BASE_URL });
exports.graphSecretExpirationDate = (0, params_1.defineString)('GRAPH_SECRET_EXPIRATION_DATE', {
    default: DEFAULT_GRAPH_SECRET_EXPIRATION_DATE,
});
function getGraphEmailSecrets() {
    return [
        exports.graphClientId,
        exports.graphTenantId,
        exports.graphClientSecret,
        exports.outlookSenderEmail,
    ];
}
function getAppBaseUrl() {
    return String(exports.appBaseUrl.value() || DEFAULT_APP_BASE_URL).replace(/\/+$/, '');
}
function getGraphSecretExpirationDate() {
    return String(exports.graphSecretExpirationDate.value() || DEFAULT_GRAPH_SECRET_EXPIRATION_DATE);
}
//# sourceMappingURL=functionConfig.js.map