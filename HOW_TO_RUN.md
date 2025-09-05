# How to Run SecBrain

## 🚀 Quick Start

### Option 1: Double-click the batch file (Easiest)
1. Double-click `start-server.bat`
2. The app will automatically open in your browser at `http://localhost:8000`

### Option 2: Use PowerShell script
1. Right-click on `start-server.ps1`
2. Select "Run with PowerShell"
3. The app will open in your browser

### Option 3: Command line
1. Open Command Prompt or PowerShell in this folder
2. Run: `npx http-server -p 8000 -o`
3. The app will open automatically

## ⚠️ Important Notes

### Why you need a local server:
- **Firebase requires HTTP/HTTPS protocol** - it doesn't work with `file://` protocol
- **Security restrictions** - modern browsers block certain features for local files
- **Authentication** - Google sign-in only works over HTTP/HTTPS

### What happens if you open `index.html` directly:
- ❌ Firebase authentication won't work
- ❌ You'll see protocol errors in the console
- ❌ The app will run in offline mode only

## 🔧 Troubleshooting

### If the server doesn't start:
1. Make sure Node.js is installed: `node --version`
2. Make sure npm is installed: `npm --version`
3. Try running: `npm install -g http-server` first

### If you get permission errors:
1. Run Command Prompt as Administrator
2. Or use PowerShell: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### If the browser doesn't open automatically:
1. Manually go to: `http://localhost:8000`
2. Or try: `http://127.0.0.1:8000`

## 🎯 What to expect:

1. **App loads immediately** - no more "Loading SecBrain..." stuck screen
2. **Authentication screen** - Google sign-in button ready to use
3. **Firebase connection** - real-time database and authentication
4. **Console logs** - check browser dev tools to see connection status

## 🛑 To stop the server:
- Press `Ctrl+C` in the terminal/command prompt
- Or close the terminal window

## 📱 Features available:
- ✅ Google Authentication
- ✅ Real-time habit tracking
- ✅ Dark/Light theme
- ✅ Offline support
- ✅ Cross-device sync

Your SecBrain app is now ready to use! 🎉
