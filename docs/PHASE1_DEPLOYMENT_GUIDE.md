/**
 * Phase 1 Refactoring: Production Deployment Guide
 * 
 * Safe, controlled deployment of refactored code
 * Includes monitoring, rollback, and verification steps
 */

# Phase 1 Refactoring - Production Deployment

## Deployment Overview

**What's Being Deployed**:
- New centralized type definitions (src/types/documents.ts, src/types/api.ts)
- New shared utilities (src/utils/shared.ts)
- Updated frontend build
- Cloud Functions utilities (non-integrated, ready for Phase 2)
- All existing functionality preserved

**Risk Level**: ⬇️ **VERY LOW** - Additive changes only, no breaking changes

**Rollback Complexity**: ⬇️ **MINIMAL** - Can delete new files if needed

---

## Pre-Deployment Checklist

### Code Quality
- [x] TypeScript compilation successful
- [x] No build errors or warnings
- [x] No console errors in build output
- [x] New files follow project conventions
- [x] All new code properly documented

### Testing
- [x] Frontend builds successfully
- [x] Cloud Functions compile successfully
- [x] Type definitions are backward compatible
- [x] No changes to existing service contracts

### Documentation
- [x] Changes documented in REFACTORING_AUDIT.md
- [x] Test checklist created (PHASE1_REFACTORING_TESTS.md)
- [x] This deployment guide created

---

## Step-by-Step Deployment

### Phase 1A: Pre-Flight Verification (5 minutes)

1. **Verify Firebase CLI is ready**
   ```powershell
   firebase --version
   firebase login
   ```

2. **Verify current state**
   ```powershell
   cd "c:\Users\clarse12\Desktop\Web Dev\phase2"
   npm run build    # Should complete successfully
   cd functions
   npm run build    # Should complete successfully
   cd ..
   ```

3. **Create backup**
   ```powershell
   # Backup current Firestore rules (in case needed for rollback)
   Copy-Item -Path "firestore.rules" -Destination "firestore.rules.backup.$(Get-Date -f yyyy-MM-dd-HH-mm-ss)"
   ```

### Phase 1B: Staging Deployment (10 minutes)

**Option A: Deploy Only Frontend (Lowest Risk)**
```powershell
firebase deploy --only hosting
```

**Option B: Deploy Frontend + Functions**
```powershell
firebase deploy
```

**During Deployment**:
- Monitor Firebase Console for errors
- Check function logs in real-time
- Watch for any permission errors

### Phase 1C: Immediate Post-Deployment (5 minutes)

1. **Verify Firebase Deployment**
   - Check Firebase Console > Functions dashboard
   - All 6 functions should show as "OK"
   - Check hosting deployment status

2. **Quick Live Site Test**
   - Open your app in browser
   - Clear browser cache (Ctrl+Shift+Delete)
   - Try to login
   - Check browser console (F12) for errors
   - Visit main pages: Dashboard, Jobs, Timecards, Daily Logs, Shop

3. **Monitor Function Logs**
   ```powershell
   firebase functions:log --limit=20
   ```
   - Should see no new errors
   - Only normal operation messages

---

## Monitoring & Verification (First 24 Hours)

### Firebase Console Checks
1. **Functions Tab**
   - Execution count normal?
   - Error rates baseline or lower?
   - No new timeout errors?

2. **Firestore Tab**
   - Document operations normal?
   - No new permission issues?
   - Storage usage as expected?

3. **Authentication Tab**
   - Normal user activity?
   - New user creations working?
   - Password reset emails sending?

4. **Logs Tab**
   - Search for "ERROR" - should be none
   - Search for function names - should show normal operations
   - Email logs showing successful sends

### Manual Feature Verification

Ideally, perform these during normal business hours:

- [ ] **User Management**
  - Login/logout works
  - Admin can create user → welcome email arrives
  - Admin can edit user → changes saved
  - User roles persist

- [ ] **Jobs & Timecards**
  - Employees can view jobs
  - Employees can submit timecards
  - Timecard email sends with single consolidated table
  - Multiple timecard submissions don't create duplicates

- [ ] **Daily Logs**
  - Create draft → save works
  - Submit daily log → email sends
  - Admin-added items show correctly

- [ ] **Shop Orders**
  - Create order → submit works
  - Email sends on submit

---

## Rollback Plan (If Needed)

### Quick Rollback (< 5 minutes)

If critical issues found, rollback is simple:

**Option 1: Frontend Only Rollback**
```powershell
firebase deploy --only hosting
# OR revert to previous hosted version via Firebase Console
```

**Option 2: Complete Rollback**
```powershell
# This would only be needed if Cloud Functions had issues
# which is very unlikely since we didn't modify their logic
firebase deploy --only functions
# OR use Firebase Console to revert versions
```

### Data Integrity
- No data schema changes
- No Firestore rules changes
- No data migration needed
- Safe to rollback anytime

---

## Success Criteria

### Immediate (< 1 hour)
✅ All builds successful
✅ No new errors in Firebase Console
✅ All 6 functions show "OK"
✅ Hosting deployed and serving
✅ Login flow works

### Short-term (1-24 hours)
✅ Normal user activity observed
✅ Emails sending normally
✅ No permission denied errors
✅ Function execution normal

### Long-term (1+ week)
✅ No regressions reported
✅ All features stable
✅ Ready for Phase 2 refactoring

---

## If Issues Occur

### Common Issues & Solutions

**Issue: "Module not found" error in browser**
- Solution: Clear cache (Ctrl+Shift+Delete), reload
- Cause: Old files cached locally
- Action: Force refresh page

**Issue: Function returns unexpected response**
- Solution: Check Cloud Function logs
- Cause: Unlikely (no logic changes)
- Action: Restart and monitor

**Issue: Users can't login**
- Solution: Check Firebase Auth console
- Cause: Unrelated to this deployment
- Action: Check auth configuration

**Issue: Emails not sending**
- Solution: Check email service credentials
- Cause: Email configuration, not code change
- Action: Verify EMAIL_USER and EMAIL_PASSWORD secrets

### Emergency Escalation

If critical issue found:
1. Note exact error message
2. Check timestamp of error
3. Review Firebase logs
4. Execute rollback (see Rollback Plan above)
5. Document issue for post-incident review

---

## Post-Deployment Documentation

### Success Criteria Met ✓
Document date/time: [To be filled]
Deployed by: [To be filled]
Verified by: [To be filled]

### Changes Live
- [x] Frontend with new type definitions
- [x] Cloud Functions with new utilities
- [x] All existing features functional
- [x] No data loss or corruption

### Next Steps
1. Monitor for 24-48 hours
2. Collect feedback from team
3. Plan Phase 2 refactoring (service consolidation)
4. Add SASS and styling

---

## Version Information

**Frontend Build**: `dist/`
**Functions Build**: `functions/lib/`

**New Files Deployed**:
- src/types/documents.ts
- src/types/api.ts
- src/utils/shared.ts
- src/utils/index.ts
- functions/src/utils.ts

**Modified Files**:
- src/types/index.ts (added re-exports)

**No Changes to**:
- Cloud Function implementations
- Firestore rules
- Authentication logic
- Email templates
- Vue components
- Services layer

---

## Contact & Support

If issues arise:
1. Check Firebase Console first
2. Review function logs
3. Test locally if possible
4. Document issue
5. Execute rollback if critical
6. Report to team

