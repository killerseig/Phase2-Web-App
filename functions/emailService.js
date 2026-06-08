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
exports.buildWelcomeEmail = buildWelcomeEmail;
exports.buildPasswordResetEmail = buildPasswordResetEmail;
exports.buildDailyLogAutoSubmitEmail = buildDailyLogAutoSubmitEmail;
exports.buildDailyLogEmail = buildDailyLogEmail;
exports.buildTimecardsEmail = buildTimecardsEmail;
exports.buildTimecardEmail = buildTimecardEmail;
exports.buildShopOrderEmail = buildShopOrderEmail;
exports.buildSecretExpirationEmail = buildSecretExpirationEmail;
exports.sendEmail = sendEmail;
exports.sendDailyLogEmailNotification = sendDailyLogEmailNotification;
exports.sendTimecardEmailNotification = sendTimecardEmailNotification;
exports.sendShopOrderEmailNotification = sendShopOrderEmailNotification;
exports.sendSecretExpirationWarning = sendSecretExpirationWarning;
const axios_1 = __importDefault(require("axios"));
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
    const manpowerLines = (Array.isArray(dailyLog?.manpowerLines) && dailyLog.manpowerLines.length
        ? dailyLog.manpowerLines
        : [{ trade: '', count: 0, areas: '' }])
        .map((line) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(line.trade)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(line.count)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(line.areas)}</td>
    </tr>
  `).join('');
    const indoorClimateRows = (Array.isArray(dailyLog?.indoorClimateReadings) && dailyLog.indoorClimateReadings.length
        ? dailyLog.indoorClimateReadings
        : [{ area: '', high: '', low: '', humidity: '' }])
        .map((reading) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(reading.area)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.high)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.low)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.humidity)}</td>
    </tr>
  `).join('');
    const attachments = (dailyLog?.attachments || [])
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
        <p><strong>Project Name:</strong> ${displayValue(dailyLog?.projectName)}</p>
        <p><strong>Job Number:</strong> ${displayValue(dailyLog?.jobSiteNumbers || jobDetails?.number)}</p>
        <p><strong>Foreman:</strong> ${displayValue(dailyLog?.foremanOnSite)}</p>
        <p><strong>Project Manager:</strong> ${displayValue(dailyLog?.siteForemanAssistant)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Manpower</h3>
        <p><strong>Manpower Summary:</strong> ${displayValue(dailyLog?.manpower)}</p>
        <p><strong>Weekly Schedule:</strong> ${displayValue(dailyLog?.weeklySchedule)}</p>
        <p><strong>Manpower Assessment:</strong> ${displayValue(dailyLog?.manpowerAssessment)}</p>

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
        <p><strong>Safety Concerns:</strong> ${displayValue(dailyLog?.safetyConcerns)}</p>
        <p><strong>AHA Reviewed:</strong> ${displayValue(dailyLog?.ahaReviewed)}</p>
        <p><strong>Schedule Concerns:</strong> ${displayValue(dailyLog?.scheduleConcerns)}</p>
        <p><strong>Budget Concerns:</strong> ${displayValue(dailyLog?.budgetConcerns)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Deliveries & Materials</h3>
        <p><strong>Deliveries Received:</strong> ${displayValue(dailyLog?.deliveriesReceived)}</p>
        <p><strong>Deliveries Needed:</strong> ${displayValue(dailyLog?.deliveriesNeeded)}</p>
        <p><strong>New Work Authorizations:</strong> ${displayValue(dailyLog?.newWorkAuthorizations)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Quality Control</h3>
        <p><strong>Who is assigned to do QC?</strong> ${displayValue(dailyLog?.qcAssignedTo)}</p>
        <p><strong>What areas were inspected?</strong> ${displayValue(dailyLog?.qcAreasInspected ?? dailyLog?.qcInspection)}</p>
        <p><strong>What issues were identified?</strong> ${displayValue(dailyLog?.qcIssuesIdentified)}</p>
        <p><strong>What was done to fix the issues?</strong> ${displayValue(dailyLog?.qcIssuesResolved)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Notes & Action Items</h3>
        <p><strong>Notes & Correspondence:</strong> ${displayValue(dailyLog?.notesCorrespondence)}</p>
        <p><strong>Action Items:</strong> ${displayValue(dailyLog?.actionItems)}</p>

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
    const visibleDayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const visibleDayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const columnWidthPercents = [
        '7.33', '3.49', '3.49', '8.96', '4.35',
        '7.33', '7.33', '7.33', '7.33', '7.33', '7.33',
        '9.46', '9.46', '9.46',
    ];
    const cardColgroupHtml = columnWidthPercents.map((percent) => `<col style="width:${percent}%;" />`).join('');
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
    const summaryEnd = summaryStart && !Number.isNaN(summaryStart.getTime()) ? new Date(summaryStart) : null;
    if (summaryEnd)
        summaryEnd.setDate(summaryEnd.getDate() + 6);
    const weekLabel = summaryStart && summaryEnd
        ? `${summaryStart.getMonth() + 1}/${summaryStart.getDate()}/${summaryStart.getFullYear()} - ${summaryEnd.getMonth() + 1}/${summaryEnd.getDate()}/${summaryEnd.getFullYear()}`
        : 'N/A';
    const lineRowKinds = [
        { key: 'hours', label: 'H', diffField: 'difH' },
        { key: 'production', label: 'P', diffField: 'difP' },
        { key: 'cost', label: 'C', diffField: 'difC' },
    ];
    const cardWidth = '5.078in';
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
        const brandHeight = '21.853pt';
        const headerRowHeight = '11.849pt';
        const headerGapHeight = '9.8pt';
        const gridHeaderHeight = '12.15pt';
        const gridBodyHeight = '8.03pt';
        const gridTotalHeight = '16.01pt';
        const footerLabelRowHeight = '13.079pt';
        const footerBoxRowHeight = '15.539pt';
        const footerAuxRowHeight = '13.079pt';
        const bottomSpacerHeight = '10.2pt';
        const blankCell = 'border:0; padding:0; font-size:0; line-height:1;';
        const baseCell = `border:${thinBorder}; padding:0; height:${gridBodyHeight}; text-align:center; vertical-align:middle; line-height:1; font-family:'Times New Roman', Times, serif; font-size:0.098in;`;
        const headerCell = `border:${thinBorder}; padding:0; height:${gridHeaderHeight}; text-align:center; vertical-align:middle; line-height:1; font-family:'Times New Roman', Times, serif; font-size:0.086in; font-style:italic; font-weight:400;`;
        const totalCell = `border:${thinBorder}; padding:0; height:${gridTotalHeight}; text-align:center; vertical-align:middle; line-height:1; font-family:'Times New Roman', Times, serif; font-size:0.105in; font-weight:700;`;
        const formLabelCell = `border:0; height:${headerRowHeight}; padding:0 0.03in 0.02in 0; white-space:nowrap; text-align:right; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.09in; font-style:italic; font-weight:400; line-height:1;`;
        const renderFormValueCell = (align = 'left', fontSize = '0.105in') => (`border:0; border-bottom:1px solid #111111; height:${headerRowHeight}; padding:0 0.03in 0.02in; text-align:${align}; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:${fontSize}; font-weight:700; line-height:1;`);
        const footerLabelCell = `border:0; height:${footerLabelRowHeight}; padding:0 0 2px; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.09in; font-weight:400; line-height:1;`;
        const footerStatLabelCell = `border:0; height:${footerLabelRowHeight}; padding:0 0 2px; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.09in; font-weight:400; line-height:1;`;
        const footerStatValueCell = `border:0; border-bottom:1px solid #111111; height:${footerLabelRowHeight}; padding:0 0 0.01in; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.1in; font-weight:700; line-height:1;`;
        const footerStatLabelRowTwoCell = `border:0; height:${footerBoxRowHeight}; padding:0 0 2px; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.09in; font-weight:400; line-height:1;`;
        const footerStatValueRowTwoCell = `border:0; border-bottom:1px solid #111111; height:${footerBoxRowHeight}; padding:0 0 0.01in; text-align:center; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.1in; font-weight:700; line-height:1;`;
        const footerBoxCell = `border:${thinBorder}; height:${footerBoxRowHeight}; padding:0.01in 0.02in; text-align:center; vertical-align:middle; font-family:'Times New Roman', Times, serif; font-size:0.095in; font-weight:700; line-height:1;`;
        const footerAuxBoxCell = `border:${thinBorder}; height:${footerAuxRowHeight}; padding:0.01in 0.02in; text-align:center; vertical-align:middle; font-family:'Times New Roman', Times, serif; font-size:0.095in; font-weight:700; line-height:1;`;
        const notesLabelCell = `border:0; height:${footerAuxRowHeight}; padding:0 0.02in 0 0; text-align:right; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.09in; font-weight:400; line-height:1;`;
        const notesLineCell = `border:0; border-bottom:1px solid #111111; height:${footerAuxRowHeight}; padding:0 0 0.01in; text-align:left; vertical-align:bottom; font-family:'Times New Roman', Times, serif; font-size:0.095in; line-height:1;`;
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
                        ? formatTrimmedNumber(lineProductionTotal, 3, false)
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
            ${rowKindIndex === 0 ? `<td rowspan="${lineRowKinds.length}" style="${baseCell} border-top:${thickBorder}; vertical-align:top; padding-top:0.015in; font-weight:700;">${renderOptionalText(hasLine ? formatHours(lineHoursTotal) : '')}</td>` : ''}
            <td style="${detailStyle}">${renderOptionalText(productionCell)}</td>
            <td style="${detailStyle}">${renderOptionalText(offCell)}</td>
          </tr>
        `;
            }).join('');
        }).join('');
        return `
      <table role="presentation" class="tc-card-wrap" style="width:${cardWidth}; border-collapse:collapse; table-layout:fixed; margin:0; border:1px solid #111111; background:#ffffff; color:#111111; font-family:'Times New Roman', Times, serif;">
        <tr>
          <td style="height:${brandHeight}; padding:0 0.08in; border:0; text-align:center; vertical-align:middle; font-family:Arial, Helvetica, sans-serif; font-size:0.18in; font-weight:700; line-height:1;">PHASE 2 COMPANY</td>
        </tr>
        <tr>
          <td style="padding:0; border:0;">
              <table role="presentation" style="width:100%; border-collapse:collapse; border:0; margin:0;">
                <tr>
                  <td style="border:0; padding:0 0.08in;">
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
                    <td colspan="5" style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder}; text-align:right; padding-right:0.08in;">TOTAL HOURS</td>
                    ${totalHoursByDay.map((value) => `<td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">${renderOptionalText(formatHours(value))}</td>`).join('')}
                    <td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">${renderOptionalText(formatHours(hoursTotal))}</td>
                    <td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">${renderOptionalText(formatTrimmedNumber(productionTotal, 3, false))}</td>
                    <td style="${totalCell} border-top:${thickBorder}; border-bottom:${thickBorder};">&nbsp;</td>
                  </tr>
                </tfoot>
              </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0; border:0; vertical-align:top;">
              <table role="presentation" style="width:100%; border-collapse:collapse; table-layout:fixed; margin:0; border:0;">
                <colgroup>${cardColgroupHtml}</colgroup>
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
            return `
          <table role="presentation" class="tc-sheet" style="width:100%; border-collapse:collapse; table-layout:fixed; border:0.75px solid #111111; margin:0 0 18px; font-family:Arial, Helvetica, sans-serif;">
            <tr>
              <td colspan="2" style="padding:14px 16px 12px; border-bottom:0.75px solid #111111; text-align:center; font-size:24px; font-weight:700; letter-spacing:0.02em;">Timecards Submitted</td>
            </tr>
            <tr>
              <td style="width:60%; padding:4px 8px; border-right:0.75px solid #111111; border-bottom:0.75px solid #111111; font-size:13px; line-height:1.35;"><strong>Job:</strong> ${escapeHtml(displayValue(payload.jobName))}${payload.jobNumber ? ` (#${escapeHtml(String(payload.jobNumber).trim())})` : ''}</td>
              <td style="width:40%; padding:4px 8px; border-bottom:0.75px solid #111111; font-size:13px; line-height:1.35; text-align:right;"><strong>Week:</strong> ${escapeHtml(weekLabel)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:4px 8px; border-bottom:0.75px solid #111111; font-size:13px; line-height:1.35;"><strong>Submitted by:</strong> ${escapeHtml(displayValue(payload.submittedBy))}</td>
            </tr>
            <tr>
              <td style="width:50%; vertical-align:top; padding:12px 18px 12px 12px; border:0;">${left}</td>
              <td style="width:50%; vertical-align:top; padding:12px 12px 12px 18px; border:0;">${right || '&nbsp;'}</td>
            </tr>
          </table>
        `;
        }).join('')}
    `
        : '<p style="margin:0; font-size:13px;">No timecards found.</p>';
    return `
    <div style="background:#ffffff; padding:8px; color:#111111; font-family:Arial, Helvetica, sans-serif;">
      ${cardsHtml}
    </div>
  `;
    return `
    ${constants_1.EMAIL_STYLES}
    <style>
      .tc-print {
        background:#ffffff !important;
        padding:8px !important;
        color:#111111 !important;
      }
      .tc-print .tc-email-body {
        width: 10.95in !important;
        max-width: 10.95in !important;
        margin: 0 auto !important;
      }
      .tc-print .email-container {
        width: 10.95in !important;
        max-width: 10.95in !important;
        margin: 0 auto !important;
        background: #ffffff !important;
        padding: 0 !important;
      }
      .tc-print .content {
        background: #ffffff !important;
        border: 0 !important;
        padding: 0 !important;
        line-height: normal !important;
      }
      .tc-print .header,
      .tc-print .footer,
      .tc-print .tc-summary-table {
        display: none !important;
      }
      .tc-print table,
      .tc-print th,
      .tc-print td {
        color: #111111 !important;
        background: #ffffff !important;
        border-color: #111111 !important;
      }
      .tc-print table {
        margin: 0 !important;
        border-spacing: 0 !important;
      }
      .tc-print tr {
        background: #ffffff !important;
      }
      .tc-print .tc-card-wrap,
      .tc-print .tc-sheet {
        page-break-inside: avoid !important;
        break-inside: avoid-page !important;
      }
      .tc-print .tc-card-wrap {
        width: 5.078in !important;
        max-width: 5.078in !important;
        box-sizing: border-box !important;
        margin: 0 auto !important;
      }
      @media print {
        .tc-print {
          margin: 0 !important;
          padding: 0 !important;
        }
        .tc-print .tc-email-body {
          max-width: none !important;
        }
      }
    </style>
    <div class="tc-print">
    <div class="email-container">
      <div class="header">
        <h1 style="margin:0; font-size:24px; font-weight:700; letter-spacing:0.02em;">Timecards Submitted</h1>
      </div>
      <div class="content">
        <table role="presentation" class="tc-summary-table" style="width:100%; border-collapse:collapse; margin:0 0 12px; border:1px solid #111111;">
          <tr>
            <td style="width:60%; padding:4px 8px; font-size:13px; line-height:1.35; border:1px solid #111111;"><strong>Job:</strong> ${escapeHtml(displayValue(payload.jobName))}${payload.jobNumber ? ` (#${escapeHtml(String(payload.jobNumber).trim())})` : ''}</td>
            <td style="width:40%; padding:4px 8px; font-size:13px; line-height:1.35; text-align:right; border:1px solid #111111;"><strong>Week:</strong> ${escapeHtml(weekLabel)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:4px 8px; font-size:13px; line-height:1.35; border:1px solid #111111;"><strong>Submitted by:</strong> ${escapeHtml(displayValue(payload.submittedBy))}</td>
          </tr>
        </table>
        ${cardsHtml}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
    </div>
  `;
}
/**
 * Build HTML template for timecard email
 */
function buildTimecardEmail(employeeName, weekEnding) {
    const formattedDate = new Date(weekEnding).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Timecard Submitted</h1>
      </div>
      <div class="content">
        <p><strong>Employee:</strong> ${employeeName}</p>
        <p><strong>Week Ending:</strong> ${formattedDate}</p>
        <p>A timecard has been submitted. Please review the Phase 2 application for full details.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `;
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
function isShopTransferRootLabel(rootLabel) {
    if (!rootLabel)
        return false;
    const normalized = normalizeRootFolderLabel(rootLabel);
    return normalized === 'shop' || normalized.startsWith('shop ');
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
function renderPrintedShopOrderSection(orderIdentifier, orderBy, orderDate, deliveryDateLabel, jobLabel, comments, items) {
    if (!items.length)
        return '';
    return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #d4d4d4; margin-top: 18px; page-break-inside: auto;">
      <tbody>
        <tr>
          <td style="border: none; padding: 14px 14px 12px;">
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

            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #d8d8d8; page-break-inside: auto;">
              <thead style="display: table-header-group;">
                <tr>
                  <th style="padding: 6px 5px; border: 1px solid #d8d8d8; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; width: 54px;">Pulled<br>By</th>
                  <th style="padding: 6px 5px; border: 1px solid #d8d8d8; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; width: 58px;">Verified<br>By</th>
                  <th style="padding: 6px 5px; border: 1px solid #d8d8d8; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; width: 62px;">133/513</th>
                  <th style="padding: 6px 7px; border: 1px solid #d8d8d8; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: left;">Item Name</th>
                  <th style="padding: 6px 5px; border: 1px solid #d8d8d8; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; width: 70px;">Quantity</th>
                  <th style="padding: 6px 7px; border: 1px solid #d8d8d8; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: left; width: 150px;">Notes</th>
                  <th style="padding: 6px 5px; border: 1px solid #d8d8d8; font-size: 15px; font-weight: 700; line-height: 1.15; text-align: center; width: 46px;">&nbsp;</th>
                </tr>
              </thead>
              <tbody style="display: table-row-group;">
                ${items.map((item) => `
                  <tr style="page-break-inside: avoid; break-inside: avoid;">
                    <td style="height: 30px; padding: 5px 5px; border: 1px solid #d8d8d8; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
                    <td style="height: 30px; padding: 5px 5px; border: 1px solid #d8d8d8; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
                    <td style="height: 30px; padding: 5px 5px; border: 1px solid #d8d8d8; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
                    <td style="height: 30px; padding: 5px 7px; border: 1px solid #d8d8d8; vertical-align: middle; font-size: 13px; line-height: 1.25;">${renderEmailText(item.displayDescription, 'Untitled Item')}</td>
                    <td style="height: 30px; padding: 5px 5px; border: 1px solid #d8d8d8; text-align: center; vertical-align: middle; font-size: 13px; line-height: 1.2;">${item.orderedQuantity}</td>
                    <td style="height: 30px; padding: 5px 7px; border: 1px solid #d8d8d8; vertical-align: middle; font-size: 12px; line-height: 1.25; color: #333333;">${renderOptionalEmailText(item.note)}</td>
                    <td style="height: 30px; padding: 5px 5px; border: 1px solid #d8d8d8; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.2;">&nbsp;</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}
/**
 * Build HTML template for shop order email
 */
function buildShopOrderEmail(order, costCodesByCatalogItemId = {}) {
    void costCodesByCatalogItemId;
    const items = order?.items || [];
    const totalAmount = Number(order?.totalAmount);
    const hasTotalAmount = Number.isFinite(totalAmount);
    const orderIdentifier = getShopOrderDisplayNumber(order);
    const orderDate = formatCompactOrderEmailDate(order?.orderDate || order?.createdAt || order?.updatedAt);
    const deliveryDate = getShopOrderRequestedDeliveryDateValue(order);
    const deliveryDateLabel = deliveryDate
        ? formatCompactOrderEmailDate(deliveryDate)
        : 'N/A';
    const jobLabel = getJobDisplayLabel(order);
    const comments = String(order?.comments || '').trim();
    const orderBy = String(order?.foremanName || order?.submittedByName || '').trim();
    const emailLines = items.map((item) => {
        const descriptionSegments = getShopOrderDescriptionSegments(item?.description);
        const rootLabel = descriptionSegments[0] || null;
        const remainingSegments = shouldStripControlRootLabel(rootLabel)
            ? descriptionSegments.slice(1)
            : descriptionSegments;
        const fallbackDescription = String(item?.description || '').trim() || 'Untitled Item';
        const displayDescription = remainingSegments.at(-1) || descriptionSegments.at(-1) || fallbackDescription;
        return {
            bucket: isShopTransferRootLabel(rootLabel) ? 'shop' : 'pm',
            displayDescription,
            note: String(item?.note || item?.notes || '').trim(),
            orderedQuantity: normalizeShopOrderQuantity(item?.quantity),
            pendingQuantity: getShopOrderItemPendingQuantity(item),
            receivedQuantity: getShopOrderItemReceivedQuantity(item),
            backorderedQuantity: getShopOrderItemBackorderedQuantity(item),
        };
    });
    const shopLines = emailLines.filter((item) => item.bucket === 'shop');
    const pmLines = emailLines.filter((item) => item.bucket === 'pm');
    const shopComments = shopLines.length ? comments : '';
    const pmComments = shopLines.length ? '' : comments;
    const shopItemsHtml = renderPrintedShopOrderSection(orderIdentifier, orderBy || 'Phase 2 Foreman', orderDate, deliveryDateLabel, jobLabel, shopComments, shopLines);
    const pmItemsHtml = renderPrintedShopOrderSection(orderIdentifier, orderBy || 'Phase 2 Foreman', orderDate, deliveryDateLabel, jobLabel, pmComments, pmLines);
    const itemsHtml = shopItemsHtml || pmItemsHtml
        ? `${shopItemsHtml}${pmItemsHtml}`
        : '<p style="margin: 16px 0 0;"><em>No items in this order.</em></p>';
    const endOfOrderHtml = `
    <div style="margin-top: 12px; padding: 0 12px; font-size: 15px; color: #303030;">
      End of Order
    </div>
  `;
    return `
    ${constants_1.EMAIL_STYLES}
    <div class="email-container" style="font-family: Arial, sans-serif; background-color: #efefef; padding: 16px;">
      <div class="content" style="background-color: #ffffff; padding: 14px; line-height: 1.45; color: #222222;">
        ${hasTotalAmount ? `<div style="margin-bottom: 10px; font-size: 14px; color: #333333;"><strong>Estimated Total:</strong> $${totalAmount.toFixed(2)}</div>` : ''}
        ${itemsHtml}
        ${endOfOrderHtml}
      </div>
      <div class="footer" style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666666; border-radius: 0 0 4px 4px;">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `;
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
 * Send timecard email notification
 */
async function sendTimecardEmailNotification(recipients, employeeName, weekEnding) {
    const html = buildTimecardEmail(employeeName, weekEnding);
    await sendEmail({
        to: recipients,
        subject: `${constants_1.EMAIL.SUBJECTS.TIMECARD} - ${employeeName}`,
        html,
    });
}
/**
 * Send shop order email notification
 */
async function sendShopOrderEmailNotification(recipients, order) {
    const orderIdentifier = getShopOrderDisplayNumber(order);
    const html = buildShopOrderEmail(order);
    await sendEmail({
        to: recipients,
        subject: `${constants_1.EMAIL.SUBJECTS.SHOP_ORDER} - Order #${orderIdentifier}`,
        html,
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