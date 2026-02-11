# Email Functionality Setup Guide

## Overview
Email functionality has been added to automatically send Daily Logs when submitted. The system includes:
- **Automatic Email Sending**: Daily logs are emailed automatically upon submission
- **Persistent Recipients**: Per-job email list that persists across all daily logs
- **Hardcoded Recipients**: System-wide recipients that always receive logs
- **Custom Recipients**: Job-specific recipients that can be added/removed by users

## What's Been Implemented

### 1. Cloud Functions (✅ Complete)
Located in `functions/src/index.ts`:
- `sendDailyLogEmail` - Sends formatted daily log reports
- `sendTimecardEmail` - Sends timecard summaries with hours breakdown
- `sendShopOrderEmail` - Sends shop order details

### 2. Client Service (✅ Complete)
Located in `src/services/Email.ts`:
- Helper functions to call the Cloud Functions from the client

### 3. Job-Level Email Recipients (✅ Complete)
Located in `src/services/Jobs.ts`:
- `getDailyLogRecipients()` - Get saved recipients for a job
- `updateDailyLogRecipients()` - Update saved recipients for a job
- Email list stored in jobs collection as `dailyLogRecipients: string[]`

### 4. UI Components
- ✅ **DailyLogs.vue** - Automatic email on submit + recipient management section
- ⚠️ **Timecards.vue** - Manual email available (optional)
- ⚠️ **ShopOrders.vue** - Manual email available (optional)

## Email Service Configuration

### Step 1: Set up Gmail App Password (or use another SMTP service)

1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App-Specific Password for "Mail"
4. Copy the 16-character password

### Step 2: Configure Firebase Functions

Run these commands:

```bash
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.password="your-app-specific-password"
```

### Step 3: For Local Development

Create `functions/.runtimeconfig.json`:

```json
{
  "email": {
    "user": "your-email@gmail.com",
    "password": "your-app-specific-password"
  }
}
```

⚠️ **Important**: Add `functions/.runtimeconfig.json` to `.gitignore`

### Step 4: Deploy Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

## Alternative Email Services

### Using SendGrid
```typescript
// In functions/src/index.ts, replace the emailTransporter with:
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(functions.config().sendgrid?.key || process.env.SENDGRID_API_KEY)
```

### Using AWS SES
```typescript
const nodemailer = require('nodemailer')
const aws = require('@aws-sdk/client-ses')

const ses = new aws.SES({
  apiVersion: '2010-12-01',
  region: 'us-east-1'
})

const emailTransporter = nodemailer.createTransport({
  SES: { ses, aws }
})
```

## Fix Remaining TypeScript Errors

The email modal code was added to Timecards and ShopOrders but got placed incorrectly. Here's what needs to be fixed:

### Fix ShopOrders.vue

Find the `deleteOrder` function (around line 404) and make sure the email code is AFTER the closing brace:

```typescript
async function deleteOrder() {
  if (!selected.value) return
  if (!canEditOrder(selected.value)) return

  const orderIdToDelete = selected.value.id
  const confirmed = confirm(`Delete order #${orderIdToDelete.slice(-6).toUpperCase()}?`)
  if (!confirmed) return

  err.value = ''
  try {
    await deleteDoc(doc(db, 'shopOrders', orderIdToDelete))
    orders.value = orders.value.filter(o => o.id !== orderIdToDelete)
    selectedId.value = null
    err.value = ''
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to delete order'
    toastRef.value?.show('Failed to delete order', 'error')
  }
}

// Email functionality - should be HERE, not inside deleteOrder
const showEmailModal = ref(false)
const emailRecipients = ref('')
const sendingEmail = ref(false)

function openEmailModal() {
  if (!selected.value) return
  showEmailModal.value = true
  emailRecipients.value = ''
}

async function sendEmail() {
  if (!selected.value) return
  
  const emails = emailRecipients.value
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0)

  if (emails.length === 0) {
    toastRef.value?.show('Please enter at least one email address', 'error')
    return
  }

  sendingEmail.value = true
  try {
    await sendShopOrderEmail(selected.value.id, emails)
    toastRef.value?.show('Shop order emailed successfully!', 'success')
    showEmailModal.value = false
    emailRecipients.value = ''
  } catch (e: any) {
    toastRef.value?.show(e?.message || 'Failed to send email', 'error')
  } finally {
    sendingEmail.value = false
  }
}
```

## How It Works

### Daily Logs - Manual Email on Submit
1. User fills out a daily log for today's date
2. User clicks "Submit Daily Log" button
3. System automatically emails the log to all configured recipients:
   - **Hardcoded emails** (defined in `DailyLogs.vue` - `HARDCODED_EMAILS` array)
   - **Job-specific emails** (managed in the "Email Recipients" section)
4. Success/failure notification shown to user

**Note:** Daily logs must be submitted manually by users. There is no automatic submission of old drafts.
- Users can view any past daily log (draft or submitted)
- Past drafts are read-only and show a warning banner
- Date picker allows selecting any date
- Only today's drafts can be edited

### Managing Email Recipients
1. Open any job's Daily Logs page
2. Scroll to "Email Recipients" card at the bottom
3. Add new recipients:
   - Enter email address
   - Click "Add" or press Enter
4. Remove recipients:
   - Click the X button next to any custom recipient
   - Hardcoded recipients (with lock icon) cannot be removed
5. Recipients persist across all daily logs for that job

### Hardcoded Recipients
To add company-wide recipients that always receive daily logs:
1. Open `src/views/DailyLogs.vue`
2. Find the `HARDCODED_EMAILS` array (around line 43)
3. Add your emails:
```typescript
const HARDCODED_EMAILS = [
  'office@yourcompany.com',
  'manager@yourcompany.com',
]
```

## Testing

### Test Automatic Email Sending
1. Configure email credentials (see steps below)
2. Deploy functions: `firebase deploy --only functions`
3. Open Daily Logs for any job
4. Add a test recipient email in the "Email Recipients" section
5. Fill out the daily log
6. Click "Submit Daily Log"
7. Check for success message and verify email received

### Test Email

### "Failed to send email" error
- Check Firebase Functions logs: `firebase functions:log`
- Verify email credentials are set correctly
- Check Gmail "Less secure app access" settings if using Gmail

### "Authentication failed" error
- Make sure you're using an App-Specific Password, not your regular password
- Verify 2FA is enabled on your Google account

### Emails not arriving
- Check spam folder
- Verify the sender email address is correct
- Test with a simple email first

## Cost Considerations

- Firebase Functions: First 2M invocations/month are free
- Email sending: Free with Gmail (limited), paid with SendGrid/SES
- Consider implementing rate limiting for production use

## Security Notes

1. **Never commit email credentials to Git**
2. Use Firebase Functions config or environment variables
3. Consider adding rate limiting to prevent abuse
4. Validate email addresses on the server side
5. Add authentication checks (already implemented)

## Future Enhancements

1. **PDF Attachments**: Generate PDF versions of documents
2. **Email Templates**: Use proper HTML email templates
3. **Scheduled Emails**: Auto-send weekly timecards
4. **Email History**: Track which emails were sent
5. **Recipient Groups**: Save common recipient lists
6. **Email Verification**: Verify recipient email addresses before sending
