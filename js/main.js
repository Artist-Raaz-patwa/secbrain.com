/**
 * SecBrain - Main Application
 * Professional habit tracking app with real-time sync and brightness theme
 */

class SecBrainApp {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.appElement = null;
    this.authScreen = null;
    this.loadingScreen = null;
    this.listeners = [];
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      console.log('Initializing SecBrain...');
      
      // Set up DOM elements
      this.setupElements();
      
      // Show auth screen immediately instead of loading screen
      this.showAuthScreen();
      
      // Initialize services in background with timeout
      this.initializeServicesInBackground();
      
      this.isInitialized = true;
      console.log('SecBrain initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize SecBrain:', error);
      // Even if there's an error, show the auth screen
      this.showAuthScreen();
    }
  }

  /**
   * Initialize services in background without blocking UI
   */
  async initializeServicesInBackground() {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Services initialization timeout')), 5000);
      });
      
      // Wait for services to initialize with timeout
      await Promise.race([
        this.waitForServices(),
        timeoutPromise
      ]);
      
      // Set up authentication listener
      this.setupAuthListener();
      
      // Handle redirect result if user was redirected back from Google
      await this.handleRedirectResult();
      
      // Set up application listeners
      this.setupAppListeners();
      
      // Initialize theme
      this.initializeTheme();
      
      console.log('Background services initialized');
    } catch (error) {
      console.error('Background services initialization failed:', error);
      // Continue anyway - app should still work
    }
  }

  /**
   * Set up DOM elements
   */
  setupElements() {
    this.appElement = document.getElementById('app');
    this.authScreen = document.getElementById('auth-screen');
    this.loadingScreen = document.getElementById('loading-screen');
    
    if (!this.appElement || !this.authScreen || !this.loadingScreen) {
      throw new Error('Required app elements not found');
    }
  }

  /**
   * Wait for required services to initialize
   */
  async waitForServices() {
    const services = [
      { name: 'AuthService', instance: window.AuthService },
      { name: 'DatabaseService', instance: window.DatabaseService },
      { name: 'SyncService', instance: window.SyncService },
      { name: 'HabitManager', instance: window.HabitManager },
      { name: 'ProgressManager', instance: window.ProgressManager },
      { name: 'ThemeManager', instance: window.ThemeManager },
      { name: 'Calendar', instance: window.Calendar },
      { name: 'HabitModal', instance: window.HabitModal },
      { name: 'Header', instance: window.Header }
    ];
    
    const maxWaitTime = 10000; // 10 seconds
    const checkInterval = 100; // 100ms
    let waitTime = 0;
    
    while (waitTime < maxWaitTime) {
      const readyServices = services.filter(service => 
        service.instance && service.instance.isServiceInitialized && service.instance.isServiceInitialized()
      );
      
      console.log(`Services ready: ${readyServices.length}/${services.length}`);
      
      // If at least core services are ready, proceed
      const coreServices = ['AuthService', 'ThemeManager', 'Calendar'];
      const coreReady = coreServices.every(name => 
        services.find(s => s.name === name).instance && 
        services.find(s => s.name === name).instance.isServiceInitialized && 
        services.find(s => s.name === name).instance.isServiceInitialized()
      );
      
      if (coreReady) {
        console.log('Core services initialized, proceeding...');
        return;
      }
      
      await Helpers.wait(checkInterval);
      waitTime += checkInterval;
    }
    
    console.warn('Some services failed to initialize within timeout, proceeding with available services');
    // Don't throw error, just proceed with what we have
  }

  /**
   * Handle redirect result after Google sign-in
   */
  async handleRedirectResult() {
    if (window.AuthService) {
      try {
        const user = await window.AuthService.handleRedirectResult();
        if (user) {
          console.log('Redirect sign-in detected, user:', user.uid);
          // The auth state change listener should handle the UI transition
          // But we can also trigger it manually to be sure
          this.currentUser = user;
          this.handleAuthStateChange(user);
        }
      } catch (error) {
        console.error('Failed to handle redirect result:', error);
      }
    }
  }

  /**
   * Set up authentication listener
   */
  setupAuthListener() {
    if (window.AuthService) {
      console.log('Setting up authentication listener...');
      window.AuthService.onAuthStateChanged((user) => {
        console.log('Auth state change detected:', user ? `User: ${user.uid}` : 'No user');
        this.handleAuthStateChange(user);
      });
      console.log('Authentication listener set up successfully');
    } else {
      // Fallback: show auth screen if AuthService is not available
      console.warn('AuthService not available, showing auth screen');
      this.showAuthScreen();
    }
  }

  /**
   * Set up application listeners
   */
  setupAppListeners() {
    // Calendar day click
    if (window.Calendar) {
      window.Calendar.onCalendarEvent((event, data) => {
        if (event === 'dayClicked') {
          this.handleDayClick(data.dateString);
        }
      });
    }
    
    // Habit modal events
    if (window.HabitModal) {
      window.HabitModal.onModalEvent((event, data) => {
        if (event === 'showHabitForm') {
          this.showAddHabitForm(data.dateString);
        }
      });
    }
    
    // Header events
    if (window.Header) {
      window.Header.onHeaderEvent((event, data) => {
        if (event === 'signedOut') {
          this.handleSignOut();
        }
      });
    }
    
    // Habit changes
    if (window.HabitManager) {
      window.HabitManager.onHabitChange((event, data) => {
        this.handleHabitChange(event, data);
      });
    }
    
    // Progress changes
    if (window.ProgressManager) {
      window.ProgressManager.onProgressChange((event, data) => {
        this.handleProgressChange(event, data);
      });
    }
    
    // Theme changes
    if (window.ThemeManager) {
      window.ThemeManager.onThemeChange((theme) => {
        this.handleThemeChange(theme);
      });
    }
    
    // Sync status changes
    if (window.SyncService) {
      window.SyncService.onSyncStatusChange((status) => {
        this.handleSyncStatusChange(status);
      });
    }
  }

  /**
   * Initialize theme
   */
  initializeTheme() {
    if (window.ThemeManager) {
      const currentTheme = window.ThemeManager.getCurrentTheme();
      console.log('Current theme:', currentTheme);
    }
  }

  /**
   * Handle authentication state change
   * @param {Object|null} user - User object or null
   */
  handleAuthStateChange(user) {
    console.log('Auth state changed:', user ? `User: ${user.uid}` : 'No user');
    this.currentUser = user;
    
    if (user) {
      console.log('User authenticated, showing app...');
      this.showApp();
      this.initializeUserData();
    } else {
      console.log('No user, showing auth screen...');
      this.showAuthScreen();
    }
  }

  /**
   * Show authentication screen
   */
  showAuthScreen() {
    // Hide loading screen first
    this.hideLoadingScreen();
    
    // Show auth screen
    if (this.authScreen) {
      this.authScreen.classList.remove('hidden');
    }
    
    // Hide main app
    if (this.appElement) {
      this.appElement.classList.add('hidden');
    }
    
          // Set up Google sign-in button
      this.setupGoogleSignIn();
      
      // Set up skip login button
      this.setupSkipLogin();
      
      // Set up test button
      this.setupTestButton();
      
      console.log('Authentication screen displayed');
  }

  /**
   * Show main application
   */
  showApp() {
    console.log('Showing main app...');
    this.hideLoadingScreen();
    
    // Hide auth screen
    if (this.authScreen) {
      this.authScreen.classList.add('hidden');
      console.log('Auth screen hidden');
    }
    
    // Show main app
    if (this.appElement) {
      this.appElement.classList.remove('hidden');
      console.log('Main app shown');
    }
    
    // Update header with user info
    if (window.Header) {
      window.Header.updateUserInfo(this.currentUser);
    }
    
    // Refresh calendar
    if (window.Calendar) {
      window.Calendar.refresh();
    }
    
    console.log('App transition complete');
  }

  /**
   * Show loading screen
   */
  showLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.classList.remove('hidden');
    }
  }

  /**
   * Hide loading screen
   */
  hideLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('hidden');
      console.log('Loading screen hidden');
    } else {
      // Fallback: try to hide by ID
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        console.log('Loading screen hidden via fallback');
      }
    }
  }

  /**
   * Show error screen
   * @param {Error} error - Error object
   */
  showErrorScreen(error) {
    this.hideLoadingScreen();
    
    const errorMessage = error.message || 'An unexpected error occurred';
    console.error('Application error:', errorMessage);
    
    // You could show a proper error screen here
    alert(`Application Error: ${errorMessage}`);
  }

  /**
   * Set up Google sign-in button
   */
  setupGoogleSignIn() {
    const googleSignInBtn = document.getElementById('google-signin-btn');
    
    if (googleSignInBtn && window.AuthService) {
      googleSignInBtn.addEventListener('click', async () => {
        try {
          console.log('Google sign-in button clicked');
          googleSignInBtn.classList.add('auth-button--loading');
          
          // Use redirect method instead of popup for better UX
          // This will redirect to Google, then redirect back to the app
          await window.AuthService.signInWithGoogleRedirect();
          // Note: The page will redirect, so code after this won't execute
        } catch (error) {
          console.error('Google sign-in failed:', error);
          // Show error message to user with debug info
          this.showAuthError(error.message, error.debugInfo, error.code);
        } finally {
          googleSignInBtn.classList.remove('auth-button--loading');
        }
      });
    }
  }

  /**
   * Set up skip login button
   */
  setupSkipLogin() {
    const skipLoginBtn = document.getElementById('skip-login-btn');
    
    console.log('Setting up skip login button...', skipLoginBtn);
    
    if (skipLoginBtn) {
      console.log('Skip login button found, adding event listener');
      skipLoginBtn.addEventListener('click', () => {
        console.log('Skip login button clicked - continuing without authentication');
        
        // Create a mock user object for offline mode
        const mockUser = {
          uid: 'offline-user-' + Date.now(),
          displayName: 'Offline User',
          email: 'offline@local.app',
          photoURL: null,
          isAnonymous: true
        };
        
        // Set the current user and transition to main app
        this.currentUser = mockUser;
        this.handleAuthStateChange(mockUser);
        
        console.log('Continuing in offline mode with mock user:', mockUser.uid);
      });
    } else {
      console.error('Skip login button not found! Check HTML structure.');
    }
  }

  /**
   * Set up test button
   */
  setupTestButton() {
    const testBtn = document.getElementById('test-skip-btn');
    
    console.log('Setting up test button...', testBtn);
    
    if (testBtn) {
      console.log('Test button found, adding event listener');
      testBtn.addEventListener('click', () => {
        console.log('Test button clicked - continuing without authentication');
        
        // Create a mock user object for offline mode
        const mockUser = {
          uid: 'offline-user-' + Date.now(),
          displayName: 'Offline User',
          email: 'offline@local.app',
          photoURL: null,
          isAnonymous: true
        };
        
        // Set the current user and transition to main app
        this.currentUser = mockUser;
        this.handleAuthStateChange(mockUser);
        
        console.log('Continuing in offline mode with mock user:', mockUser.uid);
      });
    } else {
      console.error('Test button not found!');
    }
  }

  /**
   * Show authentication error
   * @param {string} message - Error message
   * @param {string} debugInfo - Debug information
   * @param {string} errorCode - Error code
   */
  showAuthError(message, debugInfo = '', errorCode = '') {
    // Remove existing error
    const existingError = document.querySelector('.auth-error');
    if (existingError) {
      existingError.remove();
    }
    
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = 'auth-error';
    
    // Create error content
    const errorContent = document.createElement('div');
    errorContent.innerHTML = `
      <div class="auth-error__message">${message}</div>
      ${debugInfo ? `<div class="auth-error__debug">${debugInfo}</div>` : ''}
      ${errorCode === 'auth/internal-error' ? `
        <div class="auth-error__help">
          <strong>Quick Fix:</strong>
          <ol>
            <li>Go to <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
            <li>Select project: <strong>secbrain-ad48a</strong></li>
            <li>Go to Authentication → Sign-in method</li>
            <li>Enable Google provider</li>
            <li>Add <strong>localhost</strong> to authorized domains</li>
          </ol>
        </div>
      ` : ''}
    `;
    
    errorElement.appendChild(errorContent);
    
    // Insert after auth content
    const authContent = document.querySelector('.auth-content');
    if (authContent) {
      authContent.appendChild(errorElement);
      
      // Auto-remove after 10 seconds (longer for internal errors)
      const timeout = errorCode === 'auth/internal-error' ? 10000 : 5000;
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.remove();
        }
      }, timeout);
    }
  }

  /**
   * Initialize user data
   */
  async initializeUserData() {
    try {
      console.log('Initializing user data...');
      
      // Load user habits and progress
      if (window.HabitManager) {
        await window.HabitManager.loadHabits();
      }
      
      if (window.ProgressManager) {
        await window.ProgressManager.loadProgress();
      }
      
      // Start sync service
      if (window.SyncService) {
        await window.SyncService.syncAllData();
      }
      
      console.log('User data initialized');
    } catch (error) {
      console.error('Failed to initialize user data:', error);
    }
  }

  /**
   * Handle day click
   * @param {string} dateString - Date string
   */
  handleDayClick(dateString) {
    if (window.HabitModal) {
      window.HabitModal.openModal(dateString);
    }
  }

  /**
   * Show add habit form
   * @param {string} dateString - Date string
   */
  showAddHabitForm(dateString) {
    // This would integrate with the add habit form component
    console.log('Show add habit form for:', dateString);
    
    // For now, we'll use a simple prompt
    const habitName = prompt('Enter habit name:');
    if (habitName && habitName.trim()) {
      this.addHabit(habitName.trim());
    }
  }

  /**
   * Add new habit
   * @param {string} habitName - Habit name
   */
  async addHabit(habitName) {
    try {
      if (window.HabitManager) {
        const habit = await window.HabitManager.addHabit(habitName);
        console.log('Habit added:', habit);
        
        // Refresh calendar to show new habit
        if (window.Calendar) {
          window.Calendar.refresh();
        }
      }
    } catch (error) {
      console.error('Failed to add habit:', error);
      alert(`Failed to add habit: ${error.message}`);
    }
  }

  /**
   * Handle habit change
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  handleHabitChange(event, data) {
    console.log('Habit change:', event, data);
    
    // Refresh calendar when habits change
    if (window.Calendar) {
      window.Calendar.refresh();
    }
  }

  /**
   * Handle progress change
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  handleProgressChange(event, data) {
    console.log('Progress change:', event, data);
    
    // Refresh calendar when progress changes
    if (window.Calendar) {
      window.Calendar.refresh();
    }
  }

  /**
   * Handle theme change
   * @param {string} theme - Theme name
   */
  handleThemeChange(theme) {
    console.log('Theme changed to:', theme);
    
    // Update all brightness elements
    if (window.ThemeManager) {
      window.ThemeManager.updateAllBrightnessElements();
    }
  }

  /**
   * Handle sync status change
   * @param {string} status - Sync status
   */
  handleSyncStatusChange(status) {
    console.log('Sync status changed to:', status);
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    console.log('User signed out');
    this.currentUser = null;
  }

  /**
   * Add application event listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onAppEvent(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.listeners.push(callback);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners of application events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in app listener:', error);
      }
    });
  }

  /**
   * Check if app is initialized
   * @returns {boolean} Initialization status
   */
  isAppInitialized() {
    return this.isInitialized;
  }

  /**
   * Get current user
   * @returns {Object|null} Current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get application statistics
   * @returns {Object} Application statistics
   */
  getAppStats() {
    return {
      isInitialized: this.isInitialized,
      currentUser: this.currentUser ? this.currentUser.uid : null,
      listeners: this.listeners.length,
      services: {
        auth: window.AuthService ? window.AuthService.isServiceInitialized() : false,
        database: window.DatabaseService ? window.DatabaseService.isServiceInitialized() : false,
        sync: window.SyncService ? window.SyncService.isServiceInitialized() : false,
        habits: window.HabitManager ? window.HabitManager.isManagerInitialized() : false,
        progress: window.ProgressManager ? window.ProgressManager.isManagerInitialized() : false,
        theme: window.ThemeManager ? window.ThemeManager.isManagerInitialized() : false,
        calendar: window.Calendar ? window.Calendar.isCalendarInitialized() : false,
        modal: window.HabitModal ? window.HabitModal.isModalInitialized() : false,
        header: window.Header ? window.Header.isHeaderInitialized() : false
      }
    };
  }

  /**
   * Refresh application
   */
  refresh() {
    if (window.Calendar) {
      window.Calendar.refresh();
    }
    
    if (window.HabitModal) {
      window.HabitModal.refresh();
    }
    
    if (window.Header) {
      window.Header.refresh();
    }
  }

  /**
   * Destroy application
   */
  destroy() {
    // Destroy all components
    if (window.Calendar) {
      window.Calendar.destroy();
    }
    
    if (window.Header) {
      window.Header.destroy();
    }
    
    // Clear listeners
    this.listeners = [];
    
    this.isInitialized = false;
  }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add a fallback timeout to ensure app loads even if there are issues
  const fallbackTimeout = setTimeout(() => {
    console.warn('Fallback: Forcing app to show auth screen');
    const loadingScreen = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
    if (authScreen) {
      authScreen.classList.remove('hidden');
    }
  }, 3000); // 3 second fallback
  
  try {
    window.SecBrainApp = new SecBrainApp();
    // Clear fallback timeout if app initializes successfully
    clearTimeout(fallbackTimeout);
  } catch (error) {
    console.error('Failed to initialize SecBrainApp:', error);
    // Fallback timeout will handle showing the auth screen
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecBrainApp;
}
