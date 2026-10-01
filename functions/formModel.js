"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formId = exports.optionFieldKinds = exports.formFieldKinds = void 0;
exports.validateFormDefinition = validateFormDefinition;
exports.isFieldRequired = isFieldRequired;
exports.validateFormAnswers = validateFormAnswers;
exports.attachedPhotoCount = attachedPhotoCount;
exports.formAnswerSummary = formAnswerSummary;
exports.respondentDefinition = respondentDefinition;
exports.formFieldKinds = [
    'text',
    'textarea',
    'email',
    'phone',
    'time',
    'date',
    'number',
    'choice',
    'checkbox',
    'radio',
    'multiselect',
    'photo',
];
exports.optionFieldKinds = ['choice', 'radio', 'multiselect'];
const formId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
exports.formId = formId;
const text = (value, max, required = false) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
        throw new Error('Invalid form text.');
    return value.trim();
};
const object = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid form data.');
    return value;
};
function validateFormDefinition(value) {
    const data = object(value);
    if (!Array.isArray(data.fields) ||
        data.fields.length < 1 ||
        data.fields.length > 60 ||
        !Array.isArray(data.recipients) ||
        data.recipients.length > 20)
        throw new Error('Add 1–60 fields and up to 20 recipients.');
    const recipients = [
        ...new Set(data.recipients.map((email) => text(email, 254, true).toLowerCase())),
    ];
    if (recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
        throw new Error('Use valid recipient email addresses.');
    const fields = data.fields.map((value) => {
        const field = object(value);
        if (!(0, exports.formId)(field.id) ||
            !exports.formFieldKinds.includes(field.kind) ||
            typeof field.required !== 'boolean' ||
            !Array.isArray(field.options))
            throw new Error('Invalid form field.');
        const kind = field.kind;
        const options = field.options.map((value) => text(value, 160, true));
        if (options.length > 30 ||
            new Set(options).size !== options.length ||
            (exports.optionFieldKinds.includes(kind) && options.length < 2))
            throw new Error('Choice fields need 2–30 different options.');
        const result = {
            id: field.id,
            kind,
            label: text(field.label, 160, true),
            required: field.required,
            options: exports.optionFieldKinds.includes(kind) ? options : [],
        };
        if (field.section !== undefined)
            result.section = text(field.section, 160);
        if (field.hint !== undefined)
            result.hint = text(field.hint, 1000);
        if (field.minimum !== undefined) {
            if (kind !== 'number' || typeof field.minimum !== 'number' || !Number.isFinite(field.minimum))
                throw new Error('Invalid minimum.');
            result.minimum = field.minimum;
        }
        if (field.integer !== undefined) {
            if (kind !== 'number' || typeof field.integer !== 'boolean')
                throw new Error('Invalid numeric step.');
            result.integer = field.integer;
        }
        if (field.requiredWhen !== undefined) {
            const condition = object(field.requiredWhen);
            if (!(0, exports.formId)(condition.fieldId) ||
                !Array.isArray(condition.values) ||
                !condition.values.length ||
                !['text', 'textarea'].includes(kind))
                throw new Error('Invalid required-note condition.');
            result.requiredWhen = {
                fieldId: condition.fieldId,
                values: condition.values.map((value) => text(value, 160, true)),
            };
        }
        return result;
    });
    if (new Set(fields.map((field) => field.id)).size !== fields.length)
        throw new Error('Field identifiers must be unique.');
    for (const field of fields)
        if (field.requiredWhen) {
            const rating = fields.find((item) => item.id === field.requiredWhen.fieldId);
            if (!rating ||
                !['choice', 'radio'].includes(rating.kind) ||
                field.requiredWhen.values.some((value) => !rating.options.includes(value)))
                throw new Error('Required notes must refer to a choice field and its valid values.');
        }
    return {
        title: text(data.title, 160, true),
        description: text(data.description, 5000),
        fields,
        recipients,
    };
}
function isFieldRequired(field, answers) {
    return (field.required ||
        !!(field.requiredWhen &&
            field.requiredWhen.values.includes(String(answers[field.requiredWhen.fieldId] || ''))));
}
function validateFormAnswers(definition, value, final) {
    const input = object(value), answers = {};
    if (Object.keys(input).some((id) => !definition.fields.some((field) => field.id === id)))
        throw new Error('Unknown answer field.');
    for (const field of definition.fields) {
        const value = input[field.id];
        if (field.kind === 'checkbox') {
            if (value !== undefined && typeof value !== 'boolean')
                throw new Error(field.label + ': use a checked or unchecked value.');
            answers[field.id] = value === undefined ? false : value;
            continue;
        }
        if (field.kind === 'multiselect') {
            if (value === undefined)
                answers[field.id] = [];
            else {
                if (!Array.isArray(value) ||
                    value.length > field.options.length ||
                    value.some((item) => typeof item !== 'string' || !field.options.includes(item)) ||
                    new Set(value).size !== value.length)
                    throw new Error(field.label + ': choose different listed options.');
                // Selection order is immaterial; store the definition's order for stable save retries and summaries.
                answers[field.id] = field.options.filter((option) => value.includes(option));
            }
            continue;
        }
        if (field.kind === 'photo') {
            if (value === undefined)
                answers[field.id] = [];
            else {
                if (!Array.isArray(value) ||
                    value.length > 5 ||
                    value.some((id) => !(0, exports.formId)(id)) ||
                    new Set(value).size !== value.length)
                    throw new Error(field.label + ': select up to five valid photos.');
                answers[field.id] = value;
            }
            continue;
        }
        if (value === undefined || value === '') {
            answers[field.id] = '';
            continue;
        }
        if (field.kind === 'number') {
            if ((typeof value !== 'number' &&
                (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value))) ||
                !Number.isFinite(Number(value)) ||
                (field.integer && !Number.isInteger(Number(value))) ||
                Math.abs(Number(value)) > 1000000 ||
                (field.minimum !== undefined && Number(value) < field.minimum))
                throw new Error(field.label + ': enter a valid number.');
            answers[field.id] = Number(value);
            continue;
        }
        const normalized = text(value, field.kind === 'textarea' ? 10000 : 1000);
        if (['choice', 'radio'].includes(field.kind) && !field.options.includes(normalized))
            throw new Error(field.label + ': choose a listed option.');
        if (field.kind === 'date' &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
                !Number.isFinite(Date.parse(normalized)) ||
                new Date(normalized).toISOString().slice(0, 10) !== normalized))
            throw new Error(field.label + ': enter a valid date.');
        if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
            throw new Error(field.label + ': enter a valid email address.');
        if (field.kind === 'phone' &&
            (!/^\+?[0-9() .-]{7,40}$/.test(normalized) ||
                normalized.replace(/\D/g, '').length < 7 ||
                normalized.replace(/\D/g, '').length > 15))
            throw new Error(field.label + ': enter a phone number with 7-15 digits.');
        if (field.kind === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized))
            throw new Error(field.label + ': enter a valid time in HH:mm format.');
        answers[field.id] = normalized;
    }
    if (attachedPhotoCount(definition, answers) > 20)
        throw new Error('Select up to 20 photos per record.');
    if (JSON.stringify(answers).length > 80000)
        throw new Error('This form exceeds the answer size limit.');
    if (final)
        for (const field of definition.fields)
            if (isFieldRequired(field, answers) &&
                (Array.isArray(answers[field.id])
                    ? !answers[field.id].length
                    : answers[field.id] === '' || (field.kind === 'checkbox' && answers[field.id] !== true)))
                throw new Error(field.label + ' is required.');
    return answers;
}
function attachedPhotoCount(definition, answers) {
    return definition.fields
        .filter((field) => field.kind === 'photo')
        .reduce((count, field) => count + (Array.isArray(answers[field.id]) ? answers[field.id].length : 0), 0);
}
function formAnswerSummary(field, value) {
    if (field.kind === 'checkbox')
        return value === true ? 'Yes' : 'No';
    if (field.kind === 'photo')
        return (String(Array.isArray(value) ? value.length : 0) +
            ' private photos retained in the authenticated record.');
    if (field.kind === 'multiselect')
        return Array.isArray(value) && value.length ? value.join(', ') : 'No selections';
    return value === '' || value === undefined ? 'Not provided' : String(value);
}
function respondentDefinition(definition) {
    return {
        title: definition.title,
        description: definition.description,
        fields: definition.fields,
        recipients: [],
        version: definition.version,
        createdAt: definition.createdAt,
    };
}
//# sourceMappingURL=formModel.js.map