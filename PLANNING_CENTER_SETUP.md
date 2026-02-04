# Planning Center Integration Setup Guide

This guide walks you through setting up the Planning Center Services integration for automatic playlist synchronization using Personal Access Tokens.

## Overview

This integration allows premium users to:
- Connect their Planning Center account using a Personal Access Token
- Link it to an organization they own/admin
- Automatically create playlists when they create services in Planning Center
- Auto-sync when songs are added or removed from services

## Prerequisites

- Firebase project with Firestore and Cloud Functions enabled
- Planning Center account with Services access
- Premium subscription feature implemented in your app

## Step 1: Generate Encryption Key

You'll need an encryption key to securely store Personal Access Tokens:

```bash
# Generate a random 32-character encryption key
openssl rand -base64 32
```

Save this key - you'll need it in Step 3.

## Step 2: Install Dependencies

From the `functions` directory:

```bash
cd functions
npm install
```

The required dependencies are already in `package.json`:
- `firebase-functions` & `firebase-admin` - Cloud Functions
- `axios` - HTTP requests to Planning Center API
- `crypto` - Token encryption

## Step 3: Configure Environment Variables

Set the encryption key in Firebase Functions config:

```bash
firebase functions:config:set \
  planning_center.encryption_key="YOUR_GENERATED_KEY_FROM_STEP_1"
```

Or manually in Firebase Console:
- Go to Firebase Console → Functions → Configuration
- Add: `planning_center.encryption_key` with your generated key

## Step 4: Deploy Cloud Functions

```bash
# Build the functions
cd functions
npm run build

# Deploy to Firebase
firebase deploy --only functions
```

This will deploy:
- `connectPlanningCenter` - Verifies and stores Personal Access Tokens
- `planningCenterWebhook` - Receives Planning Center webhooks and syncs playlists

## Step 5: Configure Planning Center Webhooks

1. Log in to Planning Center
2. Go to **Settings → Webhooks**
3. Click **"Create Webhook"**
4. Set the **Endpoint URL** to:
   ```
   https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/planningCenterWebhook
   ```
   Replace with your actual Firebase project info (e.g., `us-central1-psalms-and-hymns-85ee4`)

5. Subscribe to these events:
   - `services.v2.events.plan.created`
   - `services.v2.events.item.created`
   - `services.v2.events.item.destroyed`
   - `services.v2.events.item.updated`

6. **Save** the webhook

## Step 6: Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

The rules include:
- `planning_center_connections` - User-level PC connections (encrypted tokens)
- `pc_service_mappings` - Tracks PC service → playlist mappings
- `_cache` - Hymnal data caching for performance

## Step 7: User Setup Instructions

### For End Users:

1. **Upgrade to Premium** (required for this feature)

2. **Create a Personal Access Token in Planning Center:**
   - Go to Planning Center → Account Settings
   - Click **"Personal Access Tokens"**
   - Click **"Create New Token"**
   - Give it a name (e.g., "Psalms & Hymns Sync")
   - Select scope: **Services**
   - Click **"Create Token"**
   - **Copy the token** (you won't see it again!)

3. **Create or Admin an Organization in the app:**
   - Open the app → Playlist → Orgs tab
   - Create a new organization (or be an admin of one)

4. **Connect Planning Center:**
   - Click **"Planning Center Sync"** button in Orgs tab
   - Paste your Personal Access Token
   - Click **"Connect Planning Center"**

5. **Link to Organization:**
   - Select which organization should receive auto-synced playlists
   - Click **"Link Organization"**

6. **Create a Service in Planning Center:**
   - Go to Planning Center Services
   - Create a new service plan
   - Add hymns using numbers in titles (e.g., "123 Amazing Grace", "Psalm 23", "Hymn 100")

7. **Verify Auto-Sync:**
   - Go back to your app
   - Navigate to Playlist → Orgs → [Your Organization]
   - You should see a new playlist with the matched hymns! 🎉

## How Song Matching Works

The integration uses a multi-strategy matching algorithm:

1. **Hymn Number Extraction**: Finds numbers in song titles (#123, Hymn 123, Psalm 23, etc.)
2. **Exact Title Match**: Normalized title comparison (case-insensitive, punctuation removed)
3. **Tune Name Match**: If Planning Center song includes arrangement/tune information
4. **Fuzzy Matching**: High-confidence fuzzy string matching as fallback (>85% similarity)

**Unmatched songs are skipped** to ensure only valid hymns appear in playlists.

### Best Practices for Song Titles in Planning Center:

- ✅ "**123** Amazing Grace" 
- ✅ "Psalm **23**"
- ✅ "Hymn **100** - All People That on Earth"
- ✅ "**19A** I Love the Lord"
- ❌ "Amazing Grace" (no number - won't match unless exact title match)

## Troubleshooting

### Connection Fails
- **Check token**: Ensure you copied the entire token from Planning Center
- **Check scope**: Token must have "Services" scope enabled
- **Check logs**: `firebase functions:log --only connectPlanningCenter`

### Webhooks Not Working
- **Verify endpoint URL**: Must match your actual Cloud Functions URL
- **Check deployment**: `firebase functions:list`
- **View webhook logs**: Planning Center Settings → Webhooks → View Delivery Logs
- **Check function logs**: `firebase functions:log --only planningCenterWebhook`

### Songs Not Matching
- **Include hymn numbers** in Planning Center song titles
- **Use formats**: "123 Title", "Hymn 123", "Psalm 23", etc.
- **Check function logs** to see matching attempts and failures
- **Verify hymnal data**: Ensure `song_metadata` collection is populated

### No Playlist Created
- **Check token hasn't expired**: Personal Access Tokens don't auto-expire, but can be revoked
- **Verify organization link**: Must link PC connection to an organization first
- **Check premium status**: Feature requires active premium subscription
- **View logs**: `firebase functions:log` for any errors

## Security Considerations

✅ **Personal Access Tokens are encrypted** using AES-256 encryption before storage  
✅ **Premium-only feature** enforced in Firestore security rules  
✅ **User-scoped access**: Users can only connect/disconnect their own PC account  
✅ **Admin-only org linking**: Only organization admins can link PC to organizations  
✅ **Tokens stored server-side**: Never exposed to client code  

### Additional Security (Optional):

- Implement webhook signature verification in `webhook.ts`
- Rotate encryption keys periodically
- Add token expiration checks (even though PATs don't expire)
- Implement rate limiting on webhook function

## Cost Estimation

**Firebase Functions:**
- `connectPlanningCenter`: ~1 invocation per user connection
- `planningCenterWebhook`: ~1-5 invocations per service (depending on changes)

**Planning Center API:**
- Rate limit: 100 requests per 20 seconds
- Typical usage per service sync: 2-3 API calls

**Estimated Monthly Cost for 100 Active Users:**
- ~100 connections (one-time)
- ~400 services created (4 per user)
- ~2,000 webhook events (item additions/changes)
- ~2,500 function invocations
- ~1,500 Planning Center API calls
- **Total: < $1/month** (well within Firebase free tier)

## Advantages of Personal Access Tokens vs OAuth

✅ **Much simpler setup** - No OAuth application registration  
✅ **No redirect URIs** to configure  
✅ **No token refresh** complexity  
✅ **User controls** revocation directly in Planning Center  
✅ **Fewer moving parts** = less to break  
✅ **Better for personal/organizational** use cases  

## Future Enhancements

- [ ] Webhook signature verification for enhanced security
- [ ] Manual song mapping UI for unmatched songs
- [ ] Sync service date/time information
- [ ] Support for multiple service types
- [ ] Bulk sync for existing services
- [ ] Custom playlist naming templates
- [ ] Notification when songs don't match

## FAQ

**Q: What if I revoke my Personal Access Token?**  
A: The sync will stop working. Simply generate a new token and reconnect in the app.

**Q: Can I connect multiple Planning Center accounts?**  
A: Not currently - each user can connect one PC account. You can disconnect and reconnect a different account.

**Q: Will this work with Planning Center Teams or Groups?**  
A: No, this integration is specifically for Planning Center **Services**. Other modules would require separate integration.

**Q: What happens to existing playlists if I disconnect?**  
A: They remain in your organization. They just won't auto-update anymore.

**Q: Can I edit auto-synced playlists?**  
A: Currently they auto-rebuild on changes. Future  versions may support manual edits with merge strategies.

## Support

If you encounter issues:
1. Check Firebase Functions logs: `firebase functions:log`
2. Verify Planning Center webhook delivery logs
3. Ensure user has active premium subscription
4. Confirm Firestore rules are deployed
5. Check that organization is properly linked

**Planning Center API Documentation:**  
https://developer.planning.center/docs/

**Firebase Functions Documentation:**  
https://firebase.google.com/docs/functions
