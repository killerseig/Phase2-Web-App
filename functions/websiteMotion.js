"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motionEffects = void 0;
exports.validateMotion = validateMotion;
exports.motionEffects = {
    none: 'None',
    fade: 'Fade in',
    rise: 'Fade up',
    slide: 'Slide in',
    zoom: 'Gentle zoom',
};
function validateMotion(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('Invalid widget animation.');
    const data = raw;
    if (!Object.keys(exports.motionEffects).includes(String(data.effect)) ||
        Object.keys(data).some((key) => !['effect', 'duration', 'delay', 'easing'].includes(key)))
        throw new Error('Choose a supported widget animation.');
    const result = { effect: data.effect };
    for (const key of ['duration', 'delay']) {
        if (data[key] === undefined)
            continue;
        if (typeof data[key] !== 'number' ||
            !Number.isFinite(data[key]) ||
            data[key] < (key === 'duration' ? 100 : 0) ||
            data[key] > 3000)
            throw new Error(`Animation ${key} must be between ${key === 'duration' ? 100 : 0} and 3000 ms.`);
        result[key] = data[key];
    }
    if (data.easing !== undefined) {
        if (!['linear', 'ease-in', 'ease-out', 'ease-in-out'].includes(String(data.easing)))
            throw new Error('Choose a supported animation easing.');
        result.easing = data.easing;
    }
    return result;
}
//# sourceMappingURL=websiteMotion.js.map