# API Keys Setup Guide

## Step 1: Get Ticketmaster API Key

1. Go to: https://developer.ticketmaster.com/
2. Click **"Sign Up"** (top right)
3. Create a free account with your email
4. Verify your email
5. Once logged in, go to **"My Apps"**
6. Click **"Create a New App"**
   - App Name: "Bristol Events"
   - Accept terms
   - Click **"Create App"**
7. Copy your **Consumer Key** (this is your API key)
8. Save it securely

**Note:** Free tier has 5,000 API calls/day - perfect for weekly updates

---

## Step 2: Get Eventbrite API Key

1. Go to: https://www.eventbrite.com/
2. Click **"Sign up"** (top right)
3. Create a free account
4. Go to: https://www.eventbrite.com/account-settings/apps
5. Click **"Create New App"**
   - App Name: "Bristol Events"
   - Accept terms
   - Click **"Create App"**
6. Copy your **Personal OAuth token** (this is your API key)
7. Save it securely

**Note:** Free tier has access to public events - no rate limit stated

---

## Step 3: Add Keys to GitHub

Once you have both keys:

1. Go to your GitHub repo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add three secrets:
   - **Name:** `TICKETMASTER_API_KEY` | **Value:** [paste key from step 1]
   - **Name:** `EVENTBRITE_API_KEY` | **Value:** [paste key from step 2]

5. Click **"Add secret"** for each

---

## Step 4: Testing

Once keys are added to GitHub, I'll:
- ✅ Make real API calls for Bristol events
- ✅ Verify data structure and accuracy
- ✅ Test deduplication logic
- ✅ Create unit tests
- ✅ Confirm everything works before deployment

---

## Timeline
- Getting keys: ~10 minutes
- Adding to GitHub: ~5 minutes
- My testing: ~15 minutes

**Ready to proceed?**
