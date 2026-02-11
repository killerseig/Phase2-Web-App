# Email Migration: Gmail → Microsoft Graph API + Outlook

## Current State (Gmail/Nodemailer)

### Architecture
- **Email Service**: Cloud Function using `nodemailer` library
- **SMTP Configuration**: Gmail service with app-specific password
- **Credentials**: EMAIL_USER and EMAIL_PASSWORD stored as Firebase secrets
- **Sender Address**: Dynamically set to email user's account
- **Transport Type**: Direct SMTP

### Current Flow
1. Client calls Firebase Cloud Function (onCall)
2. Function retrieves email content from Firestore
3. Function builds HTML email using template builders
4. Function uses nodemailer to send via Gmail SMTP
5. Email is sent from configured EMAIL_USER

### Affected Cloud Functions
- `sendDailyLogEmail` - sends daily log reports
- `sendTimecardEmail` - sends timecard reports
- `sendShopOrderEmail` - sends shop orders
- `sendPasswordResetEmail` - sends password reset links (uses Firebase Admin SDK, NOT nodemailer)

---

## New State (Microsoft Graph API + Outlook)

### Architecture
- **Email Service**: Cloud Function using Microsoft Graph API
- **Authentication**: OAuth 2.0 Client Credentials flow
- **Credentials**: AppID, TenantID, Secret (stored as Firebase secrets)
- **Sender Address**: Shared mailbox (configured in secret manager)
- **Permissions**: Send.Mail permission granted
- **Endpoint**: `https://graph.microsoft.com/v1.0/me/sendMail`

### New Flow
1. Cloud Function initializes at startup
2. Function authenticates to Microsoft Graph using Client Credentials flow
3. Function gets OAuth token from Azure AD
4. Function builds email message in Graph API format
5. Function sends email via Graph API endpoint
6. Email is sent from configured sender address

---

## Changes Required

### 1. **Dependencies** (functions/package.json)
**Add:**
- `@azure/identity` - Handle OAuth 2.0 Client Credentials flow
- `@microsoft/microsoft-graph-client` - Microsoft Graph SDK (optional but recommended)

OR simpler approach:
- Just use built-in `https` or similar for direct Graph API calls with token

**Remove:**
- `nodemailer` (optional - can keep for fallback)

**Recommended approach**: Keep `nodemailer` as fallback for now, add Graph API library

### 2. **Firebase Secrets** (firebase.json or function config)
**Remove:**
- `EMAIL_USER`
- `EMAIL_PASSWORD`

**Add (store in secret manager, do not commit):**
- Application Client ID
- Tenant ID
- Application Client Secret
- Sender email address (shared mailbox)

### 3. **Email Service** (functions/src/emailService.ts)
**Create new functions:**
- `getGraphAuthToken()` - Get OAuth token from Azure AD
- `getGraphTransporter()` or `sendGraphEmail()` - Replace nodemailer transport
- Update `sendEmail()` to use Graph API

**Changes to existing functions:**
- Keep email template builders (HTML generation) - they stay the same
- Update `getSenderEmail()` to return configured sender email (from secrets)
- Remove/deprecate `getEmailTransporter()` for nodemailer

**Architecture:**
```typescript
// Token cache (for efficiency)
let cachedToken: { token: string; expiresAt: number } | null = null

// Get OAuth token (with caching)
async function getGraphAuthToken(): Promise<string>

// Send email via Graph API
async function sendEmail(options: {
  to: string | string[]
  subject: string
  html: string
}): Promise<void>
```

### 4. **Cloud Functions** (functions/src/index.ts)
**Changes:**
- Update secret definitions (replace emailUser/emailPassword with Graph secrets)
- Update function decorators to use new secrets
- No changes to function logic or parameters (everything stays the same from client perspective)

### 5. **Client Service** (src/services/Email.ts)
**No changes needed** - Already using abstract callables, don't know/care about backend implementation

---

## Implementation Details

### Graph API Token Acquisition
**Endpoint:** `https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token`

Use client-credentials flow parameters (app ID, app secret, scope, grant_type) sent as form data. All values must come from secret storage; do not commit them.

### Graph API Send Mail
**Endpoint:** `https://graph.microsoft.com/v1.0/me/sendMail`

**Request:**
```json
{
  "message": {
    "subject": "Email Subject",
    "body": {
      "contentType": "HTML",
      "content": "<html>...</html>"
    },
    "toRecipients": [
      {
        "emailAddress": {
          "address": "recipient@example.com"
        }
      }
    ]
  }
}
```

**Headers:**
```
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

---

## Testing Plan

1. **Unit Test**: Token acquisition (caching works)
2. **Integration Test**: Send email to test address
3. **Email Verification**: Check email received from the configured sender origin
4. **Batch Test**: Send multiple emails in parallel
5. **Error Handling**: Test invalid recipients, network failures
6. **Fallback**: Consider fallback to Gmail if Graph API fails (optional)

---

## Security Considerations

✅ **Secure:**
- Secret stored in Firebase Secrets Manager
- Client Credentials flow (no user interaction needed)
- Token expiration + caching (1 hour default)
- Shared mailbox isolated (hidden from address book, no user permissions)

⚠️ **Notes:**
- Secret expires in 1 year (Feb 2027) - reminder needed
- Shared mailbox is unmonitored - monitor if needed
- Client ID/Tenant ID are not sensitive (public Microsoft values)
- Only SECRET needs to be kept private

---

## Secret Expiration Monitoring

### Feature: Admin Notification 30 Days Before Expiration

**Purpose**: Ensure admins have time to renew the secret before it expires and breaks email functionality.

**Expiration Date**: February 9, 2027 (1 year from Feb 9, 2026)  
**Notification Date**: January 10, 2027 (30 days before)

### Implementation

**New Cloud Function**: `notifySecretExpiration` (Cloud Scheduler)
- **Trigger**: Daily scheduled function (e.g., runs at 9 AM UTC each day)
- **Logic**:
  1. Check current date
  2. If current date >= January 10, 2027 AND secret hasn't been renewed
  3. Query Firestore for all users with 'admin' role
  4. Send email to all admin addresses with:
     - Subject: "⚠️ Graph API Secret Expiring Soon - Action Required"
     - Content: Expiration date, renewal instructions, contact info
     - Instructions to contact Microsoft support or designated admin

**Email Template**:
```
Subject: ⚠️ Graph API Secret Expiring Soon - Action Required

Dear Admin,

The Microsoft Graph API secret for the shared mailbox is expiring soon.

Please contact the Microsoft 365 administrator to renew this secret 
and update the application before this date.

Failure to renew will result in email functionality being disabled.

Questions? Contact your administrator.

---
This is an automated notification. The secret expires in 30 days.
```

**Code Structure**:
```typescript
// In functions/src/index.ts
export const notifySecretExpiration = onSchedule(
  'every day 09:00',
  async (context) => {
    // Check if secret expires within 30 days (hardcoded date or config)
    // If yes, get all admin users
    // Send notification email to each
  }
)
```

**Constants to Add** (functions/src/constants.ts):
```typescript
export const SECRET_EXPIRATION = {
  DATE: '2027-02-09', // YYYY-MM-DD format
  NOTIFICATION_DAYS: 30,
  SUBJECT: '⚠️ Graph API Secret Expiring Soon - Action Required',
}
```

### Manual Renewal Process (for when Jan 10, 2027 arrives)
1. Microsoft 365 admin generates new secret
2. Admin updates Firebase secrets with the new secret value
3. Deploy updated functions
4. Old secret stops working after Feb 9, 2027
5. No downtime if renewed on time

---

## Rollback Plan

1. Keep nodemailer + Gmail credentials as fallback option
2. Add feature flag in constants to switch between implementations
3. Test both implementations during transition period
4. Can temporarily switch back to Gmail if issues arise

---

## Timeline

**Phase 1: Setup**
- Add dependencies to package.json
- Define Firebase secrets
- Create Graph API utilities

**Phase 2: Implementation**
- Update emailService.ts with Graph API integration
- Update function decorators with new secrets
- Implement token caching

**Phase 3: Testing**
- Unit tests for token acquisition
- Integration tests with real Graph API
- Send test emails to verify

**Phase 4: Deployment**
- Set Firebase secrets in production
- Deploy updated functions
- Monitor for errors

**Phase 5: Cleanup** (after verification)
- Remove Gmail credentials from secrets (if not keeping fallback)
- Remove nodemailer from dependencies (if not keeping fallback)
