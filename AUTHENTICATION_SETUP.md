# Authentication Setup Guide for GW-Flasher

## Overview

This guide will help you set up secure authentication for your GW-Flasher GitHub Pages site with:
- ✅ Username/Password protection
- ✅ Two-Factor Authentication (TOTP/2FA)
- ✅ Session management
- ✅ Modern, responsive login UI

## Important Security Notes

⚠️ **This is client-side authentication** which means:
- It's suitable for basic access control and casual protection
- **NOT suitable for highly sensitive or production systems**
- Credentials are stored in the JavaScript file (obfuscation possible but not foolproof)
- For enterprise-grade security, you need a backend service

✅ **What it DOES protect:**
- Casual users from accessing the flasher
- Unauthorized firmware flashing
- Provides 2FA for additional security layer

---

## Step 1: Configure Credentials

### 1.1 Set Username and Password

1. **Open the auth configuration file:**
   ```
   js/auth.js
   ```

2. **Find the AUTH_CONFIG object** (around line 2):
   ```javascript
   const AUTH_CONFIG = {
       username: 'admin',           // ← CHANGE THIS
       password: 'changeme123',     // ← CHANGE THIS
       totpSecret: 'JBSWY3DPEHPK3PXP', // ← CHANGE THIS (see Step 2)
       ...
   };
   ```

3. **Change the default credentials:**
   ```javascript
   const AUTH_CONFIG = {
       username: 'your_username',      // Your custom username
       password: 'your_secure_password', // Strong password (min 12 chars)
       ...
   };
   ```

### 1.2 Generate Strong Password

Use a strong password with:
- At least 12 characters
- Mix of uppercase, lowercase, numbers, and symbols
- Example: `SecureP@ss2024!GW`

---

## Step 2: Setup Two-Factor Authentication (TOTP)

### 2.1 Generate TOTP Secret

1. **Go to TOTP Secret Generator:**
   - Visit: https://www.authenticator.cc/
   - Or use: https://stefansundin.github.io/2fa-qr/
   - Or generate with command line:
     ```bash
     node -e "console.log(require('crypto').randomBytes(20).toString('base32'))"
     ```

2. **Generate a new secret:**
   - Click "Generate Secret" or similar button
   - Copy the **Base32 Secret** (e.g., `JBSWY3DPEHPK3PXP`)
   - Keep this **SECRET** - anyone with it can generate codes!

### 2.2 Add Secret to Config

1. **Open** `js/auth.js`

2. **Replace the TOTP secret:**
   ```javascript
   const AUTH_CONFIG = {
       username: 'your_username',
       password: 'your_secure_password',
       totpSecret: 'YOUR_GENERATED_SECRET_HERE', // ← Paste your secret here
       ...
   };
   ```

### 2.3 Setup Authenticator App

1. **Download an authenticator app on your phone:**
   - Google Authenticator (iOS/Android)
   - Microsoft Authenticator (iOS/Android)
   - Authy (iOS/Android)
   - 1Password (if you use it)

2. **Add the account:**
   - Open your authenticator app
   - Tap "Add account" or "+" button
   - Choose "Enter a setup key" or "Manual entry"

3. **Enter these details:**
   - **Account name:** GW Flasher
   - **Your name/email:** your-email@example.com
   - **Key:** Your TOTP secret (e.g., `JBSWY3DPEHPK3PXP`)
   - **Time-based:** Yes
   - **Algorithm:** SHA1
   - **Digits:** 6

4. **Save**
   - Your app will now show 6-digit codes that change every 30 seconds

### 2.4 Test TOTP (Before Deploying!)

1. **Open** `auth.html` **locally in browser**
2. **Login with username/password**
3. **Enter the 6-digit code from your authenticator app**
4. **If it works → Great! If not → Double-check the secret**

### 2.5 Disable 2FA (Optional)

If you don't want 2FA:
```javascript
const AUTH_CONFIG = {
    username: 'your_username',
    password: 'your_secure_password',
    totpSecret: '', // ← Leave empty to disable 2FA
    ...
};
```

---

## Step 3: Update GitHub Pages Workflow

The workflow needs to include the new files.

### 3.1 Check pages.yml Workflow

1. **Open** `.github/workflows/pages.yml`

2. **Verify it includes auth files:**
   ```yaml
   - name: Prepare site files
     run: |
       rm -rf site
       mkdir -p site
       cp index.html auth.html site/           # ← auth.html added
       cp -R css js firmware static site/       # ← js folder includes auth files
   ```

3. **If not included, update it to:**
   ```yaml
   - name: Prepare site files
     run: |
       rm -rf site
       mkdir -p site
       cp index.html auth.html site/
       cp -R css js firmware static site/
   ```

---

## Step 4: Deploy and Test

### 4.1 Commit and Push Changes

```bash
cd GW-Flasher

# Add all authentication files
git add auth.html js/auth.js js/auth-check.js index.html .github/workflows/pages.yml

# Commit
git commit -m "Add authentication with TOTP 2FA support"

# Push to GitHub
git push origin main
```

### 4.2 Wait for GitHub Pages Deployment

1. **Go to GitHub Actions:**
   - Visit: `https://github.com/aayushnaphade/GW_Flasher/actions`

2. **Wait for "Deploy GitHub Pages" workflow to complete**
   - Should take 1-2 minutes
   - Green checkmark = success

3. **Check GitHub Pages URL:**
   - Go to: Settings → Pages
   - Copy the URL (e.g., `https://aayushnaphade.github.io/GW_Flasher/`)

### 4.3 Test Authentication

1. **Open your GitHub Pages URL**
   - You should see the login page immediately
   - If you see the flasher directly, clear your browser cache

2. **Test login flow:**
   - Enter username and password
   - Enter 6-digit TOTP code from your authenticator app
   - You should be redirected to the flasher

3. **Test session:**
   - Close the tab
   - Open the URL again
   - You should still be logged in (session lasts 24 hours)

4. **Test logout:**
   - Click the "Logout" button in the top-right corner
   - You should be redirected to login page

---

## Step 5: Security Best Practices

### 5.1 Credential Storage

⚠️ **The credentials are in plain JavaScript**

**To add basic obfuscation:**

1. **Use environment variables in build step** (requires build process)
2. **Use a simple encoding** (example below)

**Simple Base64 encoding example:**
```javascript
// In js/auth.js
const AUTH_CONFIG = {
    // Base64 encoded credentials
    username: atob('eW91cl91c2VybmFtZQ=='), // decoded: your_username
    password: atob('eW91cl9wYXNzd29yZA=='), // decoded: your_password
    totpSecret: atob('WU9VUl9TRUNSRVRfSEVSRQ=='), // decoded: YOUR_SECRET_HERE
    ...
};
```

To encode your credentials:
```javascript
// In browser console
btoa('your_username')  // Copy result
btoa('your_password')  // Copy result
btoa('YOUR_SECRET')    // Copy result
```

### 5.2 Session Security

Current settings:
- Session duration: 24 hours
- Stored in both sessionStorage (deleted when tab closes) and localStorage (persists)

**To make sessions more secure:**
```javascript
// In js/auth.js, change:
sessionDuration: 2 * 60 * 60 * 1000,  // 2 hours instead of 24
```

### 5.3 HTTPS Only

✅ GitHub Pages automatically uses HTTPS
✅ Web Serial API requires HTTPS (so you're forced to be secure)

---

## Step 6: Advanced - GitHub OAuth (Optional)

For GitHub-based authentication (requires backend):

### 6.1 Create GitHub OAuth App

1. **Go to GitHub Settings:**
   - https://github.com/settings/developers

2. **Click "New OAuth App"**

3. **Fill in details:**
   - Application name: `GW Flasher`
   - Homepage URL: `https://aayushnaphade.github.io/GW_Flasher/`
   - Authorization callback URL: `https://aayushnaphade.github.io/GW_Flasher/oauth-callback.html`

4. **Copy Client ID**

5. **Generate Client Secret** (keep it secret!)

### 6.2 Setup Backend (Required)

GitHub OAuth requires a backend to exchange the authorization code for an access token. Options:
- **Cloudflare Workers** (free tier available)
- **Vercel Serverless Functions** (free tier)
- **AWS Lambda** (free tier)
- **Your own server**

### 6.3 Update Config

```javascript
const AUTH_CONFIG = {
    ...
    githubClientId: 'your_github_client_id',
};
```

⚠️ **This is advanced and requires additional backend setup**

---

## Troubleshooting

### "Authentication redirects in a loop"

**Solution:**
- Clear browser cache and cookies
- Check browser console for errors
- Verify auth.js and auth-check.js are loaded

### "2FA code always fails"

**Solution:**
- Double-check the TOTP secret in auth.js
- Ensure your phone's time is synced (Settings → Date & Time → Automatic)
- Try generating a new secret and re-adding to authenticator

### "Login works but flasher doesn't load"

**Solution:**
- Check browser console for errors
- Verify index.html includes auth-check.js script
- Check session storage in browser DevTools

### "Can't access login page after failed attempt"

**Solution:**
- Open browser DevTools (F12)
- Go to Application → Storage
- Clear sessionStorage and localStorage
- Refresh page

---

## Quick Reference

### Default Setup (No 2FA)
```javascript
const AUTH_CONFIG = {
    username: 'admin',
    password: 'your_password',
    totpSecret: '', // Empty = no 2FA
    sessionDuration: 24 * 60 * 60 * 1000,
};
```

### With 2FA
```javascript
const AUTH_CONFIG = {
    username: 'admin',
    password: 'your_password',
    totpSecret: 'JBSWY3DPEHPK3PXP', // Your secret
    sessionDuration: 24 * 60 * 60 * 1000,
};
```

### Testing Locally
```bash
# In GW-Flasher directory
python -m http.server 8000
# or
npx serve .

# Open: http://localhost:8000/auth.html
```

---

## Files Created

- ✅ `auth.html` - Login page UI
- ✅ `js/auth.js` - Authentication logic with TOTP
- ✅ `js/auth-check.js` - Session verification
- ✅ `AUTHENTICATION_SETUP.md` - This guide (you're reading it!)

---

## Support

If you need help:
1. Check browser console (F12) for errors
2. Review the Troubleshooting section
3. Test locally before deploying
4. Verify all files are committed and pushed

**Remember:** Change the default credentials before deploying!
