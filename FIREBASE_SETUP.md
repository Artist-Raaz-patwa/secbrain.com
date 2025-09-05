# Firebase Setup Guide for SecBrain

## ✅ Firebase Configuration Complete

Your SecBrain app is now connected to your Firebase project: **secbrain-ad48a**

## 🔧 Firebase Console Setup Required

To ensure full functionality, please configure the following in your Firebase Console:

### 1. Authentication Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **secbrain-ad48a**
3. Navigate to **Authentication** → **Sign-in method**
4. Enable **Google** as a sign-in provider
5. Add your domain to authorized domains:
   - `localhost` (for development)
   - Your production domain (when deployed)

### 2. Realtime Database Setup
1. Navigate to **Realtime Database**
2. Create a database in **test mode** (for development)
3. Update security rules to:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "habits": {
          ".validate": "newData.hasChildren() && newData.child('name').isString() && newData.child('name').val().length > 0"
        },
        "progress": {
          ".validate": "newData.hasChildren() && newData.child('date').isString()"
        },
        "settings": {
          ".validate": "newData.hasChildren() && newData.child('theme').isString()"
        }
      }
    }
  }
}
```

### 3. Storage Setup (Optional)
1. Navigate to **Storage**
2. Create a storage bucket
3. Configure security rules for user data

## 🚀 Testing Your Setup

1. **Open the app**: `index.html` in your browser
2. **Check console**: Open browser dev tools to see Firebase connection logs
3. **Test authentication**: Click "Sign in with Google"
4. **Verify data**: Check Firebase Console → Realtime Database for user data

## 📱 Features Now Available

- ✅ **Google Authentication**: Sign in with your Google account
- ✅ **Real-time Database**: Store and sync habits across devices
- ✅ **Offline Support**: Works without internet connection
- ✅ **Theme Management**: Dark/light mode preferences
- ✅ **Habit Tracking**: Create and track daily habits
- ✅ **Progress Analytics**: View your habit completion statistics

## 🔍 Troubleshooting

### If Google Sign-in doesn't work:
1. Check that Google provider is enabled in Firebase Console
2. Verify your domain is in authorized domains
3. Check browser console for error messages

### If database operations fail:
1. Verify Realtime Database is created
2. Check security rules are properly configured
3. Ensure user is authenticated

### If app doesn't load:
1. Check browser console for JavaScript errors
2. Verify all files are in the correct directory structure
3. Try opening in a different browser

## 📞 Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify Firebase Console configuration
3. Ensure all required services are enabled

Your SecBrain app is now fully connected to Firebase! 🎉
