"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageBucket = exports.auth = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
exports.db = (0, firestore_1.getFirestore)();
exports.auth = (0, auth_1.getAuth)();
exports.storageBucket = (0, storage_1.getStorage)().bucket();
//# sourceMappingURL=runtime.js.map