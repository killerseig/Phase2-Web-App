"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textStyleLimits = exports.textStyleNames = void 0;
exports.validateTextStyles = validateTextStyles;
const websiteFonts_1 = require("./websiteFonts");
exports.textStyleNames = {
    pageTitle: 'Page title',
    sectionHeading: 'Section heading',
    body: 'Body text',
};
exports.textStyleLimits = {
    size: { min: 8, max: 160 },
    weight: { min: 100, max: 900 },
    lineHeight: { min: 1, max: 3 },
};
function validateTextStyles(raw) {
    const object = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('Invalid reusable text style.');
        return value;
    };
    function values(raw, responsive = false) {
        const data = object(raw), result = {};
        if (Object.keys(data).some((key) => !['font', ...Object.keys(exports.textStyleLimits), ...(responsive ? ['devices'] : [])].includes(key)))
            throw new Error('Unknown text style setting.');
        if (data.font !== undefined) {
            if (!Object.keys(websiteFonts_1.websiteFonts).includes(String(data.font)))
                throw new Error('Choose a supported text style font.');
            result.font = data.font;
        }
        for (const [key, limits] of Object.entries(exports.textStyleLimits)) {
            if (data[key] === undefined)
                continue;
            if (typeof data[key] !== 'number' ||
                !Number.isFinite(data[key]) ||
                data[key] < limits.min ||
                data[key] > limits.max)
                throw new Error(`Invalid text style ${key}.`);
            Object.assign(result, { [key]: data[key] });
        }
        if (data.devices !== undefined) {
            const devices = object(data.devices);
            if (Object.keys(devices).some((key) => !['tablet', 'mobile'].includes(key)))
                throw new Error('Invalid typography device.');
            result.devices = {};
            for (const device of ['tablet', 'mobile'])
                if (devices[device] !== undefined)
                    result.devices[device] = values(devices[device]);
        }
        return result;
    }
    const data = object(raw), result = {};
    for (const key of Object.keys(data)) {
        if (!Object.keys(exports.textStyleNames).includes(key))
            throw new Error('Unknown reusable text style.');
        result[key] = values(data[key], true);
    }
    return result;
}
//# sourceMappingURL=websiteTypography.js.map