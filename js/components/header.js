/**
 * SecBrain - Header Component
 * Handles header interactions and sync status
 */

class Header {
  constructor() {
    this.header = null;
    this.syncStatus = null;
    this.syncIndicator = null;
    this.syncText = null;
    this.themeToggle = null;
    this.signOutButton = null;
    this.isInitialized = false;
    this.listeners = [];
    
    this.init();
  }

  /**
   * Initialize header component
   */
  init() {
    try {
      this.setupElements();
      this.setupEventListeners();
      this.setupSyncStatusListener();
      this.isInitialized = true;
      
      console.log('Header initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Header:', error);
      // Mark as initialized even in error state to prevent app from hanging
      this.isInitialized = true;
      console.log('Header initialized in offline mode');
    }
  }

  /**
   * Set up DOM elements
   */
  setupElements() {
    this.header = document.querySelector('.header');
    this.syncStatus = document.getElementById('sync-status');
    this.syncIndicator = document.getElementById('sync-indicator');
    this.syncText = document.getElementById('sync-text');
    this.themeToggle = document.getElementById('theme-toggle');
    this.signOutButton = document.getElementById('signout-btn');
    
    if (!this.header || !this.syncStatus || !this.syncIndicator || 
        !this.syncText || !this.themeToggle || !this.signOutButton) {
      console.warn('Some header elements not found, continuing with available elements');
      // Don't throw error, just log warning
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Theme toggle
    this.themeToggle.addEventListener('click', () => {
      this.handleThemeToggle();
    });
    
    // Sign out button
    this.signOutButton.addEventListener('click', () => {
      this.handleSignOut();
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            this.handleThemeToggle();
            break;
          case 'q':
            e.preventDefault();
            this.handleSignOut();
            break;
        }
      }
    });
  }

  /**
   * Set up sync status listener
   */
  setupSyncStatusListener() {
    // Listen for sync status changes
    if (window.SyncService) {
      window.SyncService.onSyncStatusChange((status) => {
        this.updateSyncStatus(status);
      });
    }
    
    // Listen for connection status changes
    if (window.DatabaseService) {
      window.DatabaseService.onConnectionChange((status) => {
        this.updateConnectionStatus(status);
      });
    }
  }

  /**
   * Handle theme toggle
   */
  handleThemeToggle() {
    try {
      if (window.ThemeManager) {
        const newTheme = window.ThemeManager.toggleTheme();
        
        // Update button aria-label
        this.themeToggle.setAttribute('aria-label', 
          `Switch to ${newTheme === 'dark' ? 'light' : 'dark'} theme`);
        
        // Notify listeners
        this.notifyListeners('themeToggled', { newTheme });
        
        console.log('Theme toggled to:', newTheme);
      }
    } catch (error) {
      console.error('Failed to toggle theme:', error);
    }
  }

  /**
   * Handle sign out
   */
  async handleSignOut() {
    try {
      if (window.AuthService) {
        await window.AuthService.signOut();
        
        // Notify listeners
        this.notifyListeners('signedOut', {});
        
        console.log('User signed out');
      }
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }

  /**
   * Update sync status display
   * @param {string} status - Sync status
   */
  updateSyncStatus(status) {
    if (!this.syncIndicator || !this.syncText) return;
    
    // Remove existing status classes
    this.syncIndicator.classList.remove(
      'sync-indicator--syncing',
      'sync-indicator--error',
      'sync-indicator--offline'
    );
    
    // Update status based on sync state
    switch (status) {
      case 'syncing':
        this.syncIndicator.classList.add('sync-indicator--syncing');
        this.syncText.textContent = 'Syncing...';
        break;
      case 'synced':
        this.syncText.textContent = 'Synced';
        break;
      case 'error':
        this.syncIndicator.classList.add('sync-indicator--error');
        this.syncText.textContent = 'Sync Error';
        break;
      case 'idle':
        this.syncText.textContent = 'Ready';
        break;
      default:
        this.syncText.textContent = 'Unknown';
    }
    
    // Update sync status title
    this.syncStatus.title = this.getSyncStatusTitle(status);
  }

  /**
   * Update connection status
   * @param {string} status - Connection status
   */
  updateConnectionStatus(status) {
    if (!this.syncIndicator || !this.syncText) return;
    
    switch (status) {
      case 'disconnected':
        this.syncIndicator.classList.add('sync-indicator--offline');
        this.syncText.textContent = 'Offline';
        this.syncStatus.title = 'Working offline - changes will sync when connected';
        break;
      case 'connected':
        // Remove offline indicator
        this.syncIndicator.classList.remove('sync-indicator--offline');
        // Update sync status if connected
        if (window.SyncService) {
          this.updateSyncStatus(window.SyncService.getSyncStatus());
        }
        break;
    }
  }

  /**
   * Get sync status title
   * @param {string} status - Sync status
   * @returns {string} Status title
   */
  getSyncStatusTitle(status) {
    switch (status) {
      case 'syncing':
        return 'Synchronizing data with server...';
      case 'synced':
        return 'All data synchronized';
      case 'error':
        return 'Synchronization failed - check connection';
      case 'idle':
        return 'Ready to sync';
      default:
        return 'Unknown sync status';
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (this.header) {
      this.header.classList.add('header--loading');
    }
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (this.header) {
      this.header.classList.remove('header--loading');
    }
  }

  /**
   * Update user info in header
   * @param {Object} user - User object
   */
  updateUserInfo(user) {
    if (!user) return;
    
    // Update sign out button aria-label
    if (this.signOutButton) {
      this.signOutButton.setAttribute('aria-label', `Sign out ${user.displayName || user.email}`);
    }
  }

  /**
   * Add header event listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onHeaderEvent(callback) {
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
   * Notify listeners of header events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in header listener:', error);
      }
    });
  }

  /**
   * Check if header is initialized
   * @returns {boolean} Initialization status
   */
  isHeaderInitialized() {
    return this.isInitialized;
  }

  /**
   * Get header statistics
   * @returns {Object} Header statistics
   */
  getHeaderStats() {
    return {
      isInitialized: this.isInitialized,
      listeners: this.listeners.length,
      syncStatus: window.SyncService ? window.SyncService.getSyncStatus() : 'unknown',
      connectionStatus: window.DatabaseService ? window.DatabaseService.getConnectionStatus() : 'unknown'
    };
  }

  /**
   * Refresh header
   */
  refresh() {
    // Update sync status
    if (window.SyncService) {
      this.updateSyncStatus(window.SyncService.getSyncStatus());
    }
    
    // Update connection status
    if (window.DatabaseService) {
      this.updateConnectionStatus(window.DatabaseService.getConnectionStatus());
    }
  }

  /**
   * Destroy header component
   */
  destroy() {
    // Remove event listeners
    if (this.themeToggle) {
      this.themeToggle.removeEventListener('click', this.handleThemeToggle);
    }
    
    if (this.signOutButton) {
      this.signOutButton.removeEventListener('click', this.handleSignOut);
    }
    
    // Clear listeners
    this.listeners = [];
    
    this.isInitialized = false;
  }
}

// Create global instance
window.Header = new Header();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Header;
}
