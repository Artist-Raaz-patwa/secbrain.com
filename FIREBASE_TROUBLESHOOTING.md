# Firebase Authentication Troubleshooting Guide

## 🔥 Firebase: Error (auth/internal-error) - Complete Fix Guide

The `auth/internal-error` is a generic Firebase error that can have several causes. Follow this step-by-step guide to resolve it.

## 🚨 Quick Diagnosis

### Step 1: Check Browser Console
1. Open your app in the browser
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Look for detailed error messages and debug information

### Step 2: Verify Firebase Console Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **secbrain-ad48a**
3. Check the following sections:

## 🔧 Firebase Console Configuration

### 1. Authentication Setup
**Path:** Authentication → Sign-in method

**Required Actions:**
- ✅ Enable **Google** as a sign-in provider
- ✅ Configure OAuth consent screen
- ✅ Add your domain to authorized domains

**Step-by-step:**
1. Click on **Google** provider
2. Toggle **Enable** to ON
3. Add your **Project support email**
4. Click **Save**

### 2. Authorized Domains
**Path:** Authentication → Settings → Authorized domains

**Required Domains:**
- `localhost` (for development)
- `127.0.0.1` (alternative localhost)
- Your production domain (when deployed)

**Step-by-step:**
1. Go to Authentication → Settings
2. Scroll to **Authorized domains**
3. Click **Add domain**
4. Add `localhost`
5. Add `127.0.0.1`
6. Click **Done**

### 3. Project Configuration
**Path:** Project Settings → General

**Verify:**
- Project ID: `secbrain-ad48a`
- Web API Key: `AIzaSyCXvUh0c2mgeNQYtAuOo_uRxX0sNWR-LGI`
- Auth Domain: `secbrain-ad48a.firebaseapp.com`

## 🌐 Environment Setup

### Running the App Correctly
Firebase requires HTTP/HTTPS protocol. **DO NOT** open `index.html` directly in the browser.

**Correct Methods:**
1. **Using the provided script:**
   ```bash
   # Double-click this file:
   start-server.bat
   ```

2. **Using Node.js http-server:**
   ```bash
   npx http-server -p 8000 -o
   ```

3. **Using Python:**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```

4. **Using Live Server (VS Code extension):**
   - Install "Live Server" extension
   - Right-click on `index.html`
   - Select "Open with Live Server"

## 🔍 Common Causes & Solutions

### Cause 1: Google Provider Not Enabled
**Error:** `auth/operation-not-allowed`
**Solution:**
1. Firebase Console → Authentication → Sign-in method
2. Enable Google provider
3. Configure OAuth consent screen

### Cause 2: Domain Not Authorized
**Error:** `auth/unauthorized-domain`
**Solution:**
1. Firebase Console → Authentication → Settings
2. Add your domain to authorized domains
3. For development: add `localhost` and `127.0.0.1`

### Cause 3: Running on File Protocol
**Error:** `auth/internal-error` or popup blocked
**Solution:**
- Use HTTP server (see Environment Setup above)
- Never open `index.html` directly

### Cause 4: Outdated Firebase SDK
**Error:** Various compatibility issues
**Solution:**
- Updated to Firebase SDK v10.13.0 (latest)
- Check `index.html` for correct CDN links

### Cause 5: Browser Popup Blocked
**Error:** `auth/popup-blocked`
**Solution:**
1. Allow popups for your domain
2. Check browser popup settings
3. Try in incognito/private mode

### Cause 6: Network/Firewall Issues
**Error:** `auth/network-request-failed`
**Solution:**
1. Check internet connection
2. Disable VPN/proxy temporarily
3. Check firewall settings
4. Try different network

## 🛠️ Advanced Troubleshooting

### Check Firebase Project Status
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Verify project is active and not suspended
3. Check billing status (if applicable)

### Verify API Key Permissions
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `secbrain-ad48a`
3. Go to APIs & Services → Credentials
4. Verify API key restrictions

### Test Firebase Connection
Add this to your browser console to test:
```javascript
// Test Firebase connection
console.log('Firebase loaded:', typeof firebase !== 'undefined');
console.log('Auth available:', typeof firebase.auth !== 'undefined');
console.log('Config loaded:', window.FirebaseConfig ? 'Yes' : 'No');
```

### Clear Browser Data
1. Clear browser cache and cookies
2. Clear localStorage and sessionStorage
3. Try in incognito/private mode

## 📱 Testing Checklist

### Before Testing:
- [ ] Firebase Console: Google provider enabled
- [ ] Firebase Console: Domain authorized (localhost)
- [ ] Running on HTTP server (not file://)
- [ ] Latest Firebase SDK loaded
- [ ] Browser allows popups

### During Testing:
- [ ] Check browser console for errors
- [ ] Verify popup opens correctly
- [ ] Check network tab for failed requests
- [ ] Test with different browsers

### After Testing:
- [ ] User successfully signed in
- [ ] User data appears in Firebase Console
- [ ] App shows authenticated state
- [ ] No console errors

## 🆘 Still Having Issues?

### Debug Information
When you encounter the error, check the browser console for:
1. **Detailed error message**
2. **Error code** (e.g., `auth/internal-error`)
3. **Debug information** (automatically logged)
4. **Network requests** (check if Firebase APIs are reachable)

### Contact Information
If the issue persists:
1. Check the browser console for detailed error logs
2. Verify all Firebase Console settings
3. Test with a fresh browser profile
4. Try different browsers/devices

### Emergency Fallback
If Firebase continues to fail:
1. The app will automatically switch to offline mode
2. You can still use all features locally
3. Data will sync when Firebase is working again

## 🎯 Success Indicators

You'll know the fix worked when:
- ✅ No console errors
- ✅ Google sign-in popup opens
- ✅ User successfully authenticates
- ✅ App shows authenticated state
- ✅ User data syncs to Firebase

---

**Last Updated:** December 2024  
**Firebase SDK Version:** 10.13.0  
**Project:** secbrain-ad48a
