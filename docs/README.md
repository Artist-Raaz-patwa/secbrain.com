# SecBrain - Professional Habit Tracker

SecBrain is a professional productivity web application designed for habit tracking with real-time synchronization across all devices. The app features a unique "brightness theme" where progress is visualized through grayscale colors only, creating a clean and focused user experience.

## Features

### 🎯 Core Functionality
- **Habit Management**: Add, edit, and track multiple habits
- **Progress Visualization**: Brightness-based progress display using only black, white, and grayscale colors
- **Real-time Sync**: Automatic synchronization across all devices using Firebase
- **Calendar View**: Full-screen monthly calendar with day-by-day progress tracking
- **Google Authentication**: Secure sign-in with Google accounts

### 🎨 Design System
- **Brightness Theme**: 
  - Dark Mode: 0% progress = 100% black, 100% progress = 100% white
  - Light Mode: Inverted brightness scale
- **Theme Toggle**: Switch between dark and light modes
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

### 🔄 Real-time Features
- **Cross-device Sync**: Changes sync instantly across all devices
- **Offline Support**: Works offline with automatic sync when connection is restored
- **PWA Support**: Installable as a Progressive Web App
- **Service Worker**: Offline functionality and background sync

### 📱 Progressive Web App
- **Installable**: Can be installed on mobile and desktop
- **Offline Capable**: Works without internet connection
- **Push Notifications**: Habit reminders and sync notifications
- **App-like Experience**: Full-screen mode and native feel

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase (Authentication, Realtime Database)
- **PWA**: Service Worker, Web App Manifest
- **Storage**: LocalStorage, SessionStorage, IndexedDB
- **Styling**: CSS Custom Properties, BEM Methodology

## Architecture

### Modular Design
The application follows a modular architecture with clear separation of concerns:

- **Services**: Authentication, Database, Sync
- **Components**: Calendar, Modal, Header, Theme Manager
- **Data Managers**: Habit Manager, Progress Manager
- **Utilities**: Date utilities, Storage utilities, Helper functions

### File Structure
```
secbrain/
├── index.html                 # Main HTML file
├── manifest.json             # PWA manifest
├── sw.js                     # Service Worker
├── assets/                   # Static assets
├── css/                      # Stylesheets
│   ├── main.css             # Main styles
│   ├── components/          # Component styles
│   ├── themes/              # Theme styles
│   └── responsive.css       # Responsive design
├── js/                       # JavaScript modules
│   ├── main.js              # App initialization
│   ├── config/              # Configuration
│   ├── services/            # Service layer
│   ├── components/          # UI components
│   ├── data/                # Data management
│   └── utils/               # Utility functions
└── docs/                     # Documentation
```

## Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- Firebase project with Authentication and Realtime Database
- Google Cloud Console project for OAuth

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd secbrain
   ```

2. **Set up Firebase**
   - Create a new Firebase project
   - Enable Authentication with Google provider
   - Enable Realtime Database
   - Get your Firebase configuration

3. **Configure Firebase**
   - Update `js/config/firebase-config.js` with your Firebase configuration
   - Set up Firebase security rules (see `docs/SETUP.md`)

4. **Deploy**
   - Upload files to your web server
   - Ensure HTTPS is enabled (required for PWA and Firebase)

### Quick Start

1. Open the application in your browser
2. Sign in with your Google account
3. Add your first habit
4. Start tracking your progress
5. Install as PWA for mobile access

## Usage

### Adding Habits
1. Click on any day in the calendar
2. Click "Add Habit" button
3. Enter habit name and details
4. Save to start tracking

### Tracking Progress
1. Click on a day to open the habit modal
2. Check off completed habits
3. Progress is automatically calculated and displayed
4. Changes sync across all devices

### Theme Switching
- Click the theme toggle button in the header
- Switch between dark and light modes
- Theme preference is saved automatically

### Calendar Navigation
- Use arrow buttons to navigate months
- Click "Today" to return to current month
- Use keyboard arrows for navigation

## API Documentation

### Core Services

#### AuthService
```javascript
// Sign in with Google
await AuthService.signInWithGoogle();

// Sign out
await AuthService.signOut();

// Get current user
const user = AuthService.getCurrentUser();

// Listen for auth changes
AuthService.onAuthStateChanged((user) => {
  // Handle auth state change
});
```

#### DatabaseService
```javascript
// Save habits
await DatabaseService.saveHabits(userId, habits);

// Load habits
const habits = await DatabaseService.loadHabits(userId);

// Save progress
await DatabaseService.saveProgress(userId, progress);

// Load progress
const progress = await DatabaseService.loadProgress(userId);
```

#### HabitManager
```javascript
// Add habit
const habit = await HabitManager.addHabit('Exercise');

// Update habit
await HabitManager.updateHabit(habitId, { name: 'New Name' });

// Remove habit
await HabitManager.removeHabit(habitId);

// Get habits
const habits = HabitManager.getHabits();
```

#### ProgressManager
```javascript
// Set habit progress
await ProgressManager.setHabitProgress(dateString, habitId, true);

// Get day progress
const progress = ProgressManager.getDayProgress(dateString);

// Calculate progress percentage
const percentage = ProgressManager.calculateProgress(dateString, habits);
```

### Components

#### Calendar
```javascript
// Navigate to month
Calendar.navigateToMonth(1); // Next month
Calendar.navigateToMonth(-1); // Previous month

// Set current month
Calendar.setCurrentMonth(new Date());

// Refresh calendar
Calendar.refresh();

// Listen for events
Calendar.onCalendarEvent((event, data) => {
  if (event === 'dayClicked') {
    // Handle day click
  }
});
```

#### HabitModal
```javascript
// Open modal for date
HabitModal.openModal('2024-01-15');

// Close modal
HabitModal.closeModal();

// Check if open
const isOpen = HabitModal.isModalOpen();

// Listen for events
HabitModal.onModalEvent((event, data) => {
  if (event === 'habitToggled') {
    // Handle habit toggle
  }
});
```

#### ThemeManager
```javascript
// Toggle theme
const newTheme = ThemeManager.toggleTheme();

// Set specific theme
ThemeManager.setTheme('dark');

// Get current theme
const theme = ThemeManager.getCurrentTheme();

// Apply brightness to element
ThemeManager.applyBrightnessLogic(element, progress);

// Listen for theme changes
ThemeManager.onThemeChange((theme) => {
  // Handle theme change
});
```

## Configuration

### Firebase Configuration
Update `js/config/firebase-config.js` with your Firebase project details:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### PWA Configuration
Update `manifest.json` with your app details:

```json
{
  "name": "SecBrain - Habit Tracker",
  "short_name": "SecBrain",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#000000"
}
```

## Security

### Firebase Security Rules
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        "habits": {
          ".validate": "newData.hasChildren() && newData.child('name').isString()"
        },
        "progress": {
          ".validate": "newData.hasChildren() && newData.child('date').isString()"
        }
      }
    }
  }
}
```

### Data Privacy
- All user data is stored securely in Firebase
- Data is encrypted in transit and at rest
- Users can only access their own data
- No third-party tracking or analytics

## Performance

### Optimization Features
- **Lazy Loading**: Components load as needed
- **Caching**: Aggressive caching with service worker
- **Offline Support**: Full functionality without internet
- **Efficient Rendering**: Minimal DOM updates
- **Compressed Assets**: Optimized file sizes

### Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- Mobile browsers with PWA support

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style
- Use ES6+ features
- Follow BEM CSS methodology
- Write comprehensive comments
- Maintain consistent formatting

### Testing
- Test on multiple devices and browsers
- Verify offline functionality
- Test sync behavior
- Check accessibility features

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in `docs/`
- Review the setup guide in `docs/SETUP.md`

## Changelog

### Version 1.0.0
- Initial release
- Core habit tracking functionality
- Real-time synchronization
- PWA support
- Brightness theme system
- Google Authentication
- Offline support

---

**SecBrain** - Professional habit tracking with real-time sync and brightness theme visualization.
