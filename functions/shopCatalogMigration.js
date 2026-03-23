"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreShopCatalogMigrationBackup = exports.runShopCatalogMigration = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const ITEM_PREFIX = 'item-';
const CATEGORY_NODE_PREFIX = 'category:';
const ITEM_NODE_PREFIX = 'item:';
const BATCH_LIMIT = 400;
const migrationSecret = (0, params_1.defineSecret)('SHOP_CATALOG_MIGRATION_SECRET');
function createCatalogItemNodeId(itemId) {
    return `${ITEM_PREFIX}${itemId}`;
}
function createLegacyCategoryNodeId(categoryId) {
    return `${CATEGORY_NODE_PREFIX}${categoryId}`;
}
function createLegacyItemNodeId(itemId) {
    return `${ITEM_NODE_PREFIX}${itemId}`;
}
function getRawNodeId(legacyNodeId) {
    const separatorIndex = legacyNodeId.indexOf(':');
    return separatorIndex >= 0 ? legacyNodeId.slice(separatorIndex + 1) : legacyNodeId;
}
function hasPurchasingFields(node) {
    return Boolean((typeof node.sku === 'string' && node.sku.trim()) ||
        typeof node.price === 'number');
}
function normalizeLegacyParentNodeId(parentId, categoryIds, itemIds) {
    if (!parentId)
        return null;
    if (parentId.startsWith(ITEM_PREFIX)) {
        const itemId = parentId.slice(ITEM_PREFIX.length);
        return itemIds.has(itemId) ? createLegacyItemNodeId(itemId) : null;
    }
    if (itemIds.has(parentId))
        return createLegacyItemNodeId(parentId);
    if (categoryIds.has(parentId))
        return createLegacyCategoryNodeId(parentId);
    return null;
}
function buildLegacyNodes(categories, items) {
    const nodes = new Map();
    categories.forEach((category) => {
        const legacyNodeId = createLegacyCategoryNodeId(category.id);
        nodes.set(legacyNodeId, {
            legacyNodeId,
            rawId: category.id,
            sourceType: 'category',
            name: category.name ?? '',
            parentRef: typeof category.parentId === 'string' ? category.parentId : null,
            sku: category.sku,
            price: category.price,
            active: category.active ?? true,
            createdAt: category.createdAt ?? null,
            updatedAt: category.updatedAt ?? null,
        });
    });
    items.forEach((item) => {
        const legacyNodeId = createLegacyItemNodeId(item.id);
        nodes.set(legacyNodeId, {
            legacyNodeId,
            rawId: item.id,
            sourceType: 'item',
            name: item.description ?? '',
            parentRef: typeof item.categoryId === 'string' ? item.categoryId : null,
            sku: item.sku,
            price: item.price,
            active: item.active ?? true,
            createdAt: item.createdAt ?? null,
            updatedAt: item.updatedAt ?? null,
        });
    });
    return nodes;
}
function buildLegacyChildMap(nodes, categoryIds, itemIds) {
    const childIds = new Map();
    const ensureBucket = (nodeId) => {
        if (!childIds.has(nodeId)) {
            childIds.set(nodeId, []);
        }
    };
    nodes.forEach((node) => ensureBucket(node.legacyNodeId));
    nodes.forEach((node) => {
        const parentNodeId = normalizeLegacyParentNodeId(node.parentRef, categoryIds, itemIds);
        if (!parentNodeId)
            return;
        ensureBucket(parentNodeId);
        childIds.get(parentNodeId)?.push(node.legacyNodeId);
    });
    return childIds;
}
function resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds) {
    const parentNodeId = normalizeLegacyParentNodeId(node.parentRef, categoryIds, itemIds);
    if (!parentNodeId)
        return null;
    return finalCategoryNodeIds.has(parentNodeId) ? getRawNodeId(parentNodeId) : null;
}
function resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds) {
    return resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds);
}
function planShopCatalogMigration(categories, items) {
    const categoryIds = new Set(categories.map((category) => category.id));
    const itemIds = new Set(items.map((item) => item.id));
    const nodes = buildLegacyNodes(categories, items);
    const childIds = buildLegacyChildMap(nodes, categoryIds, itemIds);
    const finalCategoryNodeIds = new Set(Array.from(nodes.values())
        .filter((node) => (childIds.get(node.legacyNodeId) ?? []).length > 0)
        .map((node) => node.legacyNodeId));
    const finalItemNodeIds = new Set(Array.from(nodes.values())
        .filter((node) => (childIds.get(node.legacyNodeId) ?? []).length === 0)
        .map((node) => node.legacyNodeId));
    const finalCategoryIdsFromCategories = new Set(categories
        .filter((category) => finalCategoryNodeIds.has(createLegacyCategoryNodeId(category.id)))
        .map((category) => category.id));
    const finalItemIdsFromItems = new Set(items
        .filter((item) => finalItemNodeIds.has(createLegacyItemNodeId(item.id)))
        .map((item) => item.id));
    const itemToCategoryIdConflicts = items
        .filter((item) => finalCategoryNodeIds.has(createLegacyItemNodeId(item.id)))
        .filter((item) => finalCategoryIdsFromCategories.has(item.id))
        .map((item) => item.id);
    const categoryToItemIdConflicts = categories
        .filter((category) => finalItemNodeIds.has(createLegacyCategoryNodeId(category.id)))
        .filter((category) => finalItemIdsFromItems.has(category.id))
        .map((category) => category.id);
    const createCategoriesFromItems = Array.from(nodes.values())
        .filter((node) => node.sourceType === 'item' && finalCategoryNodeIds.has(node.legacyNodeId))
        .map((node) => ({
        sourceItemId: node.rawId,
        id: node.rawId,
        data: {
            name: node.name,
            parentId: resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds),
            active: node.active,
            createdAt: node.createdAt ?? null,
            updatedAt: node.updatedAt ?? null,
        },
    }));
    const createItemsFromCategories = Array.from(nodes.values())
        .filter((node) => node.sourceType === 'category' && finalItemNodeIds.has(node.legacyNodeId))
        .map((node) => ({
        sourceCategoryId: node.rawId,
        id: node.rawId,
        data: {
            description: node.name,
            categoryId: resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds),
            sku: node.sku ?? null,
            price: node.price ?? null,
            active: node.active,
            createdAt: node.createdAt ?? null,
            updatedAt: node.updatedAt ?? null,
        },
    }));
    const updateCategories = Array.from(nodes.values())
        .filter((node) => node.sourceType === 'category' && finalCategoryNodeIds.has(node.legacyNodeId))
        .map((node) => {
        const updates = {};
        const nextParentId = resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds);
        if ((node.parentRef ?? null) !== nextParentId) {
            updates.parentId = nextParentId;
        }
        if (node.sku !== undefined)
            updates.sku = null;
        if (node.price !== undefined)
            updates.price = null;
        return Object.keys(updates).length > 0 ? { id: node.rawId, updates } : null;
    })
        .filter((entry) => entry !== null);
    const updateItems = Array.from(nodes.values())
        .filter((node) => node.sourceType === 'item' && finalItemNodeIds.has(node.legacyNodeId))
        .map((node) => {
        const updates = {};
        const nextCategoryId = resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds);
        if ((node.parentRef ?? null) !== nextCategoryId) {
            updates.categoryId = nextCategoryId;
        }
        return Object.keys(updates).length > 0 ? { id: node.rawId, updates } : null;
    })
        .filter((entry) => entry !== null);
    const finalItemIdsWithoutPurchasingFields = Array.from(nodes.values())
        .filter((node) => finalItemNodeIds.has(node.legacyNodeId) && !hasPurchasingFields(node))
        .map((node) => node.rawId);
    const unresolvedCategoryParents = Array.from(nodes.values())
        .filter((node) => finalCategoryNodeIds.has(node.legacyNodeId))
        .filter((node) => node.parentRef && !resolveFinalCategoryParentId(node, categoryIds, itemIds, finalCategoryNodeIds))
        .map((node) => node.rawId);
    const unresolvedItemParents = Array.from(nodes.values())
        .filter((node) => finalItemNodeIds.has(node.legacyNodeId))
        .filter((node) => node.parentRef && !resolveFinalItemCategoryId(node, categoryIds, itemIds, finalCategoryNodeIds))
        .map((node) => node.rawId);
    return {
        summary: {
            totalCategories: categories.length,
            totalItems: items.length,
            finalCategories: finalCategoryNodeIds.size,
            finalItems: finalItemNodeIds.size,
            convertItemsToCategories: createCategoriesFromItems.length,
            convertCategoriesToItems: createItemsFromCategories.length,
            updateCategories: updateCategories.length,
            updateItems: updateItems.length,
            deleteCategoryIds: createItemsFromCategories.length,
            deleteItemIds: createCategoriesFromItems.length,
            conflicts: itemToCategoryIdConflicts.length + categoryToItemIdConflicts.length,
        },
        createCategoriesFromItems,
        createItemsFromCategories,
        updateCategories,
        updateItems,
        deleteCategoryIds: createItemsFromCategories.map((entry) => entry.id),
        deleteItemIds: createCategoriesFromItems.map((entry) => entry.id),
        warnings: {
            finalItemIdsWithoutPurchasingFields,
            unresolvedCategoryParents,
            unresolvedItemParents,
        },
        conflicts: {
            itemToCategoryIdConflicts,
            categoryToItemIdConflicts,
        },
    };
}
function normalizeCategoryDoc(snapshot) {
    const data = snapshot.data();
    return {
        id: snapshot.id,
        name: data.name ?? '',
        parentId: typeof data.parentId === 'string' ? data.parentId : null,
        sku: typeof data.sku === 'string' ? data.sku : undefined,
        price: typeof data.price === 'number' ? data.price : undefined,
        active: data.active ?? true,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
    };
}
function normalizeItemDoc(snapshot) {
    const data = snapshot.data();
    return {
        id: snapshot.id,
        description: data.description ?? '',
        categoryId: typeof data.categoryId === 'string' ? data.categoryId : null,
        sku: typeof data.sku === 'string' ? data.sku : undefined,
        price: typeof data.price === 'number' ? data.price : undefined,
        active: data.active ?? true,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
    };
}
function serializeBackupValue(value) {
    if (value instanceof admin.firestore.Timestamp) {
        return {
            __type: 'Timestamp',
            seconds: value.seconds,
            nanoseconds: value.nanoseconds,
        };
    }
    if (Array.isArray(value)) {
        return value.map((entry) => serializeBackupValue(entry));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeBackupValue(entry)]));
    }
    return value;
}
function deserializeBackupValue(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => deserializeBackupValue(entry));
    }
    if (value && typeof value === 'object') {
        const record = value;
        if (record.__type === 'Timestamp') {
            return new admin.firestore.Timestamp(Number(record.seconds ?? 0), Number(record.nanoseconds ?? 0));
        }
        return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, deserializeBackupValue(entry)]));
    }
    return value;
}
function sanitizeFirestoreData(data) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
async function commitOperations(operations) {
    const db = admin.firestore();
    let batch = db.batch();
    let count = 0;
    const flush = async () => {
        if (count === 0)
            return;
        await batch.commit();
        batch = db.batch();
        count = 0;
    };
    for (const operation of operations) {
        if (count >= BATCH_LIMIT) {
            await flush();
        }
        if (operation.type === 'set' && operation.data) {
            batch.set(operation.ref, operation.data);
        }
        else if (operation.type === 'update' && operation.data) {
            batch.update(operation.ref, operation.data);
        }
        else if (operation.type === 'delete') {
            batch.delete(operation.ref);
        }
        count += 1;
    }
    await flush();
}
function buildApplyOperations(plan, now) {
    const db = admin.firestore();
    const operations = [];
    for (const entry of plan.createCategoriesFromItems) {
        operations.push({
            type: 'set',
            ref: db.collection('shopCategories').doc(entry.id),
            data: sanitizeFirestoreData({
                ...entry.data,
                updatedAt: now,
            }),
        });
    }
    for (const entry of plan.updateCategories) {
        operations.push({
            type: 'update',
            ref: db.collection('shopCategories').doc(entry.id),
            data: sanitizeFirestoreData({
                ...entry.updates,
                updatedAt: now,
            }),
        });
    }
    for (const entry of plan.updateItems) {
        operations.push({
            type: 'update',
            ref: db.collection('shopCatalog').doc(entry.id),
            data: sanitizeFirestoreData({
                ...entry.updates,
                updatedAt: now,
            }),
        });
    }
    for (const entry of plan.createItemsFromCategories) {
        operations.push({
            type: 'set',
            ref: db.collection('shopCatalog').doc(entry.id),
            data: sanitizeFirestoreData({
                ...entry.data,
                updatedAt: now,
            }),
        });
    }
    for (const itemId of plan.deleteItemIds) {
        operations.push({
            type: 'delete',
            ref: db.collection('shopCatalog').doc(itemId),
        });
    }
    for (const categoryId of plan.deleteCategoryIds) {
        operations.push({
            type: 'delete',
            ref: db.collection('shopCategories').doc(categoryId),
        });
    }
    return operations;
}
function buildRestoreOperations(categories, items, currentCategoryRefs, currentItemRefs) {
    const db = admin.firestore();
    const operations = [];
    currentCategoryRefs.forEach((ref) => operations.push({ type: 'delete', ref }));
    currentItemRefs.forEach((ref) => operations.push({ type: 'delete', ref }));
    categories.forEach((category) => {
        operations.push({
            type: 'set',
            ref: db.collection('shopCategories').doc(category.id),
            data: sanitizeFirestoreData({
                name: category.name,
                parentId: category.parentId,
                sku: category.sku,
                price: category.price,
                active: category.active,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
            }),
        });
    });
    items.forEach((item) => {
        operations.push({
            type: 'set',
            ref: db.collection('shopCatalog').doc(item.id),
            data: sanitizeFirestoreData({
                description: item.description,
                categoryId: item.categoryId,
                sku: item.sku,
                price: item.price,
                active: item.active,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }),
        });
    });
    return operations;
}
function getRequestData(request) {
    if (request.method === 'GET') {
        return request.query ?? {};
    }
    if (request.body && typeof request.body === 'object') {
        return request.body;
    }
    return {};
}
function getRequestSecret(request, data) {
    const headerSecret = request.get('x-migration-secret');
    if (typeof headerSecret === 'string' && headerSecret.trim())
        return headerSecret.trim();
    const bodySecret = typeof data.secret === 'string' ? data.secret.trim() : '';
    return bodySecret;
}
function readBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string')
        return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    return false;
}
function resolveBackupFilePath(rawPath, defaultBucketName) {
    const trimmed = String(rawPath || '').trim();
    if (!trimmed) {
        throw new Error('Missing backupPath');
    }
    if (trimmed.startsWith('gs://')) {
        const withoutScheme = trimmed.slice('gs://'.length);
        const slashIndex = withoutScheme.indexOf('/');
        if (slashIndex === -1) {
            return { bucketName: withoutScheme, filePath: '' };
        }
        return {
            bucketName: withoutScheme.slice(0, slashIndex),
            filePath: withoutScheme.slice(slashIndex + 1),
        };
    }
    return {
        bucketName: defaultBucketName,
        filePath: trimmed,
    };
}
async function loadCurrentCatalogState() {
    const db = admin.firestore();
    const [categorySnapshot, itemSnapshot] = await Promise.all([
        db.collection('shopCategories').get(),
        db.collection('shopCatalog').get(),
    ]);
    return {
        categories: categorySnapshot.docs.map(normalizeCategoryDoc),
        items: itemSnapshot.docs.map(normalizeItemDoc),
    };
}
async function writeBackupToBucket(bucket, categories, items, plan) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `migration-backups/shop-catalog-backup-${timestamp}.json`;
    const file = bucket.file(filePath);
    const payload = {
        version: 1,
        createdAt: new Date().toISOString(),
        planSummary: plan.summary,
        categories: categories.map((category) => serializeBackupValue(category)),
        items: items.map((item) => serializeBackupValue(item)),
    };
    await file.save(JSON.stringify(payload, null, 2), {
        contentType: 'application/json',
    });
    return {
        filePath,
        gsUri: `gs://${bucket.name}/${filePath}`,
    };
}
async function previewOrApplyMigration(apply) {
    const bucket = admin.storage().bucket();
    const { categories, items } = await loadCurrentCatalogState();
    const plan = planShopCatalogMigration(categories, items);
    if (plan.summary.conflicts > 0) {
        throw new Error('Migration conflicts detected. Resolve them before applying the migration.');
    }
    if (!apply) {
        return {
            applied: false,
            plan,
        };
    }
    const backup = await writeBackupToBucket(bucket, categories, items, plan);
    const operations = buildApplyOperations(plan, admin.firestore.Timestamp.now());
    await commitOperations(operations);
    return {
        applied: true,
        backup,
        plan,
    };
}
async function restoreFromBackup(backupPath) {
    const defaultBucket = admin.storage().bucket();
    const location = resolveBackupFilePath(backupPath, defaultBucket.name);
    const bucket = admin.storage().bucket(location.bucketName);
    const file = bucket.file(location.filePath);
    const [rawBackup] = await file.download();
    const payload = JSON.parse(rawBackup.toString('utf8'));
    const categories = (payload.categories ?? []).map((entry) => deserializeBackupValue(entry));
    const items = (payload.items ?? []).map((entry) => deserializeBackupValue(entry));
    const db = admin.firestore();
    const [currentCategoryRefs, currentItemRefs] = await Promise.all([
        db.collection('shopCategories').listDocuments(),
        db.collection('shopCatalog').listDocuments(),
    ]);
    const operations = buildRestoreOperations(categories, items, currentCategoryRefs, currentItemRefs);
    await commitOperations(operations);
    return {
        restored: true,
        backupPath: `gs://${bucket.name}/${location.filePath}`,
        categories: categories.length,
        items: items.length,
    };
}
function writeJson(response, status, payload) {
    response.status(status).json(payload);
}
function allowCors(response) {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Headers', 'Content-Type, X-Migration-Secret');
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
exports.runShopCatalogMigration = (0, https_1.onRequest)({
    secrets: [migrationSecret],
    timeoutSeconds: 540,
    memory: '1GiB',
}, async (request, response) => {
    allowCors(response);
    if (request.method === 'OPTIONS') {
        response.status(204).send('');
        return;
    }
    const data = getRequestData(request);
    const providedSecret = getRequestSecret(request, data);
    if (providedSecret !== migrationSecret.value()) {
        writeJson(response, 403, { success: false, error: 'Invalid migration secret' });
        return;
    }
    try {
        const result = await previewOrApplyMigration(readBoolean(data.apply));
        writeJson(response, 200, {
            success: true,
            ...result,
        });
    }
    catch (error) {
        writeJson(response, 500, {
            success: false,
            error: error instanceof Error ? error.message : 'Migration failed',
        });
    }
});
exports.restoreShopCatalogMigrationBackup = (0, https_1.onRequest)({
    secrets: [migrationSecret],
    timeoutSeconds: 540,
    memory: '1GiB',
}, async (request, response) => {
    allowCors(response);
    if (request.method === 'OPTIONS') {
        response.status(204).send('');
        return;
    }
    const data = getRequestData(request);
    const providedSecret = getRequestSecret(request, data);
    if (providedSecret !== migrationSecret.value()) {
        writeJson(response, 403, { success: false, error: 'Invalid migration secret' });
        return;
    }
    if (!readBoolean(data.apply)) {
        writeJson(response, 400, {
            success: false,
            error: 'Restore is destructive. Re-run with apply=true.',
        });
        return;
    }
    try {
        const result = await restoreFromBackup(typeof data.backupPath === 'string' ? data.backupPath : '');
        writeJson(response, 200, {
            success: true,
            ...result,
        });
    }
    catch (error) {
        writeJson(response, 500, {
            success: false,
            error: error instanceof Error ? error.message : 'Restore failed',
        });
    }
});
//# sourceMappingURL=shopCatalogMigration.js.map