"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedWidgetLabels = void 0;
exports.sharedWidgetTypes = sharedWidgetTypes;
exports.defaultSharedWidgets = defaultSharedWidgets;
exports.sharedDashboardKey = sharedDashboardKey;
exports.validateSharedWidgets = validateSharedWidgets;
exports.validateSharedCalendar = validateSharedCalendar;
exports.sharedWidgetLabels = {
    workflows: 'Job tools',
    text: 'Text',
    jobs: 'Assigned jobs',
    dates: 'Calendar',
    notes: 'Notes',
    documents: 'Documents',
    resources: 'Role resources',
    form: 'Forms',
};
function sharedWidgetTypes(scope) {
    void scope;
    return ['workflows', 'jobs', 'text', 'dates', 'notes', 'documents', 'resources', 'form'];
}
function defaultSharedWidgets(scope) {
    const types = scope === 'job' ? ['text', 'workflows', 'dates', 'notes'] : ['text', 'jobs', 'dates', 'notes'];
    return types.map((type, i) => ({
        id: type,
        type,
        span: i < 2 ? 12 : 6,
        title: type === 'text' ? (scope === 'job' ? 'Current job' : 'Welcome') : exports.sharedWidgetLabels[type],
        text: type === 'text'
            ? scope === 'job'
                ? '{{ job.code }} · {{ job.name }}'
                : '{{ user.name }}\n{{ user.role }}'
            : '',
    }));
}
function sharedDashboardKey(scope, role) {
    return scope === 'job' ? 'all-jobs' : 'role-' + role;
}
function validateSharedWidgets(value, scope) {
    if (!Array.isArray(value) || !value.length || value.length > 12)
        throw Error('Use between one and twelve widgets.');
    const ids = new Set(), types = new Set();
    const widgets = value.map((entry) => {
        if (!entry ||
            typeof entry !== 'object' ||
            typeof entry.id !== 'string' ||
            !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
            ids.has(entry.id) ||
            !sharedWidgetTypes(scope).includes(entry.type) ||
            ![4, 6, 8, 12].includes(entry.span) ||
            typeof entry.title !== 'string' ||
            entry.title.trim().length > 100 ||
            typeof entry.text !== 'string' ||
            entry.text.length > 8000 ||
            Object.keys(entry).some((key) => !['id', 'type', 'span', 'title', 'text', 'form', 'textStyle'].includes(key)))
            throw Error('Invalid dashboard widget.');
        if (!['notes', 'text', 'form'].includes(entry.type) && types.has(entry.type))
            throw Error('Add each tool only once.');
        ids.add(entry.id);
        types.add(entry.type);
        const widget = {
            id: entry.id,
            type: entry.type,
            span: entry.span,
            title: entry.title.trim(),
            text: entry.text,
        };
        if (entry.textStyle !== undefined) {
            const style = entry.textStyle;
            if (entry.type !== 'text' ||
                !style ||
                typeof style !== 'object' ||
                Object.keys(style).some((key) => !['size', 'color', 'weight', 'align', 'lineHeight'].includes(key)) ||
                !Number.isFinite(style.size) ||
                style.size < 12 ||
                style.size > 96 ||
                typeof style.color !== 'string' ||
                !/^#[a-f0-9]{6}$/i.test(style.color) ||
                ![400, 500, 600, 700].includes(style.weight) ||
                !['left', 'center', 'right'].includes(style.align) ||
                !Number.isFinite(style.lineHeight) ||
                style.lineHeight < 1 ||
                style.lineHeight > 2.5)
                throw Error('Invalid text styling.');
            widget.textStyle = {
                size: style.size,
                color: style.color,
                weight: style.weight,
                align: style.align,
                lineHeight: style.lineHeight,
            };
        }
        if (entry.type === 'form') {
            const form = entry.form;
            if (!form ||
                !/^[a-zA-Z0-9_-]{1,80}$/.test(form.templateId) ||
                !Number.isSafeInteger(form.version) ||
                form.version < 1 ||
                !['inline', 'launcher'].includes(form.presentation) ||
                Object.keys(form).some((key) => !['templateId', 'version', 'presentation'].includes(key)))
                throw Error('Choose an issued employee form.');
            widget.form = {
                templateId: form.templateId,
                version: form.version,
                presentation: form.presentation,
            };
        }
        else if (entry.form !== undefined)
            throw Error('Only employee-form widgets can select a form.');
        return widget;
    });
    const required = scope === 'job' ? 'workflows' : 'jobs';
    if (!types.has(required))
        throw Error(scope === 'job'
            ? 'Keep Job tools available for every job.'
            : 'Keep My jobs available on each role home.');
    return widgets;
}
function validateSharedCalendar(value) {
    if (!Array.isArray(value) || value.length > 100)
        throw Error('Use at most 100 calendar dates.');
    const ids = new Set();
    return value
        .map((entry) => {
        if (!entry ||
            typeof entry.id !== 'string' ||
            !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
            ids.has(entry.id) ||
            typeof entry.title !== 'string' ||
            !entry.title.trim() ||
            entry.title.trim().length > 200 ||
            typeof entry.date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
            Object.keys(entry).some((key) => !['id', 'title', 'date'].includes(key)))
            throw Error('Use a title and valid calendar date.');
        const parsed = new Date(entry.date + 'T00:00:00Z');
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== entry.date)
            throw Error('Use a valid calendar date.');
        ids.add(entry.id);
        return { id: entry.id, title: entry.title.trim(), date: entry.date };
    })
        .sort((a, b) => a.date.localeCompare(b.date));
}
//# sourceMappingURL=sharedDashboardModel.js.map