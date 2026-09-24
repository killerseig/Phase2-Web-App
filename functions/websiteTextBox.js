"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTextBoxes = validateTextBoxes;
function validateTextBoxes(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid text layout.');
    const result = {};
    for (const [field, box] of Object.entries(value)) {
        if (!['title', 'text', 'image', 'button'].includes(field) ||
            !box ||
            typeof box !== 'object' ||
            Array.isArray(box))
            throw new Error('Invalid text layout.');
        const next = {};
        for (const [key, number] of Object.entries(box)) {
            if (key === 'devices') {
                if (!number || typeof number !== 'object' || Array.isArray(number))
                    throw new Error('Invalid text layout devices.');
                next.devices = {};
                for (const [device, override] of Object.entries(number)) {
                    if (!['tablet', 'mobile'].includes(device) ||
                        !override ||
                        typeof override !== 'object' ||
                        'devices' in override)
                        throw new Error('Invalid text layout device.');
                    next.devices[device] = validateTextBoxes({
                        title: override,
                    }).title;
                }
                continue;
            }
            if (key === 'lockAspect') {
                if (typeof number !== 'boolean')
                    throw new Error('Invalid text layout aspect lock.');
                next.lockAspect = number;
                continue;
            }
            const limits = {
                x: [-4000, 4000],
                y: [-4000, 4000],
                width: [24, 4000],
                height: [24, 4000],
                rotation: [-180, 180],
                padding: [0, 400],
            }[key];
            if (!limits ||
                typeof number !== 'number' ||
                !Number.isFinite(number) ||
                number < limits[0] ||
                number > limits[1])
                throw new Error('Invalid text layout dimension.');
            next[key] = number;
        }
        result[field] = next;
    }
    return result;
}
//# sourceMappingURL=websiteTextBox.js.map