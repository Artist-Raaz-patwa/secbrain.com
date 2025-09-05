# SecBrain API Documentation

This document provides comprehensive API documentation for all SecBrain components, services, and utilities.

## Table of Contents

1. [Core Services](#core-services)
2. [Data Managers](#data-managers)
3. [UI Components](#ui-components)
4. [Utilities](#utilities)
5. [Event System](#event-system)
6. [Configuration](#configuration)

## Core Services

### AuthService

Handles Google Authentication with Firebase.

#### Methods

##### `signInWithGoogle()`
Signs in the user with Google authentication.

**Returns:** `Promise<Object>` - User object

**Example:**
```javascript
try {
  const user = await AuthService.signInWithGoogle();
  console.log('Signed in:', user.displayName);
} catch (error) {
  console.error('Sign-in failed:', error.message);
}
```

##### `signOut()`
Signs out the current user.

**Returns:** `Promise<void>`

**Example:**
```javascript
await AuthService.signOut();
console.log('User signed out');
```

##### `getCurrentUser()`
Gets the currently signed-in user.

**Returns:** `Object|null` - User object or null

**Example:**
```javascript
const user = AuthService.getCurrentUser();
if (user) {
  console.log('User:', user.displayName);
}
```

##### `isUserSignedIn()`
Checks if a user is currently signed in.

**Returns:** `boolean`

**Example:**
```javascript
if (AuthService.isUserSignedIn()) {
  console.log('User is signed in');
}
```

##### `onAuthStateChanged(callback)`
Listens for authentication state changes.

**Parameters:**
- `callback` (Function): Callback function that receives the user object

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
const unsubscribe = AuthService.onAuthStateChanged((user) => {
  if (user) {
    console.log('User signed in:', user.uid);
  } else {
    console.log('User signed out');
  }
});

// Later, to stop listening
unsubscribe();
```

### DatabaseService

Manages Firebase Realtime Database operations.

#### Methods

##### `saveHabits(userId, habits)`
Saves user's habits to the database.

**Parameters:**
- `userId` (string): User ID
- `habits` (Object): Habits object

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
const habits = {
  1: { id: 1, name: 'Exercise', isActive: true },
  2: { id: 2, name: 'Read', isActive: true }
};

await DatabaseService.saveHabits(userId, habits);
```

##### `loadHabits(userId, callback)`
Loads user's habits from the database.

**Parameters:**
- `userId` (string): User ID
- `callback` (Function, optional): Real-time callback function

**Returns:** `Promise<Object>` or `Function` - Habits object or unsubscribe function

**Example:**
```javascript
// One-time load
const habits = await DatabaseService.loadHabits(userId);

// Real-time listener
const unsubscribe = DatabaseService.loadHabits(userId, (habits) => {
  console.log('Habits updated:', habits);
});
```

##### `saveProgress(userId, progress)`
Saves user's progress data.

**Parameters:**
- `userId` (string): User ID
- `progress` (Object): Progress object

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
const progress = {
  '2024-01-15': {
    1: true,  // Habit 1 completed
    2: false  // Habit 2 not completed
  }
};

await DatabaseService.saveProgress(userId, progress);
```

##### `loadProgress(userId, callback)`
Loads user's progress data.

**Parameters:**
- `userId` (string): User ID
- `callback` (Function, optional): Real-time callback function

**Returns:** `Promise<Object>` or `Function` - Progress object or unsubscribe function

**Example:**
```javascript
const progress = await DatabaseService.loadProgress(userId);
```

##### `updateDayProgress(userId, dateString, dayProgress)`
Updates progress for a specific day.

**Parameters:**
- `userId` (string): User ID
- `dateString` (string): Date string (YYYY-MM-DD)
- `dayProgress` (Object): Day's progress data

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
const dayProgress = {
  1: true,
  2: false,
  3: true
};

await DatabaseService.updateDayProgress(userId, '2024-01-15', dayProgress);
```

### SyncService

Manages real-time synchronization across devices.

#### Methods

##### `syncAllData()`
Syncs all user data.

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
const success = await SyncService.syncAllData();
if (success) {
  console.log('All data synced');
}
```

##### `forceSync()`
Forces an immediate sync of all data.

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
await SyncService.forceSync();
```

##### `getSyncStatus()`
Gets the current sync status.

**Returns:** `string` - Sync status ('idle', 'syncing', 'synced', 'error')

**Example:**
```javascript
const status = SyncService.getSyncStatus();
console.log('Sync status:', status);
```

##### `onSyncStatusChange(callback)`
Listens for sync status changes.

**Parameters:**
- `callback` (Function): Callback function

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
const unsubscribe = SyncService.onSyncStatusChange((status) => {
  console.log('Sync status changed to:', status);
});
```

## Data Managers

### HabitManager

Manages habit data and operations.

#### Methods

##### `addHabit(name, options)`
Adds a new habit.

**Parameters:**
- `name` (string): Habit name
- `options` (Object, optional): Additional options

**Returns:** `Promise<Object>` - Created habit object

**Example:**
```javascript
const habit = await HabitManager.addHabit('Exercise', {
  category: 'health',
  target: 1,
  unit: 'times'
});
```

##### `updateHabit(habitId, updates)`
Updates an existing habit.

**Parameters:**
- `habitId` (number): Habit ID
- `updates` (Object): Updates to apply

**Returns:** `Promise<Object>` - Updated habit object

**Example:**
```javascript
await HabitManager.updateHabit(1, { name: 'Daily Exercise' });
```

##### `removeHabit(habitId)`
Removes a habit.

**Parameters:**
- `habitId` (number): Habit ID

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
await HabitManager.removeHabit(1);
```

##### `getHabits()`
Gets all habits.

**Returns:** `Object` - All habits object

**Example:**
```javascript
const habits = HabitManager.getHabits();
console.log('All habits:', habits);
```

##### `getActiveHabits()`
Gets all active habits.

**Returns:** `Array` - Array of active habits

**Example:**
```javascript
const activeHabits = HabitManager.getActiveHabits();
console.log('Active habits:', activeHabits);
```

##### `onHabitChange(callback)`
Listens for habit changes.

**Parameters:**
- `callback` (Function): Callback function

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
const unsubscribe = HabitManager.onHabitChange((event, data) => {
  console.log('Habit event:', event, data);
});
```

### ProgressManager

Manages habit progress tracking and statistics.

#### Methods

##### `setHabitProgress(dateString, habitId, completed)`
Sets habit progress for a specific date.

**Parameters:**
- `dateString` (string): Date string (YYYY-MM-DD)
- `habitId` (number): Habit ID
- `completed` (boolean|number): Completion status or count

**Returns:** `Promise<boolean>` - Success status

**Example:**
```javascript
await ProgressManager.setHabitProgress('2024-01-15', 1, true);
```

##### `getHabitProgress(dateString, habitId)`
Gets habit progress for a specific date.

**Parameters:**
- `dateString` (string): Date string (YYYY-MM-DD)
- `habitId` (number): Habit ID

**Returns:** `boolean|number|null` - Progress value or null

**Example:**
```javascript
const progress = ProgressManager.getHabitProgress('2024-01-15', 1);
console.log('Progress:', progress);
```

##### `getDayProgress(dateString)`
Gets all progress for a specific date.

**Parameters:**
- `dateString` (string): Date string (YYYY-MM-DD)

**Returns:** `Object` - Day progress object

**Example:**
```javascript
const dayProgress = ProgressManager.getDayProgress('2024-01-15');
console.log('Day progress:', dayProgress);
```

##### `calculateProgress(dateString, habits)`
Calculates progress percentage for a date.

**Parameters:**
- `dateString` (string): Date string (YYYY-MM-DD)
- `habits` (Array): Array of habit objects

**Returns:** `number` - Progress percentage (0-100)

**Example:**
```javascript
const habits = HabitManager.getActiveHabits();
const progress = ProgressManager.calculateProgress('2024-01-15', habits);
console.log('Progress:', progress + '%');
```

##### `getHabitStreak(habitId, endDate)`
Gets habit streak count.

**Parameters:**
- `habitId` (number): Habit ID
- `endDate` (string, optional): End date string (YYYY-MM-DD)

**Returns:** `number` - Streak count

**Example:**
```javascript
const streak = ProgressManager.getHabitStreak(1);
console.log('Current streak:', streak);
```

##### `onProgressChange(callback)`
Listens for progress changes.

**Parameters:**
- `callback` (Function): Callback function

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
const unsubscribe = ProgressManager.onProgressChange((event, data) => {
  console.log('Progress event:', event, data);
});
```

## UI Components

### Calendar

Manages calendar display and interactions.

#### Methods

##### `navigateToMonth(direction)`
Navigates to a different month.

**Parameters:**
- `direction` (number): Direction (-1 for previous, 1 for next)

**Example:**
```javascript
Calendar.navigateToMonth(1);  // Next month
Calendar.navigateToMonth(-1); // Previous month
```

##### `setCurrentMonth(monthDate)`
Sets the current month.

**Parameters:**
- `monthDate` (Date): Month date

**Example:**
```javascript
Calendar.setCurrentMonth(new Date(2024, 0, 1)); // January 2024
```

##### `refresh()`
Refreshes the calendar display.

**Example:**
```javascript
Calendar.refresh();
```

##### `onCalendarEvent(callback)`
Listens for calendar events.

**Parameters:**
- `callback` (Function): Callback function

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
const unsubscribe = Calendar.onCalendarEvent((event, data) => {
  if (event === 'dayClicked') {
    console.log('Day clicked:', data.dateString);
  }
});
```

### HabitModal

Manages habit modal display and interactions.

#### Methods

##### `openModal(dateString)`
Opens the modal for a specific date.

**Parameters:**
- `dateString` (string): Date string (YYYY-MM-DD)

**Example:**
```javascript
HabitModal.openModal('2024-01-15');
```

##### `closeModal()`
Closes the modal.

**Example:**
```javascript
HabitModal.closeModal();
```

##### `isModalOpen()`
Checks if the modal is open.

**Returns:** `boolean`

**Example:**
```javascript
if (HabitModal.isModalOpen()) {
  console.log('Modal is open');
}
```

##### `onModalEvent(callback)`
Listens for modal events.

**Parameters:**
- `callback` (Function): Callback function

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
const unsubscribe = HabitModal.onModalEvent((event, data) => {
  if (event === 'habitToggled') {
    console.log('Habit toggled:', data);
  }
});
```

### ThemeManager

Manages brightness theme system.

#### Methods

##### `toggleTheme()`
Toggles between dark and light themes.

**Returns:** `string` - New theme name

**Example:**
```javascript
const newTheme = ThemeManager.toggleTheme();
console.log('Theme changed to:', newTheme);
```

##### `setTheme(themeName)`
Sets a specific theme.

**Parameters:**
- `themeName` (string): Theme name ('dark' or 'light')

**Example:**
```javascript
ThemeManager.setTheme('dark');
```

##### `getCurrentTheme()`
Gets the current theme.

**Returns:** `string` - Current theme name

**Example:**
```javascript
const theme = ThemeManager.getCurrentTheme();
console.log('Current theme:', theme);
```

##### `applyBrightnessLogic(element, progress, isDark)`
Applies brightness logic to an element.

**Parameters:**
- `element` (HTMLElement): Element to apply brightness to
- `progress` (number): Progress percentage (0-100)
- `isDark` (boolean, optional): Whether theme is dark

**Example:**
```javascript
const element = document.querySelector('.calendar-day');
ThemeManager.applyBrightnessLogic(element, 75);
```

##### `onThemeChange(callback)`
Listens for theme changes.

**Parameters:**
- `callback` (Function): Callback function

**Returns:** `Function` - Unsubscribe function

**Example:**
```javascript
const unsubscribe = ThemeManager.onThemeChange((theme) => {
  console.log('Theme changed to:', theme);
});
```

## Utilities

### DateUtils

Provides date manipulation and formatting utilities.

#### Methods

##### `getCurrentDateString()`
Gets current date in YYYY-MM-DD format.

**Returns:** `string` - Current date string

**Example:**
```javascript
const today = DateUtils.getCurrentDateString();
console.log('Today:', today); // "2024-01-15"
```

##### `formatDateString(date)`
Formats date to YYYY-MM-DD string.

**Parameters:**
- `date` (Date): Date object

**Returns:** `string` - Formatted date string

**Example:**
```javascript
const dateString = DateUtils.formatDateString(new Date());
console.log('Date string:', dateString);
```

##### `parseDateString(dateString)`
Parses date string to Date object.

**Parameters:**
- `dateString` (string): Date string (YYYY-MM-DD)

**Returns:** `Date` - Date object

**Example:**
```javascript
const date = DateUtils.parseDateString('2024-01-15');
console.log('Date:', date);
```

##### `getCalendarDays(monthDate)`
Gets calendar days for a month.

**Parameters:**
- `monthDate` (Date): Date representing the month

**Returns:** `Array` - Array of calendar day objects

**Example:**
```javascript
const days = DateUtils.getCalendarDays(new Date());
console.log('Calendar days:', days);
```

##### `isToday(date)`
Checks if date is today.

**Parameters:**
- `date` (Date): Date to check

**Returns:** `boolean`

**Example:**
```javascript
const isToday = DateUtils.isToday(new Date());
console.log('Is today:', isToday);
```

### StorageUtils

Provides local storage, session storage, and IndexedDB utilities.

#### Methods

##### `setLocalItem(key, value)`
Sets item in localStorage.

**Parameters:**
- `key` (string): Storage key
- `value` (any): Value to store

**Returns:** `boolean` - Success status

**Example:**
```javascript
StorageUtils.setLocalItem('theme', 'dark');
```

##### `getLocalItem(key, defaultValue)`
Gets item from localStorage.

**Parameters:**
- `key` (string): Storage key
- `defaultValue` (any, optional): Default value

**Returns:** `any` - Stored value or default

**Example:**
```javascript
const theme = StorageUtils.getLocalItem('theme', 'dark');
```

##### `setSessionItem(key, value)`
Sets item in sessionStorage.

**Parameters:**
- `key` (string): Storage key
- `value` (any): Value to store

**Returns:** `boolean` - Success status

**Example:**
```javascript
StorageUtils.setSessionItem('currentUser', user);
```

##### `getSessionItem(key, defaultValue)`
Gets item from sessionStorage.

**Parameters:**
- `key` (string): Storage key
- `defaultValue` (any, optional): Default value

**Returns:** `any` - Stored value or default

**Example:**
```javascript
const user = StorageUtils.getSessionItem('currentUser');
```

### Helpers

Provides general utility functions.

#### Methods

##### `generateId(prefix)`
Generates unique ID.

**Parameters:**
- `prefix` (string, optional): ID prefix

**Returns:** `string` - Unique ID

**Example:**
```javascript
const id = Helpers.generateId('habit');
console.log('ID:', id); // "habit_1234567890_abcdef"
```

##### `debounce(func, wait, immediate)`
Debounces function execution.

**Parameters:**
- `func` (Function): Function to debounce
- `wait` (number): Wait time in milliseconds
- `immediate` (boolean, optional): Execute immediately

**Returns:** `Function` - Debounced function

**Example:**
```javascript
const debouncedSave = Helpers.debounce(saveData, 1000);
```

##### `deepClone(obj)`
Deep clones an object.

**Parameters:**
- `obj` (any): Object to clone

**Returns:** `any` - Cloned object

**Example:**
```javascript
const cloned = Helpers.deepClone(originalObject);
```

##### `formatNumber(num)`
Formats number with commas.

**Parameters:**
- `num` (number): Number to format

**Returns:** `string` - Formatted number string

**Example:**
```javascript
const formatted = Helpers.formatNumber(1234567);
console.log(formatted); // "1,234,567"
```

##### `isMobile()`
Checks if device is mobile.

**Returns:** `boolean`

**Example:**
```javascript
if (Helpers.isMobile()) {
  console.log('Mobile device detected');
}
```

## Event System

All components and services use a consistent event system for communication.

### Event Types

#### Authentication Events
- `authStateChanged` - Authentication state changed
- `userSignedIn` - User signed in
- `userSignedOut` - User signed out

#### Habit Events
- `habitAdded` - Habit added
- `habitUpdated` - Habit updated
- `habitRemoved` - Habit removed
- `habitToggled` - Habit completion toggled

#### Progress Events
- `progressUpdated` - Progress updated
- `progressCleared` - Progress cleared
- `dayProgressUpdated` - Day progress updated

#### Calendar Events
- `dayClicked` - Calendar day clicked
- `monthChanged` - Calendar month changed
- `navigatedToToday` - Navigated to today

#### Modal Events
- `modalOpened` - Modal opened
- `modalClosed` - Modal closed
- `showHabitForm` - Show habit form requested

#### Theme Events
- `themeChanged` - Theme changed
- `brightnessApplied` - Brightness applied to element

#### Sync Events
- `syncStarted` - Sync started
- `syncCompleted` - Sync completed
- `syncFailed` - Sync failed
- `connectionChanged` - Connection status changed

### Event Listener Pattern

All event listeners follow this pattern:

```javascript
const unsubscribe = component.onEventType((event, data) => {
  // Handle event
});

// Later, to stop listening
unsubscribe();
```

## Configuration

### Firebase Configuration

Update `js/config/firebase-config.js`:

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

Update `manifest.json`:

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

### Service Configuration

#### Sync Service
```javascript
// In sync-service.js
const SYNC_CONFIG = {
  autoSyncEnabled: true,
  syncDelay: 2000, // 2 seconds
  maxRetries: 5
};
```

#### Theme Configuration
```javascript
// In theme-manager.js
const THEME_CONFIG = {
  defaultTheme: 'dark',
  autoDetectSystemTheme: true,
  savePreference: true
};
```

## Error Handling

All services and components include comprehensive error handling:

### Common Error Types

1. **Authentication Errors**
   - `auth/user-not-found`
   - `auth/wrong-password`
   - `auth/network-request-failed`

2. **Database Errors**
   - `database/permission-denied`
   - `database/unavailable`
   - `database/network-error`

3. **Validation Errors**
   - Invalid date format
   - Missing required fields
   - Invalid habit data

### Error Handling Pattern

```javascript
try {
  await service.method();
} catch (error) {
  console.error('Operation failed:', error);
  // Handle error appropriately
}
```

## Performance Considerations

### Optimization Tips

1. **Use Debouncing**: For frequent operations like saving
2. **Batch Operations**: Group multiple database operations
3. **Cache Results**: Store frequently accessed data
4. **Lazy Loading**: Load components as needed
5. **Efficient Rendering**: Minimize DOM updates

### Memory Management

1. **Unsubscribe Listeners**: Always unsubscribe from event listeners
2. **Clear Caches**: Regularly clear unused cache data
3. **Limit Data**: Don't load unnecessary data
4. **Cleanup Resources**: Properly destroy components

---

This API documentation covers all the major components and services in SecBrain. For more specific examples and use cases, refer to the source code and the main README.md file.
