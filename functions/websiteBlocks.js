"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.widgetIcons = exports.blockCollections = exports.blockTypes = exports.compactTypes = void 0;
exports.validateBlockItem = validateBlockItem;
exports.validateBlockOptions = validateBlockOptions;
exports.blockErrors = blockErrors;
exports.compactTypes = [
    'card',
    'profile-card',
    'metric',
    'progress-ring',
    'sparkline',
    'data-table',
];
exports.blockTypes = [
    'button',
    'icon',
    'divider',
    'spacer',
    'list',
    'badge',
    'alert',
    'team',
    'testimonials',
    'statistics',
    'logos',
    'chart',
    'timeline',
    'progress',
    ...exports.compactTypes,
];
exports.blockCollections = [
    'list',
    'team',
    'testimonials',
    'statistics',
    'logos',
    'chart',
    'timeline',
    'progress',
    'sparkline',
    'data-table',
];
exports.widgetIcons = [
    'star',
    'check',
    'heart',
    'briefcase',
    'building',
    'users',
    'shield',
    'wrench',
    'phone',
    'envelope',
    'map-marker',
    'info-circle',
    'exclamation-triangle',
    'clock',
    'trophy',
    'bolt',
];
function validateBlockItem(data) {
    const result = {};
    if (data.subtitle !== undefined) {
        if (typeof data.subtitle !== 'string' || data.subtitle.length > 160)
            throw new Error('Keep the subtitle within 160 characters.');
        result.subtitle = data.subtitle.trim();
    }
    if (data.value !== undefined) {
        if (typeof data.value !== 'number' ||
            !Number.isFinite(data.value) ||
            Math.abs(data.value) > 1e9)
            throw new Error('Enter a finite value between -1 billion and 1 billion.');
        result.value = data.value;
    }
    if (data.icon !== undefined) {
        if (!exports.widgetIcons.includes(data.icon))
            throw new Error('Choose an icon from the library.');
        result.icon = data.icon;
    }
    return result;
}
function validateBlockOptions(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid widget settings.');
    const data = value, result = {};
    if (Object.keys(data).some((key) => !['columns', 'variant', 'chartType', 'listStyle', 'showData'].includes(key)))
        throw new Error('Unknown widget setting.');
    if (data.showData !== undefined) {
        if (typeof data.showData !== 'boolean')
            throw new Error('Choose whether to show chart data.');
        result.showData = data.showData;
    }
    if (data.columns !== undefined) {
        if (!Number.isInteger(data.columns) || Number(data.columns) < 1 || Number(data.columns) > 6)
            throw new Error('Choose between one and six columns.');
        result.columns = data.columns;
    }
    for (const [key, choices] of Object.entries({
        variant: ['solid', 'outline'],
        chartType: ['bar', 'line', 'area', 'donut'],
        listStyle: ['bullet', 'numbered', 'check'],
    })) {
        if (data[key] === undefined)
            continue;
        if (!choices.includes(data[key]))
            throw new Error(`Invalid ${key} setting.`);
        Object.assign(result, { [key]: data[key] });
    }
    return result;
}
function blockErrors(section) {
    const errors = [];
    try {
        validateBlockItem({ ...section });
        for (const item of section.items)
            validateBlockItem({ ...item });
        if (section.blockOptions)
            validateBlockOptions(section.blockOptions);
    }
    catch (error) {
        errors.push(error instanceof Error ? error.message : 'Check widget settings.');
    }
    if (exports.compactTypes.includes(section.type) && !section.title.trim())
        errors.push('Give this component a title.');
    if (['metric', 'progress-ring'].includes(section.type) &&
        (typeof section.value !== 'number' || !Number.isFinite(section.value)))
        errors.push('Enter a numeric value for this component.');
    if (section.type === 'progress-ring' &&
        (Number(section.value) < 0 || Number(section.value) > 100))
        errors.push('Progress must be between 0 and 100.');
    if (section.type === 'button' && (!section.linkLabel || !section.linkUrl))
        errors.push('Give the button a label and link.');
    if (['badge', 'icon'].includes(section.type) && !section.title.trim())
        errors.push('Give this widget a label.');
    if (section.type === 'alert' && !section.title.trim() && !section.text.trim())
        errors.push('Add a heading or message.');
    if (exports.blockCollections.includes(section.type)) {
        if (!section.items.length)
            errors.push('Add at least one item.');
        for (const item of section.items) {
            if (!item.title.trim())
                errors.push('Give each item a heading or label.');
            if (['chart', 'statistics', 'progress', 'sparkline'].includes(section.type) &&
                (typeof item.value !== 'number' || !Number.isFinite(item.value)))
                errors.push('Enter a numeric value for each item.');
            if (section.type === 'progress' && (Number(item.value) < 0 || Number(item.value) > 100))
                errors.push('Progress values must be between 0 and 100.');
            if (section.type === 'data-table' && !item.text.trim() && item.value === undefined)
                errors.push('Add details or a value to each table row.');
            if (section.type === 'logos' && !item.imageId)
                errors.push('Choose an image for each logo.');
            if (section.type === 'testimonials' && !item.text.trim())
                errors.push('Add a quote to each testimonial.');
        }
        if (section.type === 'chart' &&
            section.blockOptions?.chartType === 'donut' &&
            (section.items.some((item) => Number(item.value) < 0) ||
                !section.items.some((item) => Number(item.value) > 0)))
            errors.push('Donut charts need nonnegative values and at least one positive value.');
    }
    return [...new Set(errors)];
}
//# sourceMappingURL=websiteBlocks.js.map