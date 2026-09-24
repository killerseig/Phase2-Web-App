"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTheme = exports.themeNumbers = exports.themeColors = void 0;
exports.validateTheme = validateTheme;
exports.contrastRatio = contrastRatio;
exports.themeWarnings = themeWarnings;
exports.themeColors = [
    'background',
    'surface',
    'text',
    'muted',
    'border',
    'buttonText',
];
exports.themeNumbers = {
    fontSize: { label: 'Body text size', min: 14, max: 24, step: 1 },
    lineHeight: { label: 'Line height', min: 1.3, max: 2, step: 0.05 },
    radius: { label: 'Button corner radius', min: 0, max: 32, step: 1 },
    spacing: { label: 'Default flow spacing', min: 0, max: 80, step: 1 },
    contentWidth: { label: 'Flow content width', min: 720, max: 1600, step: 10 },
};
exports.defaultTheme = {
    background: '#f4f6f8',
    surface: '#ffffff',
    text: '#172c40',
    muted: '#526779',
    border: '#d7e0e8',
    buttonText: '#ffffff',
    bodyFont: 'sans',
    headingFont: 'display',
    fontSize: 18,
    lineHeight: 1.6,
    radius: 6,
    spacing: 24,
    contentWidth: 1200,
};
function validateTheme(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid website design settings.');
    const data = value, result = {};
    if (Object.keys(data).some((key) => ![...exports.themeColors, ...Object.keys(exports.themeNumbers), 'bodyFont', 'headingFont'].includes(key)))
        throw new Error('Unknown website design setting.');
    for (const key of exports.themeColors)
        if (data[key] !== undefined) {
            if (typeof data[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(data[key]))
                throw new Error('Choose a six-digit hex color.');
            result[key] = data[key];
        }
    for (const [key, limits] of Object.entries(exports.themeNumbers))
        if (data[key] !== undefined) {
            if (typeof data[key] !== 'number' ||
                !Number.isFinite(data[key]) ||
                Number(data[key]) < limits.min ||
                Number(data[key]) > limits.max)
                throw new Error(`Check ${limits.label.toLowerCase()}.`);
            result[key] = data[key];
        }
    for (const [key, choices] of Object.entries({
        bodyFont: ['sans', 'serif', 'mono'],
        headingFont: ['sans', 'serif', 'display'],
    }))
        if (data[key] !== undefined) {
            if (!choices.includes(data[key]))
                throw new Error('Choose a supported website font.');
            result[key] = data[key];
        }
    return result;
}
function contrastRatio(first, second) {
    function luminance(color) {
        const values = [1, 3, 5]
            .map((start) => parseInt(color.slice(start, start + 2), 16) / 255)
            .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    }
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function themeWarnings(theme, accent) {
    const values = { ...exports.defaultTheme, ...theme }, warnings = [];
    for (const [label, foreground, background] of [
        ['Body text on page', values.text, values.background],
        ['Body text on widgets', values.text, values.surface],
        ['Secondary text', values.muted, values.surface],
        ['Button text', values.buttonText, accent],
    ])
        if (contrastRatio(foreground, background) < 4.5)
            warnings.push(`${label}: increase color contrast for readable text.`);
    return warnings;
}
//# sourceMappingURL=websiteTheme.js.map