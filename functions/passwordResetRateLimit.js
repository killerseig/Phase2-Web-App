"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextResetAllowance = nextResetAllowance;
exports.consumePasswordResetAllowance = consumePasswordResetAllowance;
const node_crypto_1 = require("node:crypto");
const runtime_1 = require("./runtime");
const WINDOW_MS = 60 * 60 * 1000;
function nextResetAllowance(data, limit, now) {
    const start = Number(data.windowStart);
    const count = Number(data.count);
    const current = Number.isFinite(start) && start > now - WINDOW_MS && start <= now;
    if (current && (!Number.isFinite(count) || count >= limit))
        return null;
    return { windowStart: current ? start : now, count: current ? count + 1 : 1 };
}
async function consumePasswordResetAllowance(email, ip) {
    const key = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
    const emailRef = runtime_1.db.collection('passwordResetLimits').doc(key(`email:${email}`));
    const ipRef = runtime_1.db.collection('passwordResetLimits').doc(key(`ip:${ip}`));
    return runtime_1.db.runTransaction(async (transaction) => {
        const [emailSnapshot, ipSnapshot] = await Promise.all([transaction.get(emailRef), transaction.get(ipRef)]);
        const now = Date.now();
        const emailNext = nextResetAllowance(emailSnapshot.data() || {}, 3, now);
        const ipNext = nextResetAllowance(ipSnapshot.data() || {}, 20, now);
        if (!emailNext || !ipNext)
            return false;
        transaction.set(emailRef, emailNext);
        transaction.set(ipRef, ipNext);
        return true;
    });
}
//# sourceMappingURL=passwordResetRateLimit.js.map