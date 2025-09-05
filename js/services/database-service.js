/**
 * SecBrain - Database Service
 * Handles Firebase Realtime Database operations for habits and progress
 */

class DatabaseService {
  constructor() {
    this.database = null;
    this.isInitialized = false;
    this.connectionStatus = 'disconnected';
    this.retryCount = 0;
    this.maxRetries = 5;
    
    this.init();
  }

  /**
   * Initialize database service
   */
  async init() {
    try {
      if (window.FirebaseConfig && window.FirebaseConfig.database) {
        this.database = window.FirebaseConfig.database;
        this.setupConnectionListener();
        this.isInitialized = true;
        this.connectionStatus = 'connected';
        console.log('DatabaseService initialized successfully');
      } else {
        console.warn('Firebase Database not available, using offline mode');
        this.database = null;
        this.isInitialized = true; // Mark as initialized for offline mode
        this.connectionStatus = 'offline';
        console.log('DatabaseService initialized in offline mode');
      }
    } catch (error) {
      console.error('Failed to initialize DatabaseService:', error);
      this.isInitialized = true; // Mark as initialized even in error state
      this.connectionStatus = 'error';
    }
  }

  /**
   * Set up database connection listener
   */
  setupConnectionListener() {
    if (!this.database) return;

    const connectedRef = this.database.ref('.info/connected');
    
    connectedRef.on('value', (snapshot) => {
      const isConnected = snapshot.val();
      this.connectionStatus = isConnected ? 'connected' : 'disconnected';
      
      if (isConnected) {
        console.log('Database connected');
        this.retryCount = 0;
        this.syncOfflineData();
      } else {
        console.log('Database disconnected');
      }
      
      // Notify listeners of connection status change
      this.notifyConnectionListeners(this.connectionStatus);
    });
  }

  /**
   * Get user's habits
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Promise<Object>} User's habits
   */
  async loadHabits(userId, callback = null) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const habitsRef = this.database.ref(`users/${userId}/habits`);
      
      if (callback) {
        // Set up real-time listener
        habitsRef.on('value', (snapshot) => {
          const habits = snapshot.val() || {};
          callback(habits);
        });
        
        // Return unsubscribe function
        return () => habitsRef.off('value');
      } else {
        // One-time read
        const snapshot = await habitsRef.once('value');
        return snapshot.val() || {};
      }
    } catch (error) {
      console.error('Failed to load habits:', error);
      
      // Try to load from offline storage
      const offlineHabits = await this.loadOfflineHabits(userId);
      if (callback) callback(offlineHabits);
      return offlineHabits;
    }
  }

  /**
   * Save user's habits
   * @param {string} userId - User ID
   * @param {Object} habits - Habits object
   * @returns {Promise<boolean>} Success status
   */
  async saveHabits(userId, habits) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const habitsRef = this.database.ref(`users/${userId}/habits`);
      await habitsRef.set(habits);
      
      // Also save to offline storage
      await this.saveOfflineHabits(userId, habits);
      
      console.log('Habits saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save habits:', error);
      
      // Save to offline storage as fallback
      await this.saveOfflineHabits(userId, habits);
      await this.storeOfflineData(userId, 'habits', habits);
      
      return false;
    }
  }

  /**
   * Get user's progress data
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Promise<Object>} User's progress data
   */
  async loadProgress(userId, callback = null) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const progressRef = this.database.ref(`users/${userId}/progress`);
      
      if (callback) {
        // Set up real-time listener
        progressRef.on('value', (snapshot) => {
          const progress = snapshot.val() || {};
          callback(progress);
        });
        
        // Return unsubscribe function
        return () => progressRef.off('value');
      } else {
        // One-time read
        const snapshot = await progressRef.once('value');
        return snapshot.val() || {};
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
      
      // Try to load from offline storage
      const offlineProgress = await this.loadOfflineProgress(userId);
      if (callback) callback(offlineProgress);
      return offlineProgress;
    }
  }

  /**
   * Save user's progress data
   * @param {string} userId - User ID
   * @param {Object} progress - Progress object
   * @returns {Promise<boolean>} Success status
   */
  async saveProgress(userId, progress) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const progressRef = this.database.ref(`users/${userId}/progress`);
      await progressRef.set(progress);
      
      // Also save to offline storage
      await this.saveOfflineProgress(userId, progress);
      
      console.log('Progress saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save progress:', error);
      
      // Save to offline storage as fallback
      await this.saveOfflineProgress(userId, progress);
      await this.storeOfflineData(userId, 'progress', progress);
      
      return false;
    }
  }

  /**
   * Update specific day's progress
   * @param {string} userId - User ID
   * @param {string} dateString - Date string (YYYY-MM-DD)
   * @param {Object} dayProgress - Day's progress data
   * @returns {Promise<boolean>} Success status
   */
  async updateDayProgress(userId, dateString, dayProgress) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const dayRef = this.database.ref(`users/${userId}/progress/${dateString}`);
      await dayRef.set(dayProgress);
      
      // Also save to offline storage
      await this.saveOfflineDayProgress(userId, dateString, dayProgress);
      
      console.log(`Day progress updated for ${dateString}`);
      return true;
    } catch (error) {
      console.error('Failed to update day progress:', error);
      
      // Save to offline storage as fallback
      await this.saveOfflineDayProgress(userId, dateString, dayProgress);
      await this.storeOfflineData(userId, 'dayProgress', { dateString, dayProgress });
      
      return false;
    }
  }

  /**
   * Get user's settings
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Promise<Object>} User's settings
   */
  async loadSettings(userId, callback = null) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const settingsRef = this.database.ref(`users/${userId}/settings`);
      
      if (callback) {
        // Set up real-time listener
        settingsRef.on('value', (snapshot) => {
          const settings = snapshot.val() || {};
          callback(settings);
        });
        
        // Return unsubscribe function
        return () => settingsRef.off('value');
      } else {
        // One-time read
        const snapshot = await settingsRef.once('value');
        return snapshot.val() || {};
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      
      // Try to load from offline storage
      const offlineSettings = await this.loadOfflineSettings(userId);
      if (callback) callback(offlineSettings);
      return offlineSettings;
    }
  }

  /**
   * Save user's settings
   * @param {string} userId - User ID
   * @param {Object} settings - Settings object
   * @returns {Promise<boolean>} Success status
   */
  async saveSettings(userId, settings) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const settingsRef = this.database.ref(`users/${userId}/settings`);
      await settingsRef.set(settings);
      
      // Also save to offline storage
      await this.saveOfflineSettings(userId, settings);
      
      console.log('Settings saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      
      // Save to offline storage as fallback
      await this.saveOfflineSettings(userId, settings);
      await this.storeOfflineData(userId, 'settings', settings);
      
      return false;
    }
  }

  /**
   * Set up real-time listener for habits changes
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onHabitsChange(userId, callback) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    const habitsRef = this.database.ref(`users/${userId}/habits`);
    
    habitsRef.on('value', (snapshot) => {
      const habits = snapshot.val() || {};
      callback(habits);
    });
    
    return () => habitsRef.off('value');
  }

  /**
   * Set up real-time listener for progress changes
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onProgressChange(userId, callback) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    const progressRef = this.database.ref(`users/${userId}/progress`);
    
    progressRef.on('value', (snapshot) => {
      const progress = snapshot.val() || {};
      callback(progress);
    });
    
    return () => progressRef.off('value');
  }

  /**
   * Set up real-time listener for settings changes
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onSettingsChange(userId, callback) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    const settingsRef = this.database.ref(`users/${userId}/settings`);
    
    settingsRef.on('value', (snapshot) => {
      const settings = snapshot.val() || {};
      callback(settings);
    });
    
    return () => settingsRef.off('value');
  }

  /**
   * Offline Storage Methods
   */

  /**
   * Save habits to offline storage
   * @param {string} userId - User ID
   * @param {Object} habits - Habits object
   */
  async saveOfflineHabits(userId, habits) {
    try {
      StorageUtils.setLocalItem(`userHabits_${userId}`, habits);
    } catch (error) {
      console.error('Failed to save offline habits:', error);
    }
  }

  /**
   * Load habits from offline storage
   * @param {string} userId - User ID
   * @returns {Object} Habits object
   */
  async loadOfflineHabits(userId) {
    try {
      return StorageUtils.getLocalItem(`userHabits_${userId}`, {});
    } catch (error) {
      console.error('Failed to load offline habits:', error);
      return {};
    }
  }

  /**
   * Save progress to offline storage
   * @param {string} userId - User ID
   * @param {Object} progress - Progress object
   */
  async saveOfflineProgress(userId, progress) {
    try {
      StorageUtils.setLocalItem(`userProgress_${userId}`, progress);
    } catch (error) {
      console.error('Failed to save offline progress:', error);
    }
  }

  /**
   * Load progress from offline storage
   * @param {string} userId - User ID
   * @returns {Object} Progress object
   */
  async loadOfflineProgress(userId) {
    try {
      return StorageUtils.getLocalItem(`userProgress_${userId}`, {});
    } catch (error) {
      console.error('Failed to load offline progress:', error);
      return {};
    }
  }

  /**
   * Save day progress to offline storage
   * @param {string} userId - User ID
   * @param {string} dateString - Date string
   * @param {Object} dayProgress - Day progress object
   */
  async saveOfflineDayProgress(userId, dateString, dayProgress) {
    try {
      const progress = await this.loadOfflineProgress(userId);
      progress[dateString] = dayProgress;
      await this.saveOfflineProgress(userId, progress);
    } catch (error) {
      console.error('Failed to save offline day progress:', error);
    }
  }

  /**
   * Save settings to offline storage
   * @param {string} userId - User ID
   * @param {Object} settings - Settings object
   */
  async saveOfflineSettings(userId, settings) {
    try {
      StorageUtils.setLocalItem(`userSettings_${userId}`, settings);
    } catch (error) {
      console.error('Failed to save offline settings:', error);
    }
  }

  /**
   * Load settings from offline storage
   * @param {string} userId - User ID
   * @returns {Object} Settings object
   */
  async loadOfflineSettings(userId) {
    try {
      return StorageUtils.getLocalItem(`userSettings_${userId}`, {});
    } catch (error) {
      console.error('Failed to load offline settings:', error);
      return {};
    }
  }

  /**
   * Store data for offline sync
   * @param {string} userId - User ID
   * @param {string} dataType - Type of data
   * @param {any} data - Data to store
   */
  async storeOfflineData(userId, dataType, data) {
    try {
      await StorageUtils.storeOfflineData(userId, dataType, data);
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  /**
   * Sync offline data when connection is restored
   */
  async syncOfflineData() {
    try {
      const userId = window.AuthService.getUserId();
      if (!userId) return;

      const offlineData = await StorageUtils.getOfflineData(userId);
      
      for (const item of offlineData) {
        if (item.synced) continue;
        
        try {
          switch (item.dataType) {
            case 'habits':
              await this.saveHabits(userId, item.data);
              break;
            case 'progress':
              await this.saveProgress(userId, item.data);
              break;
            case 'settings':
              await this.saveSettings(userId, item.data);
              break;
            case 'dayProgress':
              await this.updateDayProgress(userId, item.data.dateString, item.data.dayProgress);
              break;
          }
          
          // Mark as synced
          await StorageUtils.markOfflineDataAsSynced(userId, item.dataType);
        } catch (error) {
          console.error(`Failed to sync ${item.dataType}:`, error);
        }
      }
      
      // Clear synced data
      await StorageUtils.clearSyncedOfflineData(userId);
      
      console.log('Offline data sync completed');
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  /**
   * Connection Status Management
   */

  /**
   * Get connection status
   * @returns {string} Connection status
   */
  getConnectionStatus() {
    return this.connectionStatus;
  }

  /**
   * Check if database is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connectionStatus === 'connected';
  }

  /**
   * Add connection status listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onConnectionChange(callback) {
    this.connectionListeners = this.connectionListeners || [];
    this.connectionListeners.push(callback);
    
    // Call immediately with current status
    callback(this.connectionStatus);
    
    return () => {
      const index = this.connectionListeners.indexOf(callback);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify connection status listeners
   * @param {string} status - Connection status
   */
  notifyConnectionListeners(status) {
    if (this.connectionListeners) {
      this.connectionListeners.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in connection listener:', error);
        }
      });
    }
  }

  /**
   * Utility Methods
   */

  /**
   * Check if service is initialized
   * @returns {boolean} Initialization status
   */
  isServiceInitialized() {
    return this.isInitialized;
  }

  /**
   * Get database reference
   * @param {string} path - Database path
   * @returns {Object} Database reference
   */
  getRef(path) {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    return this.database.ref(path);
  }

  /**
   * Delete user data
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUserData(userId) {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      const userRef = this.database.ref(`users/${userId}`);
      await userRef.remove();
      
      // Also clear offline data
      StorageUtils.removeLocalItem(`userHabits_${userId}`);
      StorageUtils.removeLocalItem(`userProgress_${userId}`);
      StorageUtils.removeLocalItem(`userSettings_${userId}`);
      
      console.log('User data deleted successfully');
      return true;
    } catch (error) {
      console.error('Failed to delete user data:', error);
      return false;
    }
  }
}

// Create global instance
window.DatabaseService = new DatabaseService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DatabaseService;
}
