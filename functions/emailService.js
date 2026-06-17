"use strict";
/**
 * Email Service
 * Handles email sending via Microsoft Graph API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailEnabled = isEmailEnabled;
exports.getSenderEmail = getSenderEmail;
exports.normalizeDailyLogEmailPayload = normalizeDailyLogEmailPayload;
exports.buildWelcomeEmail = buildWelcomeEmail;
exports.buildPasswordResetEmail = buildPasswordResetEmail;
exports.buildDailyLogAutoSubmitEmail = buildDailyLogAutoSubmitEmail;
exports.buildDailyLogEmail = buildDailyLogEmail;
exports.buildTimecardsEmail = buildTimecardsEmail;
exports.buildShopOrderEmail = buildShopOrderEmail;
exports.buildShopOrderPdfFilename = buildShopOrderPdfFilename;
exports.buildShopOrderPdfBuffer = buildShopOrderPdfBuffer;
exports.buildSecretExpirationEmail = buildSecretExpirationEmail;
exports.sendEmail = sendEmail;
exports.sendDailyLogEmailNotification = sendDailyLogEmailNotification;
exports.sendShopOrderEmailNotification = sendShopOrderEmailNotification;
exports.sendSecretExpirationWarning = sendSecretExpirationWarning;
const axios_1 = __importDefault(require("axios"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const constants_1 = require("./constants");
const functionConfig_1 = require("./functionConfig");
// Token cache
let cachedToken = null;
/**
 * Get Azure AD access token for Graph API
 */
async function getGraphAuthToken() {
    // Return cached token if still valid (with 5-minute buffer)
    if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
        console.log('[getGraphAuthToken] Using cached token');
        return cachedToken.token;
    }
    try {
        const clientId = functionConfig_1.graphClientId.value();
        const tenantId = functionConfig_1.graphTenantId.value();
        const clientSecret = functionConfig_1.graphClientSecret.value();
        console.log('[getGraphAuthToken] Requesting new token from Azure AD');
        const response = await axios_1.default.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        const token = response.data.access_token;
        const expiresIn = response.data.expires_in || 3600;
        // Cache the token
        cachedToken = {
            token,
            expiresAt: Date.now() + expiresIn * 1000,
        };
        console.log('[getGraphAuthToken] Token obtained successfully, expires in', expiresIn, 'seconds');
        return token;
    }
    catch (error) {
        console.error('[getGraphAuthToken] Error getting token');
        console.error('[getGraphAuthToken] Error status:', error.response?.status);
        console.error('[getGraphAuthToken] Error details:', error.response?.data);
        throw new Error(`Failed to get Graph API token: ${error.message}`);
    }
}
/**
 * Check if email sending is enabled
 */
function isEmailEnabled() {
    return functionConfig_1.emailEnabled.value();
}
/**
 * Get sender email address
 */
function getSenderEmail() {
    return functionConfig_1.outlookSenderEmail.value();
}
function displayValue(value) {
    if (value === null || value === undefined)
        return 'N/A';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : 'N/A';
    }
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return 'N/A';
}
function formatAnyDate(value) {
    try {
        if (!value)
            return 'N/A';
        const asDate = typeof value?.toDate === 'function'
            ? value.toDate()
            : value instanceof Date
                ? value
                : new Date(value);
        if (Number.isNaN(asDate.getTime()))
            return 'N/A';
        return asDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }
    catch {
        return 'N/A';
    }
}
function objectRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function normalizeDailyLogEmailPayload(dailyLog) {
    const root = objectRecord(dailyLog);
    const payload = objectRecord(root.payload);
    const attachments = Array.isArray(payload.attachments)
        ? payload.attachments
        : Array.isArray(root.attachments)
            ? root.attachments
            : [];
    return {
        ...root,
        ...payload,
        attachments,
    };
}
// ============================================================================
// EMAIL TEMPLATES
// ============================================================================
/**
 * Build HTML template for welcome email
 */
function buildWelcomeEmail(firstName, resetLink) {
    const appUrl = (0, functionConfig_1.getAppBaseUrl)();
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Welcome to Phase 2</h1>
      </div>
      <div class="content">
        <p>Welcome, ${firstName || 'User'}!</p>
        <p>Your account has been created in the Phase 2 application. To get started, please follow these steps:</p>
        
        <h2 style="color: #333; margin-top: 20px; font-size: 18px;">Getting Started:</h2>
        <ol style="margin-top: 10px; line-height: 1.8;">
          <li>Click the button below to set your password</li>
          <li>You'll be taken directly to the application login page after setting your password</li>
          <li>Use your email and new password to log in</li>
        </ol>
        
        <div style="margin: 25px 0; text-align: center;">
          <p style="margin-bottom: 15px;"><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Set Your Password</a></p>
        </div>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #666;"><strong>Or visit us directly:</strong> <a href="${appUrl}" style="color: #007bff; text-decoration: none;">${appUrl}</a></p>
        </div>
        
        <p style="margin-top: 20px; color: #666; font-size: 14px;">If you did not create this account, please ignore this email.</p>
        <p style="color: #999; font-size: 12px;"><strong>Note:</strong> This link expires in 7 days.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `;
}
/**
 * Build HTML template for password reset email
 */
function buildPasswordResetEmail(displayName, resetLink) {
    const appUrl = (0, functionConfig_1.getAppBaseUrl)();
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Reset Your Password</h1>
      </div>
      <div class="content">
        <p>Hello${displayName ? ` ${displayName}` : ''},</p>
        <p>We received a request to reset your Phase 2 password.</p>
        <p>If you made this request, use the button below to choose a new password.</p>

        <div style="margin: 25px 0; text-align: center;">
          <p style="margin-bottom: 15px;"><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Reset Password</a></p>
        </div>

        <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #666;"><strong>Need to sign in after resetting?</strong> <a href="${appUrl}/login" style="color: #007bff; text-decoration: none;">Go to Phase 2 Login</a></p>
        </div>

        <p style="margin-top: 20px; color: #666; font-size: 14px;">If you did not request a password reset, you can ignore this email.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `;
}
/**
 * Build HTML template for daily log auto-submit email
 */
function buildDailyLogAutoSubmitEmail(jobDetails, logDate) {
    const formattedDate = new Date(logDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Daily Log Auto-Submitted</h1>
      </div>
      <div class="content">
        <p><strong>Job:</strong> ${jobDetails.name || 'Unnamed Job'}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p>A daily log has been auto-submitted for this job. Please review the Phase 2 application for full details.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `;
}
/**
 * Build HTML template for daily log email
 */
function buildDailyLogEmail(jobDetails, logDate, dailyLog) {
    const formattedDate = formatAnyDate(logDate);
    const dailyLogPayload = normalizeDailyLogEmailPayload(dailyLog);
    const manpowerLines = (Array.isArray(dailyLogPayload.manpowerLines) && dailyLogPayload.manpowerLines.length
        ? dailyLogPayload.manpowerLines
        : [{ trade: '', count: 0, areas: '' }])
        .map((line) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(line.trade)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(line.count)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(line.areas)}</td>
    </tr>
  `).join('');
    const indoorClimateRows = (Array.isArray(dailyLogPayload.indoorClimateReadings) && dailyLogPayload.indoorClimateReadings.length
        ? dailyLogPayload.indoorClimateReadings
        : [{ area: '', high: '', low: '', humidity: '' }])
        .map((reading) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(reading.area)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.high)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.low)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.humidity)}</td>
    </tr>
  `).join('');
    const attachments = (dailyLogPayload.attachments || [])
        .map((att) => {
        const label = att?.type === 'ptp'
            ? 'PTP Photo'
            : att?.type === 'photo'
                ? 'Photo'
                : att?.type === 'qc'
                    ? 'QC Photo'
                    : 'Attachment';
        const name = att?.name || att?.path || 'Attachment';
        const url = att?.url || '#';
        const description = displayValue(att?.description);
        const hasImagePreview = typeof url === 'string' && /^https?:\/\//i.test(url);
        return `
        <li style="margin-bottom: 12px;">
          <div style="margin-bottom: 4px;"><strong>${label}:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></div>
          <div style="margin-bottom: 6px;"><strong>${att?.type === 'ptp' ? 'Note' : 'Description'}:</strong> ${description}</div>
          ${hasImagePreview
            ? `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${name}" style="max-width: 180px; max-height: 120px; border: 1px solid #ddd; border-radius: 4px; display: block;" /></a>`
            : ''}
        </li>
      `;
    })
        .join('');
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Daily Log Submitted</h1>
      </div>
      <div class="content">
        <h2 style="color: #333; font-size: 18px; margin: 20px 0 10px 0;">${jobDetails.name || 'Unnamed Job'} ${jobDetails.number ? `(#${jobDetails.number})` : ''}</h2>
        <p><strong>Date:</strong> ${formattedDate}</p>

        <h3 style="color: #555; font-size: 16px; margin: 20px 0 10px 0;">Site Information</h3>
        <p><strong>Project Name:</strong> ${displayValue(dailyLogPayload.projectName)}</p>
        <p><strong>Job Number:</strong> ${displayValue(dailyLogPayload.jobSiteNumbers || jobDetails?.number)}</p>
        <p><strong>Foreman:</strong> ${displayValue(dailyLogPayload.foremanOnSite)}</p>
        <p><strong>Project Manager:</strong> ${displayValue(dailyLogPayload.siteForemanAssistant)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Manpower</h3>
        <p><strong>Manpower Summary:</strong> ${displayValue(dailyLogPayload.manpower)}</p>
        <p><strong>Weekly Schedule:</strong> ${displayValue(dailyLogPayload.weeklySchedule)}</p>
        <p><strong>Manpower Assessment:</strong> ${displayValue(dailyLogPayload.manpowerAssessment)}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Trade</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Count</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Areas</th>
            </tr>
          </thead>
          <tbody>
            ${manpowerLines}
          </tbody>
        </table>

        <h3 style="color: #555; font-size: 16px; margin: 20px 0 10px 0;">Indoor Climate</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Floor / Area</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">High (°F)</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Low (°F)</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Humidity (%)</th>
            </tr>
          </thead>
          <tbody>
            ${indoorClimateRows}
          </tbody>
        </table>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Safety & Concerns</h3>
        <p><strong>Safety Concerns:</strong> ${displayValue(dailyLogPayload.safetyConcerns)}</p>
        <p><strong>AHA Reviewed:</strong> ${displayValue(dailyLogPayload.ahaReviewed)}</p>
        <p><strong>Schedule Concerns:</strong> ${displayValue(dailyLogPayload.scheduleConcerns)}</p>
        <p><strong>Budget Concerns:</strong> ${displayValue(dailyLogPayload.budgetConcerns)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Deliveries & Materials</h3>
        <p><strong>Deliveries Received:</strong> ${displayValue(dailyLogPayload.deliveriesReceived)}</p>
        <p><strong>Deliveries Needed:</strong> ${displayValue(dailyLogPayload.deliveriesNeeded)}</p>
        <p><strong>New Work Authorizations:</strong> ${displayValue(dailyLogPayload.newWorkAuthorizations)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Quality Control</h3>
        <p><strong>Who is assigned to do QC?</strong> ${displayValue(dailyLogPayload.qcAssignedTo)}</p>
        <p><strong>What areas were inspected?</strong> ${displayValue(dailyLogPayload.qcAreasInspected ?? dailyLogPayload.qcInspection)}</p>
        <p><strong>What issues were identified?</strong> ${displayValue(dailyLogPayload.qcIssuesIdentified)}</p>
        <p><strong>What was done to fix the issues?</strong> ${displayValue(dailyLogPayload.qcIssuesResolved)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Notes & Action Items</h3>
        <p><strong>Notes & Correspondence:</strong> ${displayValue(dailyLogPayload.notesCorrespondence)}</p>
        <p><strong>Action Items:</strong> ${displayValue(dailyLogPayload.actionItems)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Attachments</h3>
        ${attachments
        ? `<ul style="padding-left: 18px; margin: 0; list-style: disc;">${attachments}</ul>`
        : '<p>N/A</p>'}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `;
}
function buildTimecardsEmail(payload) {
    const emailSummaryStart = payload.weekStart ? new Date(`${payload.weekStart}T00:00:00`) : null;
    const emailSummaryEnd = emailSummaryStart && !Number.isNaN(emailSummaryStart.getTime()) ? new Date(emailSummaryStart) : null;
    if (emailSummaryEnd)
        emailSummaryEnd.setDate(emailSummaryEnd.getDate() + 6);
    const emailWeekLabel = emailSummaryStart && emailSummaryEnd
        ? `${emailSummaryStart.getMonth() + 1}/${emailSummaryStart.getDate()}/${emailSummaryStart.getFullYear()} - ${emailSummaryEnd.getMonth() + 1}/${emailSummaryEnd.getDate()}/${emailSummaryEnd.getFullYear()}`
        : 'N/A';
    const timecardCount = Array.isArray(payload.timecards) ? payload.timecards.length : 0;
    const jobHeading = `${escapeHtml(displayValue(payload.jobName))}${payload.jobNumber ? ` (#${escapeHtml(String(payload.jobNumber).trim())})` : ''}`;
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Timecards Submitted</h1>
      </div>
      <div class="content">
        <h2 style="color:#333333; font-size:18px; margin:0 0 12px;">${jobHeading}</h2>
        <p><strong>Week:</strong> ${escapeHtml(emailWeekLabel)}</p>
        <p><strong>Submitted by:</strong> ${escapeHtml(displayValue(payload.submittedBy))}</p>
        <p><strong>Timecards:</strong> ${timecardCount}</p>
        <p>The timecard PDF is attached to this email.</p>
        <p>Please review the attached PDF for the full timecard layout and details.</p>
      </div>
    </div>
  `;
    const totalTimecards = Array.isArray(payload.timecards) ? payload.timecards.length : 0;
    const cardScale = totalTimecards === 1 ? 1.18 : 1;
    const visibleDayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const visibleDayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const columnWidthPercents = [
        '7.33', '3.49', '3.49', '8.96', '4.35',
        '7.33', '7.33', '7.33', '7.33', '7.33', '7.33',
        '9.46', '9.46', '9.46',
    ];
    const cardColgroupHtml = columnWidthPercents.map((percent) => `<col style="width:${percent}%;" />`).join('');
    const scaleLength = (value) => {
        const matched = /^(-?\d*\.?\d+)([a-zA-Z%]+)$/.exec(value.trim());
        if (!matched)
            return value;
        const scaled = Number((Number(matched[1]) * cardScale).toFixed(4));
        return `${scaled}${matched[2]}`;
    };
    const formatDateOnly = (value) => {
        if (!value)
            return '';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
            if (matched) {
                return `${Number(matched[2])}/${Number(matched[3])}/${matched[1]}`;
            }
        }
        const parsed = typeof value?.toDate === 'function'
            ? value.toDate()
            : value instanceof Date
                ? value
                : new Date(value);
        if (Number.isNaN(parsed.getTime()))
            return '';
        return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`;
    };
    const formatFixedNumber = (value, decimals = 2, blankWhenZero = false) => {
        const numeric = Number(value ?? 0);
        if (!Number.isFinite(numeric) || Number.isNaN(numeric))
            return blankWhenZero ? '' : (0).toFixed(decimals);
        if (blankWhenZero && numeric === 0)
            return '';
        return numeric.toFixed(decimals);
    };
    const formatTrimmedNumber = (value, decimals = 2, blankWhenZero = false) => {
        const fixed = formatFixedNumber(value, decimals, blankWhenZero);
        if (!fixed)
            return '';
        return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    };
    const formatHours = (value, blankWhenZero = false) => (formatFixedNumber(value, 1, blankWhenZero));
    const displayText = (value, fallback = '') => {
        const text = String(value ?? '').trim();
        return escapeHtml(text || fallback);
    };
    const renderOptionalText = (value) => {
        const text = String(value ?? '').trim();
        return text ? escapeHtml(text) : '&nbsp;';
    };
    const renderAlignedValue = (value, align = 'center') => {
        const text = String(value ?? '').trim();
        return `<span style="display:block; text-align:${align};">${text ? escapeHtml(text) : '&nbsp;'}</span>`;
    };
    const renderField = (label, value, align = 'left', valueFontSize = '0.105in', labelFontSize = '0.09in') => `
    <table role="presentation" style="width:100%; border-collapse:collapse; border:0; margin:0;">
      <tr>
        <td style="border:0; padding:0 0.03in 0.02in 0; white-space:nowrap; font-size:${labelFontSize}; font-style:italic; line-height:1; color:#111111; vertical-align:bottom;">${label ? escapeHtml(label) : '&nbsp;'}</td>
        <td style="width:100%; border:0; border-bottom:1px solid #111111; padding:0 0.03in 0.02in; font-size:${valueFontSize}; font-weight:700; line-height:1; color:#111111; text-align:${align}; vertical-align:bottom;">${renderOptionalText(value)}</td>
      </tr>
    </table>
  `;
    const isMeaningfulLine = (line) => {
        if (!line)
            return false;
        const textFields = [
            line?.jobNumber,
            line?.subsectionArea,
            line?.area,
            line?.account,
            line?.acct,
            line?.activityCode,
            line?.difH,
            line?.difP,
            line?.difC,
            line?.costCode,
        ];
        if (textFields.some((value) => String(value ?? '').trim().length > 0)) {
            return true;
        }
        if (visibleDayKeys.some((key) => Number(line?.[key]) || Number(line?.production?.[key]) || Number(line?.unitCost?.[key]))) {
            return true;
        }
        return Boolean(Number(line?.offHours)
            || Number(line?.offProduction)
            || Number(line?.offCost)
            || Number(line?.totals?.hours)
            || Number(line?.totals?.production)
            || Number(line?.totals?.lineTotal));
    };
    const getEmployeeName = (tc) => {
        const firstName = String(tc?.firstName || '').trim();
        const lastName = String(tc?.lastName || '').trim();
        const fullName = String(tc?.fullName || tc?.employeeName || '').trim();
        if (lastName && firstName)
            return `${lastName}, ${firstName}`;
        if (lastName || firstName)
            return lastName || firstName;
        return fullName;
    };
    const getWeekEndingLabel = (tc) => {
        const directWeekEnding = formatDateOnly(tc?.weekEndingDate);
        if (directWeekEnding)
            return directWeekEnding;
        const cardWeekStart = String(tc?.weekStartDate || payload.weekStart || '').trim();
        const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cardWeekStart);
        if (!matched)
            return '';
        const nextDate = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), 12, 0, 0, 0);
        if (Number.isNaN(nextDate.getTime()))
            return '';
        nextDate.setDate(nextDate.getDate() + 6);
        return `${nextDate.getMonth() + 1}/${nextDate.getDate()}/${nextDate.getFullYear()}`;
    };
    const getWageLabel = (tc) => {
        const numeric = Number(tc?.employeeWage ?? tc?.wageRate ?? tc?.wage);
        if (Number.isFinite(numeric) && !Number.isNaN(numeric) && numeric !== 0) {
            return `$${numeric.toFixed(2)}`;
        }
        return String(tc?.employeeWage ?? tc?.wageRate ?? tc?.wage ?? '').trim();
    };
    const getRegularAndOvertime = (tc, hoursTotal) => {
        const regularOverride = Number(tc?.regularHoursOverride);
        const overtimeOverride = Number(tc?.overtimeHoursOverride);
        if (Number.isFinite(regularOverride) && Number.isFinite(overtimeOverride)) {
            return {
                regular: Math.max(0, regularOverride),
                overtime: Math.max(0, overtimeOverride),
            };
        }
        return {
            regular: Math.min(hoursTotal, 40),
            overtime: Math.max(hoursTotal - 40, 0),
        };
    };
    const summaryStart = payload.weekStart ? new Date(`${payload.weekStart}T00:00:00`) : null;
    const validSummaryStart = summaryStart instanceof Date && !Number.isNaN(summaryStart.getTime()) ? summaryStart : null;
    const summaryEnd = validSummaryStart !== null ? new Date(validSummaryStart.getTime()) : null;
    if (summaryEnd !== null)
        summaryEnd.setDate(summaryEnd.getDate() + 6);
    const weekLabel = validSummaryStart !== null && summaryEnd !== null
        ? `${validSummaryStart.getMonth() + 1}/${validSummaryStart.getDate()}/${validSummaryStart.getFullYear()} - ${summaryEnd.getMonth() + 1}/${summaryEnd.getDate()}/${summaryEnd.getFullYear()}`
        : 'N/A';
    const lineRowKinds = [
        { key: 'hours', label: 'H', diffField: 'difH' },
        { key: 'production', label: 'P', diffField: 'difP' },
        { key: 'cost', label: 'C', diffField: 'difC' },
    ];
    const cardWidth = scaleLength('5.078in');
    const singleSheetWidth = scaleLength('5.4in');
    const doubleSheetWidth = '10.95in';
    const cardMarkupList = (Array.isArray(payload.timecards) ? payload.timecards : []).map((tc) => {
        const lines = (Array.isArray(tc?.lines) ? tc.lines : []).filter((line) => isMeaningfulLine(line));
        const totalHoursByDay = visibleDayKeys.map((key) => (lines.reduce((sum, line) => sum + (Number(line?.[key]) || 0), 0)));
        const computedHoursTotal = totalHoursByDay.reduce((sum, value) => sum + value, 0);
        const hoursTotal = Number(tc?.totals?.hoursTotal) || computedHoursTotal;
        const productionTotal = Number(tc?.totals?.productionTotal) || lines.reduce((sum, line) => (sum + (Number(line?.totals?.production)
            || visibleDayKeys.reduce((lineSum, key) => lineSum + (Number(line?.production?.[key]) || 0), 0))), 0);
        const { regular, overtime } = getRegularAndOvertime(tc, hoursTotal);
        const thinBorder = '1px solid #111111';
        const thickBorder = '1.5px solid #111111';
        const brandHeight = scaleLength('21.853pt');
        const headerRowHeight = scaleLength('11.849pt');
        const headerGapHeight = scaleLength('9.8pt');
        const gridHeaderHeight = scaleLength('12.15pt');
        const gridBodyHeight = scaleLength('8.03pt');
        const gridTotalHeight = scaleLength('16.01pt');
        const footerLabelRowHeight = scaleLength('13.079pt');
        const footerBoxRowHeight = scaleLength('15.539pt');
        const footerAuxRowHeight = scaleLength('13.079pt');
        const bottomSpacerHeight = scaleLength('10.2pt');
        const brandFontSize = scaleLength('0.18in');
        const bodyFontSize = scaleLength('0.098in');
        const headerFontSize = scaleLength('0.086in');
        const totalFontSize = scaleLength('0.105in');
        const labelFontSize = scaleLength('0.09in');
        const valueFontSize = scaleLength('0.105in');
        const valueFontLarge = scaleLength('0.115in');
        const footerValueFontSize = scaleLength('0.1in');
        const footerBoxFontSize = scaleLength('0.095in');
        const fieldPadX = scaleLength('0.03in');
        const fieldPadBottom = scaleLength('0.02in');
        const rightPad = scaleLength('0.08in');
        const summaryPadTop = scaleLength('0.015in');
        const footerBoxPadY = scaleLength('0.01in');
        const footerBoxPadX = scaleLength('0.02in');
        const footerValuePadBottom = scaleLength('0.01in');
        const blankCell = 'border:0; padding:0; font-size:0; line-height:1;';
        const baseCell = `border:${thinBorder}; padding:0; height:${gridBodyHeight}; text-align:center; vertical-align:middle; line-height:1; font-family:'Times New Roman', Times, serif; font-size:${bodyFontSize};`;
        const headerCell = `border:${thinBorder}; padding:0; height:${gridHeaderHeight}; text-align:center; vertical-align:middle; line-height:1; font-family:'Times New Roman', Times, serif; font-size:${headerFontSize}; font-style:italic; font-weight:400;`;
        const totalCell = `border:${thinBorder}; padding:0; height:${gridTotalHeight}; text-align:center; vertical-align:middle; line-height:1; font-family:'Times New Roman', Times, serif; font-size:${totalFontSize}; font-weight:700;`;
        const formLabelCell = `border:0; height:${headerRowHeight}; padding:0 ${fieldPadX} ${fieldPadBottom} 0; white-space:nowrap; text-align:right; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${labelFontSize}; font-style:italic; font-weight:400; line-height:1;`;
        const renderFormValueCell = (align = 'left', fontSize = '0.105in') => (`border:0; border-bottom:1px solid #111111; height:${headerRowHeight}; padding:0 ${fieldPadX} ${fieldPadBottom}; text-align:${align}; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${scaleLength(fontSize)}; font-weight:700; line-height:1;`);
        const footerLabelCell = `border:0; height:${footerLabelRowHeight}; padding:0 0 2px; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${labelFontSize}; font-weight:400; line-height:1;`;
        const footerStatLabelCell = `border:0; height:${footerLabelRowHeight}; padding:0 0 2px; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${labelFontSize}; font-weight:400; line-height:1;`;
        const footerStatValueCell = `border:0; border-bottom:1px solid #111111; height:${footerLabelRowHeight}; padding:0 0 ${footerValuePadBottom}; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${footerValueFontSize}; font-weight:700; line-height:1;`;
        const footerStatLabelRowTwoCell = `border:0; height:${footerBoxRowHeight}; padding:0 0 2px; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${labelFontSize}; font-weight:400; line-height:1;`;
        const footerStatValueRowTwoCell = `border:0; border-bottom:1px solid #111111; height:${footerBoxRowHeight}; padding:0 0 ${footerValuePadBottom}; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${footerValueFontSize}; font-weight:700; line-height:1;`;
        const footerBoxCell = `border:${thinBorder}; height:${footerBoxRowHeight}; padding:${footerBoxPadY} ${footerBoxPadX}; text-align:center; vertical-align:middle; font-family:'Times New Roman', Times, serif; font-size:${footerBoxFontSize}; font-weight:700; line-height:1;`;
        const footerAuxBoxCell = `border:${thinBorder}; height:${footerAuxRowHeight}; padding:${footerBoxPadY} ${footerBoxPadX}; text-align:center; vertical-align:middle; font-family:'Times New Roman', Times, serif; font-size:${footerBoxFontSize}; font-weight:700; line-height:1;`;
        const notesLabelCell = `border:0; height:${footerAuxRowHeight}; padding:0 ${footerBoxPadX} 0 0; text-align:right; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${labelFontSize}; font-weight:400; line-height:1;`;
        const notesLineCell = `border:0; border-bottom:1px solid #111111; height:${footerAuxRowHeight}; padding:0 0 ${footerValuePadBottom}; text-align:left; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${footerBoxFontSize}; line-height:1;`;
        const maxLineGroups = 13;
        const employeeName = displayText(getEmployeeName(tc), '-');
        const employeeNumber = displayText(tc?.employeeNumber || tc?.employeeId, '-');
        const occupation = displayText(tc?.occupation, '-');
        const wageLabel = displayText(getWageLabel(tc), '-');
        const weekEndingLabel = displayText(getWeekEndingLabel(tc), '-');
        const overtimeLabel = formatTrimmedNumber(overtime, 1);
        const regularLabel = formatTrimmedNumber(regular, 1);
        const lineRows = Array.from({ length: maxLineGroups }, (_, lineIndex) => {
            const line = lines[lineIndex];
            const hasLine = Boolean(line);
            const lineHoursTotal = hasLine
                ? Number(line?.totals?.hours)
                    || visibleDayKeys.reduce((sum, key) => sum + (Number(line?.[key]) || 0), 0)
                : 0;
            const lineProductionTotal = hasLine
                ? Number(line?.totals?.production)
                    || visibleDayKeys.reduce((sum, key) => sum + (Number(line?.production?.[key]) || 0), 0)
                : 0;
            const lineCostTotal = hasLine
                ? Number(line?.totals?.lineTotal)
                    || visibleDayKeys.reduce((sum, key) => {
                        const production = Number(line?.production?.[key]) || 0;
                        const unitCost = Number(line?.unitCost?.[key]) || 0;
                        return sum + (production * unitCost);
                    }, 0)
                : 0;
            return lineRowKinds.map((rowKind, rowKindIndex) => {
                const diffValue = hasLine ? line?.[rowKind.diffField] : '';
                const productionCell = rowKind.key === 'hours'
                    ? ''
                    : rowKind.key === 'production'
                        ? formatTrimmedNumber(lineProductionTotal, 3, true)
                        : formatFixedNumber(lineCostTotal, 3, true);
                const offCell = hasLine
                    ? rowKind.key === 'hours'
                        ? formatTrimmedNumber(line?.offHours, 2, true)
                        : rowKind.key === 'production'
                            ? formatTrimmedNumber(line?.offProduction, 2, true)
                            : formatTrimmedNumber(line?.offCost, 2, true)
                    : '';
                const topBorder = rowKind.key === 'hours' ? thickBorder : '0';
                const bottomBorder = rowKind.key === 'hours' ? '0' : rowKind.key === 'production' ? '0' : thinBorder;
                const detailStyle = `${baseCell} border-top:${topBorder}; border-bottom:${bottomBorder};`;
                const labelStyle = `${baseCell} font-weight:700; border-top:${rowKind.key === 'hours' ? thickBorder : rowKind.key === 'production' ? thinBorder : '0'}; border-bottom:${rowKind.key === 'hours' ? '0' : thinBorder};`;
                return `
          <tr>
            ${rowKindIndex === 0 ? `<td rowspan="${lineRowKinds.length}" style="${baseCell} border-top:${thickBorder}; vertical-align:middle;">${renderOptionalText(hasLine ? line?.jobNumber : '')}</td>` : ''}
            ${rowKindIndex === 0 ? `<td rowspan="${lineRowKinds.length}" style="${baseCell} border-top:${thickBorder}; vertical-align:middle;">${renderOptionalText(hasLine ? (line?.subsectionArea || line?.area) : '')}</td>` : ''}
            <td style="${labelStyle}">${rowKind.label}</td>
            ${rowKindIndex === 0 ? `<td rowspan="${lineRowKinds.length}" style="${baseCell} border-top:${thickBorder}; vertical-align:middle;">${renderOptionalText(hasLine ? (line?.account || line?.acct || line?.activityCode) : '')}</td>` : ''}
            <td style="${detailStyle}">${renderOptionalText(diffValue)}</td>
            ${visibleDayKeys.map((key) => {
                    const dayValue = hasLine
                        ? rowKind.key === 'hours'
                            ? formatFixedNumber(line?.[key], 2, true)
                            : rowKind.key === 'production'
                                ? formatFixedNumber(line?.production?.[key], 2, true)
                                : formatFixedNumber(line?.unitCost?.[key], 2, true)
                        : '';
                    return `<td style="${detailStyle}">${renderOptionalText(dayValue)}</td>`;
                }).join('')}
            ${rowKindIndex === 0 ? `<td rowspan="${lineRowKinds.length}" style="${baseCell} border-top:${thickBorder}; vertical-align:top; padding-top:${summaryPadTop}; font-weight:700;">${renderOptionalText(hasLine ? formatHours(lineHoursTotal, true) : '')}</td>` : ''}
            <td style="${detailStyle}">${renderOptionalText(productionCell)}</td>
            <td style="${detailStyle}">${renderOptionalText(offCell)}</td>
          </tr>
        `;
            }).join('');
        }).join('');
        return `
      <table role="presentation" class="tc-card-wrap" style="width:${cardWidth}; border-collapse:collapse; table-layout:fixed; margin:0; border:1px solid #111111; background:#ffffff; color:#111111; font-family:'Times New Roman', Times, serif;">
        <tr>
          <td style="height:${brandHeight}; padding:0 ${rightPad}; border:0; text-align:center; vertical-align:middle; font-family:Arial, Helvetica, sans-serif; font-size:${brandFontSize}; font-weight:700; line-height:1;">PHASE 2 COMPANY</td>
        </tr>
        <tr>
          <td style="padding:0; border:0;">
              <table role="presentation" style="width:100%; border-collapse:collapse; border:0; margin:0;">
                <tr>
                  <td style="border:0; padding:0 ${rightPad};">
                    <table role="presentation" style="width:100%; border-collapse:collapse; table-layout:fixed; border:0; margin:0;">
                      <colgroup>${cardColgroupHtml}</colgroup>
                      <tr>
                        <td colspan="3" style="${formLabelCell}">EMP. NAME:</td>
                        <td colspan="7" style="${renderFormValueCell('left', '0.105in')}">${renderOptionalText(employeeName)}</td>
                        <td style="${blankCell} height:${headerRowHeight};">&nbsp;</td>
                        <td style="${formLabelCell}">EMPLOYEE#</td>
                        <td colspan="2" style="${renderFormValueCell('center', '0.115in')}">${renderOptionalText(employeeNumber)}</td>
                      </tr>
                      <tr>
                        <td colspan="3" style="${formLabelCell}">OCCUPATION:</td>
                        <td colspan="7" style="${renderFormValueCell('left', '0.105in')}">${renderOptionalText(occupation)}</td>
                        <td style="${blankCell} height:${headerRowHeight};">&nbsp;</td>
                        <td style="${formLabelCell}">WAGE</td>
                        <td colspan="2" style="${renderFormValueCell('center', '0.115in')}">${renderOptionalText(wageLabel)}</td>
                      </tr>
                      <tr>
                        <td colspan="11" style="${blankCell} height:${headerRowHeight};">&nbsp;</td>
                        <td style="${formLabelCell}">WEEK ENDING</td>
                        <td colspan="2" style="${renderFormValueCell('center', '0.105in')}">${renderOptionalText(weekEndingLabel)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
          </td>
        </tr>
        <tr>
          <td style="height:${headerGapHeight}; padding:0; border:0; font-size:0; line-height:${headerGapHeight};">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:0; border:0; vertical-align:top;">
              <table role="presentation" style="width:100%; border-collapse:collapse; table-layout:fixed; margin:0; border:${thinBorder};">
                <colgroup>${cardColgroupHtml}</colgroup>
                <thead>
                  <tr>
                    <th style="${headerCell}">JOB #</th>
                    <th style="${headerCell}">1</th>
                    <th style="${headerCell}">&nbsp;</th>
                    <th style="${headerCell}">ACCT</th>
                    <th style="${headerCell}">DIF</th>
                    ${visibleDayLabels.map((label) => `<th style="${headerCell}">${label}</th>`).join('')}
                    <th style="${headerCell}">TOTAL</th>
                    <th style="${headerCell}">PROD</th>
                    <th style="${headerCell}">OFF</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineRows}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="5" style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder}; text-align:right; padding-right:${rightPad};">TOTAL HOURS</td>
                    ${totalHoursByDay.map((value) => `<td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">${renderOptionalText(formatHours(value))}</td>`).join('')}
                    <td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">${renderOptionalText(formatHours(hoursTotal, true))}</td>
                    <td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">${renderOptionalText(formatTrimmedNumber(productionTotal, 3, true))}</td>
                    <td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">&nbsp;</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="${footerLabelCell}">JOB or GL</td>
                    <td colspan="2" style="${footerLabelCell}">ACCT</td>
                    <td colspan="2" style="${footerLabelCell}">OFFICE</td>
                    <td colspan="2" style="${footerLabelCell}">AMT</td>
                    <td style="${blankCell} height:${footerLabelRowHeight};">&nbsp;</td>
                    <td style="${footerStatLabelCell}">OT</td>
                    <td style="${footerStatValueCell}">${renderOptionalText(overtimeLabel)}</td>
                    <td colspan="2" style="${blankCell} height:${footerLabelRowHeight};">&nbsp;</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="${footerBoxCell}">${renderOptionalText(tc?.footerJobOrGl)}</td>
                    <td colspan="2" style="${footerBoxCell}">${renderOptionalText(tc?.footerAccount)}</td>
                    <td colspan="2" style="${footerBoxCell}">${renderOptionalText(tc?.footerOffice)}</td>
                    <td colspan="2" style="${footerBoxCell}">${renderOptionalText(tc?.footerAmount)}</td>
                    <td style="${blankCell} height:${footerBoxRowHeight};">&nbsp;</td>
                    <td style="${footerStatLabelRowTwoCell}">REG</td>
                    <td style="${footerStatValueRowTwoCell}">${renderOptionalText(regularLabel)}</td>
                    <td colspan="2" style="${blankCell} height:${footerBoxRowHeight};">&nbsp;</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="${footerAuxBoxCell}">${renderOptionalText(tc?.footerSecondJobOrGl)}</td>
                    <td colspan="2" style="${footerAuxBoxCell}">${renderOptionalText(tc?.footerSecondAccount)}</td>
                    <td colspan="2" style="${footerAuxBoxCell}">${renderOptionalText(tc?.footerSecondOffice)}</td>
                    <td colspan="2" style="${footerAuxBoxCell}">${renderOptionalText(tc?.footerSecondAmount)}</td>
                    <td colspan="5" style="${blankCell} height:${footerAuxRowHeight};">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="${blankCell} height:${footerAuxRowHeight};">&nbsp;</td>
                    <td colspan="2" style="${notesLabelCell}">NOTES:</td>
                    <td colspan="10" style="${notesLineCell}">${renderOptionalText(tc?.notes)}</td>
                    <td style="${blankCell} height:${footerAuxRowHeight};">&nbsp;</td>
                  </tr>
                  <tr>
                    <td colspan="14" style="${blankCell} height:${footerAuxRowHeight};">&nbsp;</td>
                  </tr>
                </tfoot>
              </table>
          </td>
        </tr>
        <tr>
          <td style="height:${bottomSpacerHeight}; padding:0; border:0; font-size:0; line-height:${bottomSpacerHeight};">&nbsp;</td>
        </tr>
      </table>
    `;
    });
    const cardsHtml = cardMarkupList.length
        ? `
      ${Array.from({ length: Math.ceil(cardMarkupList.length / 2) }, (_, pairIndex) => {
            const left = cardMarkupList[pairIndex * 2] || '';
            const right = cardMarkupList[pairIndex * 2 + 1] || '';
            const jobHeading = `${escapeHtml(displayValue(payload.jobName))}${payload.jobNumber ? ` (#${escapeHtml(String(payload.jobNumber).trim())})` : ''}`;
            const pageWidth = right ? '11in' : '8.5in';
            const leftCellWidth = right ? '50%' : cardWidth;
            const rightCellHtml = right
                ? `<td style="width:50%; vertical-align:top; padding:0 0 0 0.16in; border:0; text-align:left;">${right}</td>`
                : '<td style="padding:0; border:0; vertical-align:top;">&nbsp;</td>';
            return `
          <table role="presentation" class="tc-sheet" style="width:${pageWidth}; max-width:100%; border-collapse:collapse; table-layout:fixed; border:1px solid #111111; margin:0 auto 18px; background:#ffffff; color:#111111; font-family:Arial, Helvetica, sans-serif;">
            <tr>
              <td colspan="2" style="padding:14px 18px; border-bottom:1px solid #111111; text-align:center; font-size:24px; font-weight:700; line-height:1.1;">Timecards Submitted</td>
            </tr>
            <tr>
              <td style="padding:6px 12px; border-right:1px solid #111111; border-bottom:1px solid #111111; font-size:14px; line-height:1.25; text-align:left; vertical-align:top;"><strong>Job:</strong> ${jobHeading}</td>
              <td style="padding:6px 12px; border-bottom:1px solid #111111; font-size:14px; line-height:1.25; text-align:right; vertical-align:top;"><strong>Week:</strong> ${escapeHtml(weekLabel)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:6px 12px; border-bottom:1px solid #111111; font-size:14px; line-height:1.25; text-align:left; vertical-align:top;"><strong>Submitted by:</strong> ${escapeHtml(displayValue(payload.submittedBy))}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:10px 12px 12px; border:0; vertical-align:top;">
                <table role="presentation" style="width:100%; border-collapse:collapse; table-layout:fixed; margin:0; border:0;">
                  <tr>
                    <td style="width:${leftCellWidth}; vertical-align:top; padding:0; border:0; text-align:left;">${left}</td>
                    ${rightCellHtml}
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `;
        }).join('')}
    `
        : '<p style="margin:0; font-size:13px;">No timecards found.</p>';
    return `
    <div style="background:#ffffff; padding:0; color:#111111; font-family:Arial, Helvetica, sans-serif;">
      ${cardsHtml}
    </div>
  `;
    /*      </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
          </div>
        </div>
        </div>
      `*/
}
function resolveOrderEmailDate(value) {
    try {
        if (!value)
            return null;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
            if (match) {
                const year = Number(match[1]);
                const month = Number(match[2]) - 1;
                const day = Number(match[3]);
                return new Date(year, month, day, 12, 0, 0, 0);
            }
        }
        const dateValue = typeof value?.toDate === 'function'
            ? value.toDate()
            : value instanceof Date
                ? value
                : new Date(value);
        return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }
    catch {
        return null;
    }
}
function formatOrderEmailDate(value) {
    const dateValue = resolveOrderEmailDate(value);
    if (!dateValue)
        return 'N/A';
    return dateValue.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
function getNextThursdayDateValue(reference) {
    const referenceDate = resolveOrderEmailDate(reference);
    if (!referenceDate)
        return '';
    const nextDate = new Date(referenceDate);
    nextDate.setHours(12, 0, 0, 0);
    const day = nextDate.getDay();
    let daysUntilThursday = (4 - day + 7) % 7;
    if (daysUntilThursday === 0) {
        daysUntilThursday = 7;
    }
    nextDate.setDate(nextDate.getDate() + daysUntilThursday);
    return nextDate.toISOString().slice(0, 10);
}
function getShopOrderRequestedDeliveryDateValue(order) {
    const explicitDeliveryDate = String(order?.deliveryDate || '').trim();
    if (explicitDeliveryDate)
        return explicitDeliveryDate;
    return getNextThursdayDateValue(order?.orderDate || order?.createdAt || order?.updatedAt);
}
function normalizeShopOrderNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length)
            return trimmed;
    }
    return '';
}
function buildTimestampShopOrderNumber(value) {
    try {
        if (!value)
            return '';
        const dateValue = typeof value?.toDate === 'function'
            ? value.toDate()
            : value instanceof Date
                ? value
                : new Date(value);
        if (Number.isNaN(dateValue.getTime()))
            return '';
        return [
            dateValue.getUTCFullYear(),
            String(dateValue.getUTCMonth() + 1).padStart(2, '0'),
            String(dateValue.getUTCDate()).padStart(2, '0'),
            String(dateValue.getUTCHours()).padStart(2, '0'),
            String(dateValue.getUTCMinutes()).padStart(2, '0'),
            String(dateValue.getUTCSeconds()).padStart(2, '0'),
        ].join('');
    }
    catch {
        return '';
    }
}
function getShopOrderDisplayNumber(order) {
    return (normalizeShopOrderNumber(order?.orderNumber)
        || buildTimestampShopOrderNumber(order?.orderDate)
        || buildTimestampShopOrderNumber(order?.createdAt)
        || buildTimestampShopOrderNumber(order?.updatedAt)
        || 'Unnumbered');
}
function getShopOrderItemCostCode(item, costCodesByCatalogItemId) {
    const directCostCode = String(item?.costCode || '').trim();
    if (directCostCode)
        return directCostCode;
    const catalogItemId = String(item?.catalogItemId || '').trim();
    const catalogCostCode = catalogItemId
        ? String(costCodesByCatalogItemId[catalogItemId] || '').trim()
        : '';
    if (catalogCostCode)
        return catalogCostCode;
    const note = String(item?.note || item?.notes || '').trim();
    const noteMatch = /^(?:SKU|Cost Code)\s*:\s*(.+)$/i.exec(note);
    if (!noteMatch?.[1])
        return '-';
    const extractedCostCode = noteMatch[1].split(/\s+-\s+\$/)[0]?.trim();
    return extractedCostCode || '-';
}
function normalizeShopOrderQuantity(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
}
function getShopOrderItemReceivedQuantity(item) {
    return Math.min(normalizeShopOrderQuantity(item?.quantity), normalizeShopOrderQuantity(item?.receivedQuantity));
}
function getShopOrderItemBackorderedQuantity(item) {
    const quantity = normalizeShopOrderQuantity(item?.quantity);
    const receivedQuantity = getShopOrderItemReceivedQuantity(item);
    return Math.min(Math.max(0, quantity - receivedQuantity), normalizeShopOrderQuantity(item?.backorderedQuantity));
}
function getShopOrderItemPendingQuantity(item) {
    const quantity = normalizeShopOrderQuantity(item?.quantity);
    return Math.max(0, quantity - getShopOrderItemReceivedQuantity(item) - getShopOrderItemBackorderedQuantity(item));
}
function getShopOrderStatusLabel(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'submitted' || normalized === 'order')
        return 'Submitted';
    if (normalized === 'partial')
        return 'Partial';
    if (normalized === 'backordered')
        return 'Backordered';
    if (normalized === 'received' || normalized === 'receive')
        return 'Received';
    return 'Draft';
}
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function renderEmailText(value, fallback = 'N/A') {
    const text = String(value ?? '').trim();
    return escapeHtml(text || fallback);
}
function renderOptionalEmailText(value) {
    const text = String(value ?? '').trim();
    return text ? escapeHtml(text) : '&nbsp;';
}
function normalizeRootFolderLabel(value) {
    return value
        .toLowerCase()
        .replace(/[\u2019']/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function getShopOrderDescriptionSegments(description) {
    return String(description || '')
        .split(' / ')
        .map((segment) => segment.trim())
        .filter(Boolean);
}
function shouldStripControlRootLabel(rootLabel) {
    if (!rootLabel)
        return false;
    const normalized = normalizeRootFolderLabel(rootLabel);
    return (normalized === 'shop'
        || normalized.startsWith('shop ')
        || normalized === 'pm'
        || normalized === 'pms'
        || normalized === 'project manager'
        || normalized === 'project managers');
}
function getJobDisplayLabel(order) {
    const jobCode = String(order?.jobCode || '').trim();
    const jobName = String(order?.jobName || '').trim();
    if (jobCode && jobName)
        return `${jobName} - ${jobCode}`;
    return jobCode || jobName || 'Phase 2 Job';
}
function formatCompactOrderEmailDate(value) {
    const dateValue = resolveOrderEmailDate(value);
    if (!dateValue)
        return 'N/A';
    return dateValue.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
}
function renderPrintedOrderMetaField(label, value, align = 'left') {
    return `
    <div style="font-size: 14px; color: #202020; text-align: ${align};">
      <strong>${escapeHtml(label)}:</strong> ${renderEmailText(value)}
    </div>
  `;
}
function renderPrintedOrderPlainField(value, align = 'left') {
    return `
    <div style="font-size: 14px; color: #202020; text-align: ${align};">
      ${renderEmailText(value)}
    </div>
  `;
}
const SHOP_ORDER_DOCUMENT_WIDTH = 980;
const SHOP_ORDER_DOCUMENT_PADDING = 14;
const SHOP_ORDER_TABLE_WIDTH = SHOP_ORDER_DOCUMENT_WIDTH - (SHOP_ORDER_DOCUMENT_PADDING * 2);
const SHOP_ORDER_TABLE_BORDER = '#9b9b9b';
const SHOP_ORDER_EMAIL_COLUMN_WIDTHS = {
    pulledBy: 54,
    verifiedBy: 58,
    code: 64,
    partNumber: 80,
    itemName: 486,
    quantity: 76,
    notes: 108,
    check: 26,
};
const SHOP_ORDER_EMAIL_PRINT_STYLES = `
  <style>
    .shop-order-email__document {
      width: ${SHOP_ORDER_DOCUMENT_WIDTH}px !important;
      min-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px !important;
      max-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px !important;
    }
    .shop-order-email__paper {
      width: ${SHOP_ORDER_DOCUMENT_WIDTH}px !important;
      min-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px !important;
      max-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px !important;
      overflow: visible !important;
    }
    .shop-order-email__print-section {
      page-break-inside: auto !important;
      break-inside: auto !important;
      overflow: visible !important;
    }
    .shop-order-email__items-table {
      width: ${SHOP_ORDER_TABLE_WIDTH}px !important;
      min-width: ${SHOP_ORDER_TABLE_WIDTH}px !important;
      max-width: ${SHOP_ORDER_TABLE_WIDTH}px !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      table-layout: fixed !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
    }
    .shop-order-email__items-table thead {
      display: table-header-group !important;
    }
    .shop-order-email__items-table tbody {
      display: table-row-group !important;
    }
    .shop-order-email__items-table tfoot {
      display: table-footer-group !important;
    }
    .shop-order-email__items-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid-page !important;
    }
    @media print {
      .shop-order-email__print-section {
        page-break-inside: auto !important;
        break-inside: auto !important;
        overflow: visible !important;
      }
      .shop-order-email__items-table {
        width: ${SHOP_ORDER_TABLE_WIDTH}px !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      .shop-order-email__items-table thead {
        display: table-header-group !important;
      }
      .shop-order-email__items-table tbody {
        display: table-row-group !important;
      }
      .shop-order-email__items-table tfoot {
        display: table-footer-group !important;
      }
      .shop-order-email__items-table tr {
        page-break-inside: avoid !important;
        break-inside: avoid-page !important;
      }
    }
  </style>
`;
function renderPrintedShopOrderItemsTable(items, marginTop = 10) {
    return `
    <table class="shop-order-email__items-table" width="${SHOP_ORDER_TABLE_WIDTH}" style="width: ${SHOP_ORDER_TABLE_WIDTH}px; min-width: ${SHOP_ORDER_TABLE_WIDTH}px; max-width: ${SHOP_ORDER_TABLE_WIDTH}px; border-collapse: collapse; margin-top: ${marginTop}px; border: 2px solid ${SHOP_ORDER_TABLE_BORDER}; page-break-inside: auto; break-inside: auto; table-layout: fixed; word-break: normal; overflow-wrap: normal;">
      <colgroup>
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.pulledBy}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.pulledBy}px;" />
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.verifiedBy}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.verifiedBy}px;" />
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.code}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.code}px;" />
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.partNumber}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.partNumber}px;" />
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.itemName}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.itemName}px;" />
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.quantity}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.quantity}px;" />
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.notes}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.notes}px;" />
        <col width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.check}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.check}px;" />
      </colgroup>
      <thead style="display: table-header-group !important;">
        <tr>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.pulledBy}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.pulledBy}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.pulledBy}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.pulledBy}px; padding: 6px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal;">Pulled<br>By</th>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.verifiedBy}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.verifiedBy}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.verifiedBy}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.verifiedBy}px; padding: 6px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal;">Verified<br>By</th>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.code}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.code}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.code}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.code}px; padding: 6px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal;">133/513</th>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.partNumber}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.partNumber}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.partNumber}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.partNumber}px; padding: 6px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal;">Part#</th>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.itemName}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.itemName}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.itemName}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.itemName}px; padding: 6px 7px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: left; vertical-align: middle; word-break: normal; overflow-wrap: normal;">Item Name</th>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.quantity}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.quantity}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.quantity}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.quantity}px; padding: 6px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal;">Quantity</th>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.notes}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.notes}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.notes}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.notes}px; padding: 6px 7px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: left; vertical-align: middle; word-break: normal; overflow-wrap: normal;">Notes</th>
          <th width="${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.check}" style="width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.check}px; min-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.check}px; max-width: ${SHOP_ORDER_EMAIL_COLUMN_WIDTHS.check}px; padding: 6px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; vertical-align: middle; word-break: normal; overflow-wrap: normal;">&nbsp;</th>
        </tr>
      </thead>
      <tbody style="display: table-row-group !important;">
        ${items.map((item) => `
          <tr style="page-break-inside: avoid !important; break-inside: avoid-page !important;">
            <td style="height: 30px; padding: 5px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
            <td style="height: 30px; padding: 5px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
            <td style="height: 30px; padding: 5px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
            <td style="height: 30px; padding: 5px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
            <td style="height: 30px; padding: 5px 7px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; vertical-align: middle; font-size: 13px; line-height: 1.25; word-break: normal; overflow-wrap: break-word;">${renderEmailText(item.displayDescription, 'Untitled Item')}</td>
            <td style="height: 30px; padding: 5px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; text-align: center; vertical-align: middle; font-size: 13px; line-height: 1.2;">${item.orderedQuantity}</td>
            <td style="height: 30px; padding: 5px 7px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; vertical-align: middle; font-size: 12px; line-height: 1.25; color: #333333; word-break: normal; overflow-wrap: break-word;">${renderOptionalEmailText(item.note)}</td>
            <td style="height: 30px; padding: 5px 5px; border: 1px solid ${SHOP_ORDER_TABLE_BORDER}; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
function renderPrintedShopOrderSection(orderIdentifier, orderBy, orderDate, deliveryDateLabel, jobLabel, comments, items) {
    if (!items.length)
        return '';
    return `
    <div class="shop-order-email__print-section" style="display: block; width: 100%; box-sizing: border-box; background: #ffffff; border: 1px solid #d4d4d4; margin-top: 18px; padding: 14px 14px 12px; page-break-inside: auto; break-inside: auto; overflow: visible;">
      <table role="presentation" style="width: 100%; border: none; margin: 0 0 8px;">
        <tbody>
          <tr>
            <td style="border: none; padding: 0 0 4px; vertical-align: top; text-align: center;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 25px; font-weight: 700; letter-spacing: 0.03em; color: #111111; text-align: center;">
                Online Shop Order
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table role="presentation" style="width: 100%; border: none; margin: 0 0 6px;">
        <tbody>
          <tr>
            <td style="border: none; width: 50%; padding: 0 12px 5px 0; vertical-align: top;">
              ${renderPrintedOrderPlainField(orderBy || 'Phase 2 Foreman')}
            </td>
            <td style="border: none; width: 50%; padding: 0 0 5px 12px; vertical-align: top;">
              ${renderPrintedOrderMetaField('Date Ordered', orderDate, 'right')}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border: none; padding: 0 0 5px; vertical-align: top;">
              ${renderPrintedOrderMetaField('Desired Delivery Date', deliveryDateLabel)}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border: none; padding: 0 0 5px; vertical-align: top;">
              ${renderPrintedOrderMetaField('Job', jobLabel)}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border: none; padding: 0 0 4px; vertical-align: top;">
              ${renderPrintedOrderMetaField('Order #', orderIdentifier)}
            </td>
          </tr>
        </tbody>
      </table>

      ${comments
        ? `
          <div style="margin-top: 6px; font-size: 13px; line-height: 1.35; color: #222222;">
            <strong>Comments:</strong> ${renderEmailText(comments)}
          </div>
        `
        : ''}

      ${renderPrintedShopOrderItemsTable(items)}
    </div>
  `;
}
function buildShopOrderDocumentModel(order, costCodesByCatalogItemId = {}) {
    void costCodesByCatalogItemId;
    const items = Array.isArray(order?.items) ? order.items : [];
    const totalAmount = Number(order?.totalAmount);
    const orderIdentifier = getShopOrderDisplayNumber(order);
    const orderDate = formatCompactOrderEmailDate(order?.orderDate || order?.createdAt || order?.updatedAt);
    const deliveryDate = getShopOrderRequestedDeliveryDateValue(order);
    const deliveryDateLabel = deliveryDate
        ? formatCompactOrderEmailDate(deliveryDate)
        : 'N/A';
    const jobLabel = getJobDisplayLabel(order);
    const comments = String(order?.comments || '').trim();
    const orderBy = String(order?.foremanName || order?.submittedByName || '').trim() || 'Phase 2 Foreman';
    const lines = items.map((item) => {
        const descriptionSegments = getShopOrderDescriptionSegments(item?.description);
        const rootLabel = descriptionSegments[0] || null;
        const remainingSegments = shouldStripControlRootLabel(rootLabel)
            ? descriptionSegments.slice(1)
            : descriptionSegments;
        const fallbackDescription = String(item?.description || '').trim() || 'Untitled Item';
        const displayDescription = remainingSegments.at(-1) || descriptionSegments.at(-1) || fallbackDescription;
        return {
            displayDescription,
            note: String(item?.note || item?.notes || '').trim(),
            orderedQuantity: normalizeShopOrderQuantity(item?.quantity),
            pendingQuantity: getShopOrderItemPendingQuantity(item),
            receivedQuantity: getShopOrderItemReceivedQuantity(item),
            backorderedQuantity: getShopOrderItemBackorderedQuantity(item),
        };
    });
    return {
        orderIdentifier,
        orderBy,
        orderDate,
        deliveryDateLabel,
        jobLabel,
        comments,
        lines,
        totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
    };
}
/**
 * Build HTML template for shop order email
 */
function buildShopOrderEmail(order, costCodesByCatalogItemId = {}) {
    const model = buildShopOrderDocumentModel(order, costCodesByCatalogItemId);
    const itemsHtml = model.lines.length
        ? renderPrintedShopOrderSection(model.orderIdentifier, model.orderBy, model.orderDate, model.deliveryDateLabel, model.jobLabel, model.comments, model.lines)
        : '<p style="margin: 16px 0 0;"><em>No items in this order.</em></p>';
    const endOfOrderHtml = `
    <div style="margin-top: 12px; padding: 0 12px; font-size: 15px; color: #303030;">
      End of Order
    </div>
  `;
    return `
    ${constants_1.EMAIL_STYLES}
    ${SHOP_ORDER_EMAIL_PRINT_STYLES}
    <div class="email-container shop-order-email__document" style="width: ${SHOP_ORDER_DOCUMENT_WIDTH}px; min-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px; max-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px; font-family: Arial, sans-serif; background-color: #efefef; padding: 16px;">
      <div class="content shop-order-email__paper" style="width: ${SHOP_ORDER_DOCUMENT_WIDTH}px; min-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px; max-width: ${SHOP_ORDER_DOCUMENT_WIDTH}px; background-color: #ffffff; padding: 14px; line-height: 1.45; color: #222222;">
        ${model.totalAmount !== null ? `<div style="margin-bottom: 10px; font-size: 14px; color: #333333;"><strong>Estimated Total:</strong> $${model.totalAmount.toFixed(2)}</div>` : ''}
        ${itemsHtml}
        ${endOfOrderHtml}
      </div>
    </div>
  `;
}
function sanitizeShopOrderPdfFilenamePart(value) {
    return String(value ?? '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 80);
}
function buildShopOrderPdfFilename(order) {
    const orderIdentifier = sanitizeShopOrderPdfFilenamePart(getShopOrderDisplayNumber(order)) || 'Unnumbered';
    return `Online Shop Order ${orderIdentifier}.pdf`;
}
async function buildShopOrderPdfBuffer(order, costCodesByCatalogItemId = {}) {
    const model = buildShopOrderDocumentModel(order, costCodesByCatalogItemId);
    const doc = new pdfkit_1.default({ margin: 28, size: 'LETTER' });
    const chunks = [];
    const pageMargin = 28;
    const pageTop = 28;
    const pageBottom = doc.page.height - pageMargin;
    const tableX = pageMargin;
    const tableWidth = doc.page.width - (pageMargin * 2);
    const colWidths = [42, 46, 52, 58, 254, 52, 70, 18];
    const tableScale = tableWidth / colWidths.reduce((sum, width) => sum + width, 0);
    const scaledColWidths = colWidths.map((width) => width * tableScale);
    const borderColor = '#111111';
    const pdfText = (value, fallback = '') => {
        const text = String(value ?? '').trim();
        return text || fallback;
    };
    const sumWidths = (start, end) => (scaledColWidths.slice(start, end).reduce((sum, width) => sum + width, 0));
    const columnX = (index) => tableX + sumWidths(0, index);
    await new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        doc.on('end', () => resolve());
        doc.on('error', (err) => reject(err));
        const drawCell = (x, y, width, height, text, options) => {
            const fontSize = options?.fontSize ?? 9;
            const paddingX = options?.paddingX ?? 4;
            const paddingY = options?.paddingY ?? 4;
            doc.lineWidth(0.9).strokeColor(borderColor).rect(x, y, width, height).stroke();
            doc
                .font(options?.bold ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(fontSize)
                .fillColor('#111111')
                .text(text, x + paddingX, y + paddingY, {
                width: Math.max(width - (paddingX * 2), 0),
                height: Math.max(height - (paddingY * 2), 0),
                align: options?.align ?? 'left',
            });
        };
        const drawTableHeader = (y) => {
            const headerHeight = 32;
            const headers = ['Pulled\nBy', 'Verified\nBy', '133/513', 'Part#', 'Item Name', 'Quantity', 'Notes', ''];
            headers.forEach((header, index) => {
                drawCell(columnX(index), y, scaledColWidths[index] || 0, headerHeight, header, {
                    bold: true,
                    align: index === 4 || index === 6 ? 'left' : 'center',
                    fontSize: 10,
                    paddingX: index === 4 || index === 6 ? 5 : 3,
                    paddingY: 7,
                });
            });
            return y + headerHeight;
        };
        const drawDocumentHeader = (includeTableHeader = true) => {
            let y = pageTop;
            doc
                .font('Times-Bold')
                .fontSize(22)
                .fillColor('#111111')
                .text('Online Shop Order', pageMargin, y, {
                width: tableWidth,
                align: 'center',
            });
            y += 36;
            doc.font('Helvetica').fontSize(11);
            doc.text(pdfText(model.orderBy, 'Phase 2 Foreman'), pageMargin, y, { width: tableWidth / 2, align: 'left' });
            doc.font('Helvetica-Bold').text('Date Ordered:', pageMargin + (tableWidth / 2), y, { width: tableWidth / 4, align: 'right' });
            doc.font('Helvetica').text(model.orderDate, pageMargin + (tableWidth * 0.75) + 4, y, { width: (tableWidth / 4) - 4, align: 'left' });
            y += 18;
            const metaLines = [
                ['Desired Delivery Date', model.deliveryDateLabel],
                ['Job', model.jobLabel],
                ['Order #', model.orderIdentifier],
            ];
            metaLines.forEach(([label, value]) => {
                doc.font('Helvetica-Bold').fontSize(11).text(`${label}:`, pageMargin, y, { continued: true });
                doc.font('Helvetica').text(` ${pdfText(value)}`);
                y += 18;
            });
            if (model.comments) {
                doc.font('Helvetica-Bold').fontSize(11).text('Comments:', pageMargin, y, { continued: true });
                doc.font('Helvetica').text(` ${model.comments}`, { width: tableWidth });
                y += Math.max(18, doc.heightOfString(model.comments, { width: tableWidth - 70 }) + 4);
            }
            const nextY = y + 6;
            return includeTableHeader ? drawTableHeader(nextY) : nextY;
        };
        let cursorY = drawDocumentHeader();
        const ensureSpace = (height) => {
            if (cursorY + height <= pageBottom - 24)
                return;
            doc.addPage();
            cursorY = drawTableHeader(pageTop);
        };
        const ensureEndMarkerSpace = (height) => {
            if (cursorY + height <= pageBottom - 24)
                return;
            doc.addPage();
            cursorY = pageTop;
        };
        if (!model.lines.length) {
            ensureSpace(28);
            drawCell(tableX, cursorY, tableWidth, 28, 'No items in this order.', { fontSize: 10, paddingX: 6 });
            cursorY += 28;
        }
        model.lines.forEach((line) => {
            const itemWidth = scaledColWidths[4] - 10;
            const notesWidth = scaledColWidths[6] - 10;
            doc.font('Helvetica').fontSize(10);
            const itemHeight = doc.heightOfString(pdfText(line.displayDescription, 'Untitled Item'), { width: itemWidth });
            const noteHeight = line.note ? doc.heightOfString(line.note, { width: notesWidth }) : 0;
            const rowHeight = Math.max(30, itemHeight + 10, noteHeight + 10);
            ensureSpace(rowHeight);
            drawCell(columnX(0), cursorY, scaledColWidths[0] || 0, rowHeight, '', { align: 'center' });
            drawCell(columnX(1), cursorY, scaledColWidths[1] || 0, rowHeight, '', { align: 'center' });
            drawCell(columnX(2), cursorY, scaledColWidths[2] || 0, rowHeight, '', { align: 'center' });
            drawCell(columnX(3), cursorY, scaledColWidths[3] || 0, rowHeight, '', { align: 'center' });
            drawCell(columnX(4), cursorY, scaledColWidths[4] || 0, rowHeight, pdfText(line.displayDescription, 'Untitled Item'), { fontSize: 10, paddingX: 5, paddingY: 5 });
            drawCell(columnX(5), cursorY, scaledColWidths[5] || 0, rowHeight, String(line.orderedQuantity), { align: 'center', fontSize: 10, paddingY: 5 });
            drawCell(columnX(6), cursorY, scaledColWidths[6] || 0, rowHeight, line.note, { fontSize: 9, paddingX: 5, paddingY: 5 });
            drawCell(columnX(7), cursorY, scaledColWidths[7] || 0, rowHeight, '', { align: 'center' });
            cursorY += rowHeight;
        });
        ensureEndMarkerSpace(42);
        cursorY += 12;
        doc
            .font('Helvetica')
            .fontSize(13)
            .fillColor('#111111')
            .text('End of Order', pageMargin, cursorY);
        doc.end();
    });
    return Buffer.concat(chunks);
}
/**
 * Build HTML template for client secret expiration notification
 */
function buildSecretExpirationEmail() {
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container">
      <div class="header" style="background-color: #dc3545;">
        <h1>⚠️ Action Required: Client Secret Expiring Soon</h1>
      </div>
      <div class="content">
        <p style="color: #d32f2f; font-weight: bold;">Your Azure AD client secret is expiring in 30 days.</p>
        <p><strong>Expiration Date:</strong> ${(0, functionConfig_1.getGraphSecretExpirationDate)()}</p>
        <p>To avoid service disruption, please renew your client secret before the expiration date.</p>
        
        <h3>Steps to Renew:</h3>
        <p><strong>What to do:</strong></p>
        <ol>
          <li>Sign in to Azure Portal</li>
          <li>Navigate to App registrations → Phase 2 Email Service</li>
          <li>Go to Certificates & secrets</li>
          <li>Create a new client secret</li>
          <li>Update Firebase function secrets with the new value</li>
          <li>Redeploy Cloud Functions</li>
        </ol>
        
        <p><strong>What to do:</strong></p>
        <ol>
          <li>Contact your Microsoft 365 administrator</li>
          <li>Request a new client secret for AppID: f31ac0ab-6b28-44a7-ad73-afb71c64898f</li>
          <li>Provide the new secret to your Phase 2 technical team for deployment</li>
        </ol>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated notification. Time remaining: ${constants_1.EMAIL.SECRET_NOTIFICATION_DAYS} days from notification.
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `;
}
// ============================================================================
// EMAIL SENDING
// ============================================================================
/**
 * Send email via Microsoft Graph API
 */
async function sendEmail(options) {
    if (!isEmailEnabled()) {
        console.log('[sendEmail] Email sending disabled. Skipping send.');
        return;
    }
    try {
        // Get access token
        const token = await getGraphAuthToken();
        // Ensure to is an array
        const recipients = Array.isArray(options.to) ? options.to : [options.to];
        if (recipients.length === 0) {
            throw new Error('No recipients provided');
        }
        // Validate email addresses
        const invalidEmails = recipients.filter(email => !isValidEmailFormat(email.trim()));
        if (invalidEmails.length > 0) {
            throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
        }
        const senderEmail = functionConfig_1.outlookSenderEmail.value();
        console.log(`[sendEmail] Sending email to ${recipients.join(', ')} from ${senderEmail}`);
        console.log(`[sendEmail] Subject: ${options.subject}`);
        // Build Graph API request payload
        const payload = {
            message: {
                subject: options.subject,
                body: {
                    contentType: 'HTML',
                    content: options.html,
                },
                toRecipients: recipients.map(email => ({
                    emailAddress: {
                        address: email.trim(),
                    },
                })),
                ...(options.attachments && options.attachments.length
                    ? {
                        attachments: options.attachments.map(att => ({
                            '@odata.type': '#microsoft.graph.fileAttachment',
                            name: att.name,
                            contentType: att.contentType || 'application/octet-stream',
                            contentBytes: att.contentBytes,
                        })),
                    }
                    : {}),
            },
            saveToSentItems: true,
        };
        console.log('[sendEmail] Payload:', JSON.stringify(payload, null, 2));
        const graphEndpoint = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
        console.log('[sendEmail] Using endpoint:', graphEndpoint);
        // Send via Graph API
        const response = await axios_1.default.post(graphEndpoint, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        console.log(`[sendEmail] Email sent successfully. Status: ${response.status}`);
    }
    catch (error) {
        console.error('[sendEmail] Error sending email');
        console.error('[sendEmail] Error status:', error.response?.status);
        console.error('[sendEmail] Error headers:', error.response?.headers);
        console.error('[sendEmail] Error data:', JSON.stringify(error.response?.data, null, 2));
        console.error('[sendEmail] Full error message:', error.message);
        throw new Error(`Failed to send email: ${error.message}`);
    }
}
/**
 * Validate email format
 */
function isValidEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
// ============================================================================
// PUBLIC API
// ============================================================================
/**
 * Send daily log email notification
 */
async function sendDailyLogEmailNotification(recipients, jobDetails, logDate, dailyLog) {
    const html = buildDailyLogEmail(jobDetails, logDate, dailyLog || {});
    await sendEmail({
        to: recipients,
        subject: `${constants_1.EMAIL.SUBJECTS.DAILY_LOG} - ${jobDetails.name || 'Job'} - ${logDate}`,
        html,
    });
}
/**
 * Send shop order email notification
 */
async function sendShopOrderEmailNotification(recipients, order) {
    const orderIdentifier = getShopOrderDisplayNumber(order);
    const html = buildShopOrderEmail(order);
    const pdfBuffer = await buildShopOrderPdfBuffer(order);
    await sendEmail({
        to: recipients,
        subject: `${constants_1.EMAIL.SUBJECTS.SHOP_ORDER} - Order #${orderIdentifier}`,
        html,
        attachments: [
            {
                name: buildShopOrderPdfFilename(order),
                contentType: 'application/pdf',
                contentBytes: pdfBuffer.toString('base64'),
            },
        ],
    });
}
/**
 * Send secret expiration warning email
 */
async function sendSecretExpirationWarning(adminEmails) {
    const html = buildSecretExpirationEmail();
    await sendEmail({
        to: adminEmails,
        subject: '⚠️ Client Secret Expiring Soon - Action Required',
        html,
    });
}
//# sourceMappingURL=emailService.js.map