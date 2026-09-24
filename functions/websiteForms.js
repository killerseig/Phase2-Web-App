"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formEmail = void 0;
exports.validateForm = validateForm;
exports.validateFormValues = validateFormValues;
exports.newWebsiteForm = newWebsiteForm;
exports.publicForm = publicForm;
const formEmail = (value) => value.length <= 254 && /^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/.test(value);
exports.formEmail = formEmail;
const object = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid form data.');
    return value;
};
function text(value, max, label, required = false) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
        throw new Error(`${label} must be ${required ? 'filled in and ' : ''}within ${max} characters.`);
    return value.trim();
}
function id(value) {
    const result = text(value, 80, 'Form ID', true);
    if (!/^[a-zA-Z0-9_-]+$/.test(result) ||
        ['__proto__', 'constructor', 'prototype'].includes(result))
        throw new Error('Invalid form or field ID.');
    return result;
}
function validateForm(value) {
    const data = object(value);
    if (!Array.isArray(data.fields) || data.fields.length < 1 || data.fields.length > 12)
        throw new Error('Use between 1 and 12 form fields.');
    const fields = data.fields.map((value) => {
        const field = object(value);
        if (!['text', 'email', 'tel', 'textarea', 'select', 'checkbox'].includes(String(field.type)) ||
            typeof field.required !== 'boolean')
            throw new Error('Choose a valid field type and requirement.');
        if (!Array.isArray(field.options) || field.options.length > 20)
            throw new Error('Use no more than 20 choices.');
        const options = field.options.map((option) => text(option, 100, 'Choice', true));
        if (new Set(options).size !== options.length || (field.type === 'select' && !options.length))
            throw new Error('Dropdowns need distinct choices.');
        return {
            id: id(field.id),
            label: text(field.label, 100, 'Field label', true),
            type: field.type,
            required: field.required,
            options: field.type === 'select' ? options : [],
        };
    });
    if (new Set(fields.map((field) => field.id)).size !== fields.length)
        throw new Error('Form field IDs must be unique.');
    const replyToField = text(data.replyToField, 80, 'Reply-To field');
    if (replyToField && !fields.some((field) => field.id === replyToField && field.type === 'email'))
        throw new Error('Reply-To must use an email field.');
    let delivery;
    if (data.delivery !== undefined) {
        const routing = object(data.delivery);
        function addresses(value) {
            if (!Array.isArray(value) || value.length > 10)
                throw new Error('Use no more than 10 addresses per recipient list.');
            const result = value.map((entry) => text(entry, 254, 'Email address', true).toLowerCase());
            if (result.some((entry) => !(0, exports.formEmail)(entry)))
                throw new Error('Enter valid recipient email addresses.');
            return [...new Set(result)];
        }
        const to = addresses(routing.to), cc = addresses(routing.cc).filter((entry) => !to.includes(entry));
        const subject = text(routing.subject, 160, 'Email subject', true);
        if (/[\r\n]/.test(subject))
            throw new Error('Use a single-line email subject.');
        delivery = { to, cc, subject };
    }
    return {
        id: id(data.id),
        name: text(data.name, 100, 'Form name', true),
        description: text(data.description, 1000, 'Form description'),
        buttonLabel: text(data.buttonLabel, 80, 'Submit label', true),
        successMessage: text(data.successMessage, 500, 'Confirmation message', true),
        replyToField,
        fields,
        ...(delivery ? { delivery } : {}),
    };
}
function validateFormValues(form, raw) {
    const data = object(raw);
    if (Object.keys(data).some((key) => !form.fields.some((field) => field.id === key)))
        throw new Error('The form changed. Refresh the page and try again.');
    const entries = form.fields.map((field) => {
        const input = data[field.id];
        if (field.type === 'checkbox') {
            if (input !== undefined && typeof input !== 'boolean')
                throw new Error(`Choose a value for ${field.label}.`);
            if (field.required && input !== true)
                throw new Error(`${field.label} is required.`);
            return [field.id, input === true];
        }
        const result = text(input ?? '', field.type === 'textarea' ? 5000 : field.type === 'email' ? 254 : 500, field.label, field.required);
        if (result && field.type === 'email' && !(0, exports.formEmail)(result))
            throw new Error(`Enter a valid email for ${field.label}.`);
        if (result && field.type === 'select' && !field.options.includes(result))
            throw new Error(`Choose an available option for ${field.label}.`);
        return [field.id, result];
    });
    return Object.fromEntries(entries);
}
function newWebsiteForm(id) {
    return {
        id,
        name: 'Contact us',
        description: '',
        buttonLabel: 'Send message',
        successMessage: 'Thank you. Your message has been received.',
        replyToField: 'email',
        delivery: { to: [], cc: [], subject: 'Website inquiry' },
        fields: [
            { id: 'name', label: 'Name', type: 'text', required: true, options: [] },
            { id: 'email', label: 'Email', type: 'email', required: true, options: [] },
            { id: 'message', label: 'Message', type: 'textarea', required: true, options: [] },
        ],
    };
}
function publicForm(form) {
    const { delivery: _delivery, ...result } = form;
    return result;
}
//# sourceMappingURL=websiteForms.js.map