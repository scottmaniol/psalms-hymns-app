# Planning Center Integration - Next Steps

## ⚡ Quick Start (15 minutes)

### 1. Generate Encryption Key (30 seconds)
```bash
openssl rand -base64 32
```
**Copy the output** - you'll need it in step 3.

### 2. Install Dependencies (2 minutes)
```bash
cd functions
npm install
```

### 3. Configure Firebase (1 minute)
```bash
# Replace YOUR_KEY with the key from step 1
firebase functions:config:set planning_center.encryption_key="YOUR_KEY"
```

### 4. Build & Deploy (5 minutes)
```bash
# Still in functions directory
npm run build

# Deploy functions and rules
cd ..
firebase deploy --only functions,firestore:rules
```

You should see:
- ✅ Function `connectPlanningCenter` deployed
- ✅ Function `planningCenterWebhook` deployed
- ✅ Firestore rules updated

### 5. Get Your Webhook URL (30 seconds)
After deployment completes, you'll see URLs like:
```
https://us-central1-YOUR-PROJECT.cloudfunctions.net/planningCenterWebhook
```
**Copy this URL** - you need it for step 6.

### 6. Configure Planning Center Webhook (3 minutes)

1. Go to https://api.planningcenteronline.com/webhooks
2. Click **"Create Webhook"**
3. Paste your webhook URL from step 5
4. Subscribe to these 4 events:
   - `services.v2.events.plan.created`
   - `services.v2.events.item.created`
   - `services.v2.events.item.destroyed`
   - `services.v2.events.item.updated`
5. Click **Save**

### 7. Test It! (5 minutes)

**In your app:**
1. Log in as a premium user
2. Go to Playlist → Orgs tab
3. Create a new organization (e.g., "Test Choir")
4. Click **"Planning Center Sync"** button

**In Planning Center:**
1. Go to https://api.planningcenteronline.com/oauth/applications
2. Click **"Personal Access Tokens"**
3. Click **"Create New Token"**
4. Name: "Psalms & Hymns Test"
5. Scope: **Services**
6. Click **Create** and **copy the token**

**Back in your app:**
1. Paste the token
2. Click **"Connect Planning Center"**
3. Select your test organization
4. Click **"Link Organization"**

**Test the sync:**
1. Go to Planning Center Services
2. Create a new plan/service
3. Add a song with a number in the title: "**123** I'll Praise My Maker"
4. Go back to your app → Playlist → Orgs → Test Choir
5. **You should see a new playlist with Hymn 123!** 🎉

---

## 🔧 If Something Goes Wrong

### Check Function Logs
```bash
firebase functions:log
```

### Verify Functions Deployed
```bash
firebase functions:list
```

### Check Webhook Deliveries
- Go to Planning Center → Settings → Webhooks
- Click on your webhook
- View "Recent Deliveries"
- Should see 200 OK responses

### Common Issues

**"Permission denied" when connecting:**
- Run: `firebase deploy --only firestore:rules`

**Webhook returns 500 error:**
- Check: `firebase functions:log --only planningCenterWebhook`
- Likely: Token encryption key not set

**No playlist created:**
- Verify organization is linked in Planning Center Settings
- Check that song titles include hymn numbers
- View logs: `firebase functions:log`

**Connection fails:**
- Ensure token has "Services" scope
- Copy entire token (no extra spaces)
- Token must be from account that has access to services

---

## 📋 Deployment Checklist

- [ ] Dependencies installed (`npm install` in functions/)
- [ ] Encryption key generated and configured
- [ ] Functions built (`npm run build`)
- [ ] Functions deployed successfully
- [ ] Firestore rules deployed
- [ ] Planning Center webhook configured
- [ ] Webhook URL correct
- [ ] All 4 event types subscribed
- [ ] Test organization created in app
- [ ] Personal Access Token generated in Planning Center
- [ ] Token has "Services" scope
- [ ] Successfully connected in app
- [ ] Organization linked
- [ ] Test service created
- [ ] Playlist auto-generated ✨

---

## 🚀 Production Rollout

Once testing works:

1. **Announce the feature** to premium users
2. **Provide instructions** (see PLANNING_CENTER_SETUP.md)
3. **Monitor logs** initially: `firebase functions:log --follow`
4. **Watch costs**: Should be < $1/month even with heavy usage

---

## 📚 Documentation

- **Setup Guide**: `PLANNING_CENTER_SETUP.md` - Complete setup instructions
- **This File**: Quick start guide
- **Inline Docs**: All functions have JSDoc comments

---

## 💡 Tips

- **Best song title format in Planning Center**: "123 Song Title"
- **Webhook is real-time**: Changes appear instantly
- **Tokens don't expire**: But users can revoke them anytime
- **Cost efficient**: < $1/month for 100+ users
- **Fail-safe**: Unmatched songs are skipped (won't break playlists)

---

## 🎯 Success Metrics to Watch

- Number of PC connections created
- Playlists auto-synced per week
- Song match rate (check logs)
- Webhook success rate (Planning Center dashboard)
- User feedback on feature

---

Ready to deploy? Start with **Step 1** above! 🚀
