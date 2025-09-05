/**
 * SecBrain - Sync Service
 * Handles real-time synchronization across devices
 */

class SyncService {
  constructor() {
    this.isInitialized = false;
    this.syncStatus = 'idle'; // idle, syncing, synced, error
    this.syncListeners = [];
    this.lastSyncTime = null;
    this.syncInterval = null;
    this.autoSyncEnabled = true;
    this.syncDelay = 2000; // 2 seconds delay for auto-sync
    
    this.init();
  }

  /**
   * Initialize sync service
   */
  async init() {
    try {
      // Wait for other services to initialize
      await this.waitForServices();
      
      this.setupSyncListeners();
      this.startAutoSync();
      this.isInitialized = true;
      
      console.log('SyncService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SyncService:', error);
      // Mark as initialized even in error state to prevent app from hanging
      this.isInitialized = true;
      this.syncStatus = 'offline';
      console.log('SyncService initialized in offline mode');
    }
  }

  /**
   * Wait for required services to initialize
   */
  async waitForServices() {
    const maxWaitTime = 5000; // 5 seconds
    const checkInterval = 100; // 100ms
    let waitTime = 0;
    
    while (waitTime < maxWaitTime) {
      if (window.AuthService && window.AuthService.isServiceInitialized() &&
          window.DatabaseService && window.DatabaseService.isServiceInitialized()) {
        return;
      }
      
      await Helpers.wait(checkInterval);
      waitTime += checkInterval;
    }
    
    console.warn('Required services failed to initialize within timeout, proceeding with offline mode');
    // Don't throw error, just proceed
  }

  /**
   * Set up sync listeners
   */
  setupSyncListeners() {
    // Listen for authentication state changes
    if (window.AuthService) {
      window.AuthService.onAuthStateChanged((user) => {
        if (user) {
          this.startUserSync(user.uid);
        } else {
          this.stopUserSync();
        }
      });
    }
    
    // Listen for database connection changes
    if (window.DatabaseService) {
      window.DatabaseService.onConnectionChange((status) => {
        if (status === 'connected') {
          this.syncAllData();
        } else {
          this.setSyncStatus('error');
        }
      });
    }
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.syncAllData();
    });
    
    window.addEventListener('offline', () => {
      this.setSyncStatus('error');
    });
  }

  /**
   * Start auto-sync for user
   * @param {string} userId - User ID
   */
  startUserSync(userId) {
    this.userId = userId;
    this.startAutoSync();
  }

  /**
   * Stop user sync
   */
  stopUserSync() {
    this.userId = null;
    this.stopAutoSync();
    this.setSyncStatus('idle');
  }

  /**
   * Start automatic sync
   */
  startAutoSync() {
    if (!this.autoSyncEnabled || this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      if (this.userId && this.shouldAutoSync()) {
        this.syncAllData();
      }
    }, this.syncDelay);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Check if auto-sync should run
   * @returns {boolean} True if should auto-sync
   */
  shouldAutoSync() {
    if (!this.userId) return false;
    if (this.syncStatus === 'syncing') return false;
    if (!window.DatabaseService.isConnected()) return false;
    
    // Don't auto-sync if last sync was recent
    if (this.lastSyncTime && Date.now() - this.lastSyncTime < 5000) {
      return false;
    }
    
    return true;
  }

  /**
   * Sync all user data
   * @returns {Promise<boolean>} Success status
   */
  async syncAllData() {
    if (!this.userId) {
      console.warn('No user ID for sync');
      return false;
    }
    
    if (this.syncStatus === 'syncing') {
      console.log('Sync already in progress');
      return false;
    }
    
    try {
      this.setSyncStatus('syncing');
      
      // Sync habits
      await this.syncHabits();
      
      // Sync progress
      await this.syncProgress();
      
      // Sync settings
      await this.syncSettings();
      
      // Sync offline data
      await this.syncOfflineData();
      
      this.setSyncStatus('synced');
      this.lastSyncTime = Date.now();
      
      console.log('All data synced successfully');
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      this.setSyncStatus('error');
      return false;
    }
  }

  /**
   * Sync habits data
   * @returns {Promise<boolean>} Success status
   */
  async syncHabits() {
    try {
      const habits = await window.DatabaseService.loadHabits(this.userId);
      
      // Save to offline storage
      await window.DatabaseService.saveOfflineHabits(this.userId, habits);
      
      console.log('Habits synced');
      return true;
    } catch (error) {
      console.error('Failed to sync habits:', error);
      return false;
    }
  }

  /**
   * Sync progress data
   * @returns {Promise<boolean>} Success status
   */
  async syncProgress() {
    try {
      const progress = await window.DatabaseService.loadProgress(this.userId);
      
      // Save to offline storage
      await window.DatabaseService.saveOfflineProgress(this.userId, progress);
      
      console.log('Progress synced');
      return true;
    } catch (error) {
      console.error('Failed to sync progress:', error);
      return false;
    }
  }

  /**
   * Sync settings data
   * @returns {Promise<boolean>} Success status
   */
  async syncSettings() {
    try {
      const settings = await window.DatabaseService.loadSettings(this.userId);
      
      // Save to offline storage
      await window.DatabaseService.saveOfflineSettings(this.userId, settings);
      
      console.log('Settings synced');
      return true;
    } catch (error) {
      console.error('Failed to sync settings:', error);
      return false;
    }
  }

  /**
   * Sync offline data
   * @returns {Promise<boolean>} Success status
   */
  async syncOfflineData() {
    try {
      await window.DatabaseService.syncOfflineData();
      console.log('Offline data synced');
      return true;
    } catch (error) {
      console.error('Failed to sync offline data:', error);
      return false;
    }
  }

  /**
   * Force sync all data
   * @returns {Promise<boolean>} Success status
   */
  async forceSync() {
    console.log('Force sync initiated');
    return await this.syncAllData();
  }

  /**
   * Sync specific data type
   * @param {string} dataType - Type of data to sync
   * @returns {Promise<boolean>} Success status
   */
  async syncDataType(dataType) {
    if (!this.userId) return false;
    
    try {
      switch (dataType) {
        case 'habits':
          return await this.syncHabits();
        case 'progress':
          return await this.syncProgress();
        case 'settings':
          return await this.syncSettings();
        case 'offline':
          return await this.syncOfflineData();
        default:
          console.warn(`Unknown data type: ${dataType}`);
          return false;
      }
    } catch (error) {
      console.error(`Failed to sync ${dataType}:`, error);
      return false;
    }
  }

  /**
   * Set sync status
   * @param {string} status - Sync status
   */
  setSyncStatus(status) {
    if (this.syncStatus !== status) {
      this.syncStatus = status;
      this.notifySyncListeners(status);
    }
  }

  /**
   * Get sync status
   * @returns {string} Current sync status
   */
  getSyncStatus() {
    return this.syncStatus;
  }

  /**
   * Get last sync time
   * @returns {Date|null} Last sync time
   */
  getLastSyncTime() {
    return this.lastSyncTime ? new Date(this.lastSyncTime) : null;
  }

  /**
   * Get formatted last sync time
   * @returns {string} Formatted last sync time
   */
  getFormattedLastSyncTime() {
    if (!this.lastSyncTime) return 'Never';
    
    const now = new Date();
    const syncTime = new Date(this.lastSyncTime);
    const diffMs = now - syncTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  /**
   * Add sync status listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onSyncStatusChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.syncListeners.push(callback);
    
    // Call immediately with current status
    callback(this.syncStatus);
    
    return () => {
      const index = this.syncListeners.indexOf(callback);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify sync status listeners
   * @param {string} status - Sync status
   */
  notifySyncListeners(status) {
    this.syncListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  /**
   * Enable/disable auto-sync
   * @param {boolean} enabled - Auto-sync enabled status
   */
  setAutoSyncEnabled(enabled) {
    this.autoSyncEnabled = enabled;
    
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Check if auto-sync is enabled
   * @returns {boolean} Auto-sync enabled status
   */
  isAutoSyncEnabled() {
    return this.autoSyncEnabled;
  }

  /**
   * Set sync delay
   * @param {number} delay - Delay in milliseconds
   */
  setSyncDelay(delay) {
    this.syncDelay = Math.max(1000, delay); // Minimum 1 second
    
    // Restart auto-sync with new delay
    if (this.autoSyncEnabled) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  /**
   * Get sync delay
   * @returns {number} Sync delay in milliseconds
   */
  getSyncDelay() {
    return this.syncDelay;
  }

  /**
   * Check if service is initialized
   * @returns {boolean} Initialization status
   */
  isServiceInitialized() {
    return this.isInitialized;
  }

  /**
   * Get sync statistics
   * @returns {Object} Sync statistics
   */
  getSyncStats() {
    return {
      status: this.syncStatus,
      lastSyncTime: this.lastSyncTime,
      formattedLastSyncTime: this.getFormattedLastSyncTime(),
      autoSyncEnabled: this.autoSyncEnabled,
      syncDelay: this.syncDelay,
      isConnected: window.DatabaseService ? window.DatabaseService.isConnected() : false,
      userId: this.userId
    };
  }

  /**
   * Reset sync service
   */
  reset() {
    this.stopAutoSync();
    this.syncStatus = 'idle';
    this.lastSyncTime = null;
    this.userId = null;
    this.syncListeners = [];
  }

  /**
   * Handle sync errors
   * @param {Error} error - Error object
   */
  handleSyncError(error) {
    console.error('Sync error:', error);
    this.setSyncStatus('error');
    
    // Retry sync after delay
    setTimeout(() => {
      if (this.userId && this.autoSyncEnabled) {
        this.syncAllData();
      }
    }, 5000);
  }

  /**
   * Cleanup sync service
   */
  cleanup() {
    this.stopAutoSync();
    this.reset();
    this.isInitialized = false;
  }
}

// Create global instance
window.SyncService = new SyncService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncService;
}
