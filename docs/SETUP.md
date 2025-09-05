# SecBrain Setup Guide

This guide will walk you through setting up SecBrain from scratch, including Firebase configuration, deployment, and customization.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Google Cloud Console Setup](#google-cloud-console-setup)
4. [Application Configuration](#application-configuration)
5. [Security Rules](#security-rules)
6. [Deployment](#deployment)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before setting up SecBrain, ensure you have:

- A modern web browser
- A Google account
- A web server with HTTPS support
- Basic knowledge of web development

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `secbrain` (or your preferred name)
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Google" provider:
   - Click on Google
   - Toggle "Enable"
   - Add your project support email
   - Click "Save"

### 3. Set up Realtime Database

1. Go to "Realtime Database"
2. Click "Create Database"
3. Choose "Start in test mode" (we'll secure it later)
4. Select a location close to your users
5. Click "Done"

### 4. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" and select web (</>) icon
4. Register your app with a nickname
5. Copy the Firebase configuration object

## Google Cloud Console Setup

### 1. Configure OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to "APIs & Services" > "OAuth consent screen"
4. Choose "External" user type
5. Fill in required fields:
   - App name: `SecBrain`
   - User support email: Your email
   - Developer contact: Your email
6. Add scopes:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
7. Add test users (your email addresses)

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized origins:
   - `https://yourdomain.com` (your production domain)
   - `http://localhost:3000` (for development)
5. Add authorized redirect URIs:
   - `https://yourdomain.com` (your production domain)
   - `http://localhost:3000` (for development)
6. Click "Create"
7. Copy the Client ID and Client Secret

## Application Configuration

### 1. Update Firebase Configuration

Edit `js/config/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 2. Update PWA Manifest

Edit `manifest.json`:

```json
{
  "name": "SecBrain - Habit Tracker",
  "short_name": "SecBrain",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "assets/images/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/images/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 3. Create App Icons

Create the following icon sizes and place them in `assets/images/icons/`:

- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`

You can use online tools like [PWA Builder](https://www.pwabuilder.com/imageGenerator) to generate these icons.

### 4. Add Favicon

Create `assets/images/favicon.ico` and update the HTML head:

```html
<link rel="icon" type="image/x-icon" href="assets/images/favicon.ico">
```

## Security Rules

### 1. Database Security Rules

In Firebase Console, go to "Realtime Database" > "Rules" and replace with:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "habits": {
          ".validate": "newData.hasChildren() && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 50"
        },
        "progress": {
          ".validate": "newData.hasChildren() && newData.child('date').isString()"
        },
        "settings": {
          ".validate": "newData.hasChildren() && newData.child('theme').isString() && (newData.child('theme').val() === 'dark' || newData.child('theme').val() === 'light')"
        }
      }
    }
  }
}
```

### 2. Storage Security Rules (if using Firebase Storage)

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

## Deployment

### 1. Prepare for Production

1. **Minify Assets**: Use tools like UglifyJS for JavaScript and CSS minifiers
2. **Optimize Images**: Compress all images
3. **Enable Compression**: Configure gzip compression on your server
4. **Set Cache Headers**: Configure appropriate cache headers

### 2. Deploy to Web Server

#### Option A: Static Hosting (Recommended)

**Firebase Hosting:**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

**Netlify:**
1. Connect your GitHub repository
2. Set build command: (none needed)
3. Set publish directory: `/`
4. Deploy

**Vercel:**
1. Connect your GitHub repository
2. Set framework: Other
3. Deploy

#### Option B: Traditional Web Server

1. Upload all files to your web server
2. Ensure HTTPS is enabled
3. Configure proper MIME types
4. Set up redirects for SPA routing

### 3. Domain Configuration

1. **Custom Domain**: Point your domain to your hosting provider
2. **SSL Certificate**: Ensure HTTPS is enabled
3. **DNS Configuration**: Set up proper DNS records

### 4. Environment Variables

For production, you might want to use environment variables:

```javascript
// In firebase-config.js
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  // ... other config
};
```

## Testing

### 1. Local Testing

1. **Start Local Server**:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

2. **Test Features**:
   - Authentication flow
   - Habit creation and tracking
   - Theme switching
   - Calendar navigation
   - Offline functionality

### 2. Production Testing

1. **Cross-browser Testing**:
   - Chrome, Firefox, Safari, Edge
   - Mobile browsers (iOS Safari, Chrome Mobile)

2. **Device Testing**:
   - Desktop (Windows, macOS, Linux)
   - Tablet (iPad, Android tablets)
   - Mobile (iPhone, Android phones)

3. **PWA Testing**:
   - Install as PWA
   - Test offline functionality
   - Verify push notifications
   - Check app-like behavior

### 3. Performance Testing

1. **Lighthouse Audit**:
   - Open Chrome DevTools
   - Go to Lighthouse tab
   - Run audit for PWA, Performance, Accessibility

2. **Network Testing**:
   - Test on slow connections
   - Verify offline functionality
   - Check sync behavior

## Troubleshooting

### Common Issues

#### 1. Authentication Not Working

**Symptoms**: Google sign-in fails or doesn't work

**Solutions**:
- Verify Firebase configuration is correct
- Check OAuth consent screen is configured
- Ensure authorized domains are added
- Verify HTTPS is enabled

#### 2. Database Permission Denied

**Symptoms**: Cannot save or load data

**Solutions**:
- Check Firebase security rules
- Verify user is authenticated
- Check database URL is correct
- Ensure user has proper permissions

#### 3. PWA Not Installing

**Symptoms**: "Add to Home Screen" not available

**Solutions**:
- Verify manifest.json is valid
- Check service worker is registered
- Ensure HTTPS is enabled
- Verify icons are properly sized

#### 4. Offline Functionality Not Working

**Symptoms**: App doesn't work without internet

**Solutions**:
- Check service worker is registered
- Verify cache strategies
- Check IndexedDB is available
- Test offline detection

#### 5. Sync Issues

**Symptoms**: Data doesn't sync across devices

**Solutions**:
- Check Firebase connection
- Verify authentication status
- Check for JavaScript errors
- Test network connectivity

### Debug Tools

#### 1. Browser DevTools

- **Console**: Check for JavaScript errors
- **Network**: Monitor API calls and sync
- **Application**: Check service worker and storage
- **Lighthouse**: Audit PWA features

#### 2. Firebase Console

- **Authentication**: Check user status
- **Database**: Monitor data changes
- **Performance**: Check app performance
- **Analytics**: View usage statistics

#### 3. Service Worker Debugging

```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => {
    console.log('SW:', registration);
  });
});
```

### Performance Optimization

#### 1. Bundle Size

- Minify JavaScript and CSS
- Remove unused code
- Optimize images
- Use compression

#### 2. Loading Performance

- Implement lazy loading
- Use critical CSS
- Optimize font loading
- Minimize render-blocking resources

#### 3. Runtime Performance

- Optimize DOM updates
- Use efficient data structures
- Implement proper caching
- Monitor memory usage

## Maintenance

### 1. Regular Updates

- Update Firebase SDK versions
- Monitor security advisories
- Update dependencies
- Test after updates

### 2. Monitoring

- Set up Firebase Analytics
- Monitor error rates
- Track user engagement
- Monitor performance metrics

### 3. Backup

- Export user data regularly
- Backup Firebase configuration
- Document customizations
- Version control all changes

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review Firebase documentation
3. Check browser compatibility
4. Test in incognito mode
5. Clear browser cache and data

---

For additional help, please refer to the main [README.md](README.md) or create an issue in the project repository.
