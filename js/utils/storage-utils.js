/**
 * SecBrain - Storage Utilities
 * Helper functions for local storage, session storage, and IndexedDB
 */

class StorageUtils {
  /**
   * Local Storage Operations
   */
  
  /**
   * Set item in localStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {boolean} Success status
   */
  static setLocalItem(key, value) {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error('Failed to set localStorage item:', error);
      return false;
    }
  }

  /**
   * Get item from localStorage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} Stored value or default
   */
  static getLocalItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to get localStorage item:', error);
      return defaultValue;
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  static removeLocalItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove localStorage item:', error);
      return false;
    }
  }

  /**
   * Clear all localStorage items
   * @returns {boolean} Success status
   */
  static clearLocalStorage() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }

  /**
   * Session Storage Operations
   */
  
  /**
   * Set item in sessionStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {boolean} Success status
   */
  static setSessionItem(key, value) {
    try {
      const serializedValue = JSON.stringify(value);
      sessionStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error('Failed to set sessionStorage item:', error);
      return false;
    }
  }

  /**
   * Get item from sessionStorage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} Stored value or default
   */
  static getSessionItem(key, defaultValue = null) {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to get sessionStorage item:', error);
      return defaultValue;
    }
  }

  /**
   * Remove item from sessionStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  static removeSessionItem(key) {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove sessionStorage item:', error);
      return false;
    }
  }

  /**
   * Clear all sessionStorage items
   * @returns {boolean} Success status
   */
  static clearSessionStorage() {
    try {
      sessionStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear sessionStorage:', error);
      return false;
    }
  }

  /**
   * IndexedDB Operations
   */
  
  /**
   * Open IndexedDB database
   * @param {string} dbName - Database name
   * @param {number} version - Database version
   * @param {Object} upgradeCallback - Upgrade callback function
   * @returns {Promise<IDBDatabase>} Database instance
   */
  static openIndexedDB(dbName, version = 1, upgradeCallback = null) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      if (upgradeCallback) {
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          upgradeCallback(db, event);
        };
      }
    });
  }

  /**
   * Store data in IndexedDB
   * @param {string} dbName - Database name
   * @param {string} storeName - Store name
   * @param {any} data - Data to store
   * @param {string|number} key - Optional key
   * @returns {Promise<boolean>} Success status
   */
  static async storeInIndexedDB(dbName, storeName, data, key = null) {
    try {
      const db = await this.openIndexedDB(dbName);
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = key ? store.put(data, key) : store.add(data);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to store in IndexedDB:', error);
      return false;
    }
  }

  /**
   * Retrieve data from IndexedDB
   * @param {string} dbName - Database name
   * @param {string} storeName - Store name
   * @param {string|number} key - Key to retrieve
   * @returns {Promise<any>} Retrieved data
   */
  static async getFromIndexedDB(dbName, storeName, key) {
    try {
      const db = await this.openIndexedDB(dbName);
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Delete data from IndexedDB
   * @param {string} dbName - Database name
   * @param {string} storeName - Store name
   * @param {string|number} key - Key to delete
   * @returns {Promise<boolean>} Success status
   */
  static async deleteFromIndexedDB(dbName, storeName, key) {
    try {
      const db = await this.openIndexedDB(dbName);
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete from IndexedDB:', error);
      return false;
    }
  }

  /**
   * Get all data from IndexedDB store
   * @param {string} dbName - Database name
   * @param {string} storeName - Store name
   * @returns {Promise<Array>} All data from store
   */
  static async getAllFromIndexedDB(dbName, storeName) {
    try {
      const db = await this.openIndexedDB(dbName);
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Offline Data Management
   */
  
  /**
   * Store offline data for later sync
   * @param {string} userId - User ID
   * @param {string} dataType - Type of data (habits, progress, etc.)
   * @param {any} data - Data to store offline
   * @returns {Promise<boolean>} Success status
   */
  static async storeOfflineData(userId, dataType, data) {
    try {
      const offlineData = {
        userId,
        dataType,
        data,
        timestamp: Date.now(),
        synced: false
      };
      
      return await this.storeInIndexedDB('SecBrainOffline', 'offlineData', offlineData);
    } catch (error) {
      console.error('Failed to store offline data:', error);
      return false;
    }
  }

  /**
   * Get offline data for user
   * @param {string} userId - User ID
   * @param {string} dataType - Type of data to retrieve
   * @returns {Promise<Array>} Offline data array
   */
  static async getOfflineData(userId, dataType = null) {
    try {
      const allData = await this.getAllFromIndexedDB('SecBrainOffline', 'offlineData');
      
      return allData.filter(item => {
        const matchesUser = item.userId === userId;
        const matchesType = !dataType || item.dataType === dataType;
        return matchesUser && matchesType;
      });
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return [];
    }
  }

  /**
   * Mark offline data as synced
   * @param {string} userId - User ID
   * @param {string} dataType - Type of data
   * @returns {Promise<boolean>} Success status
   */
  static async markOfflineDataAsSynced(userId, dataType) {
    try {
      const offlineData = await this.getOfflineData(userId, dataType);
      
      for (const item of offlineData) {
        item.synced = true;
        await this.storeInIndexedDB('SecBrainOffline', 'offlineData', item, item.id);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to mark offline data as synced:', error);
      return false;
    }
  }

  /**
   * Clear synced offline data
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async clearSyncedOfflineData(userId) {
    try {
      const offlineData = await this.getOfflineData(userId);
      const syncedData = offlineData.filter(item => item.synced);
      
      for (const item of syncedData) {
        await this.deleteFromIndexedDB('SecBrainOffline', 'offlineData', item.id);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to clear synced offline data:', error);
      return false;
    }
  }

  /**
   * Cache Management
   */
  
  /**
   * Set cache item with expiration
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} expirationMinutes - Expiration time in minutes
   * @returns {boolean} Success status
   */
  static setCacheItem(key, value, expirationMinutes = 60) {
    try {
      const cacheData = {
        value,
        expiration: Date.now() + (expirationMinutes * 60 * 1000)
      };
      
      return this.setLocalItem(`cache_${key}`, cacheData);
    } catch (error) {
      console.error('Failed to set cache item:', error);
      return false;
    }
  }

  /**
   * Get cache item
   * @param {string} key - Cache key
   * @param {any} defaultValue - Default value if expired or not found
   * @returns {any} Cached value or default
   */
  static getCacheItem(key, defaultValue = null) {
    try {
      const cacheData = this.getLocalItem(`cache_${key}`);
      
      if (!cacheData) {
        return defaultValue;
      }
      
      if (Date.now() > cacheData.expiration) {
        this.removeLocalItem(`cache_${key}`);
        return defaultValue;
      }
      
      return cacheData.value;
    } catch (error) {
      console.error('Failed to get cache item:', error);
      return defaultValue;
    }
  }

  /**
   * Clear expired cache items
   * @returns {number} Number of items cleared
   */
  static clearExpiredCache() {
    let clearedCount = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith('cache_')) {
          const cacheData = this.getLocalItem(key);
          
          if (cacheData && Date.now() > cacheData.expiration) {
            this.removeLocalItem(key);
            clearedCount++;
          }
        }
      }
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
    
    return clearedCount;
  }

  /**
   * Storage Quota Management
   */
  
  /**
   * Get storage usage information
   * @returns {Promise<Object>} Storage usage info
   */
  static async getStorageUsage() {
    try {
      const usage = {
        localStorage: 0,
        sessionStorage: 0,
        indexedDB: 0
      };
      
      // Calculate localStorage usage
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          usage.localStorage += localStorage[key].length;
        }
      }
      
      // Calculate sessionStorage usage
      for (let key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
          usage.sessionStorage += sessionStorage[key].length;
        }
      }
      
      // IndexedDB usage estimation (simplified)
      try {
        const db = await this.openIndexedDB('SecBrainOffline');
        const transaction = db.transaction(['offlineData'], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          usage.indexedDB = JSON.stringify(request.result).length;
        };
      } catch (error) {
        // IndexedDB not available or error
      }
      
      return usage;
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { localStorage: 0, sessionStorage: 0, indexedDB: 0 };
    }
  }

  /**
   * Check if storage is available
   * @returns {Object} Storage availability status
   */
  static checkStorageAvailability() {
    return {
      localStorage: this.isLocalStorageAvailable(),
      sessionStorage: this.isSessionStorageAvailable(),
      indexedDB: this.isIndexedDBAvailable()
    };
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} Availability status
   */
  static isLocalStorageAvailable() {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if sessionStorage is available
   * @returns {boolean} Availability status
   */
  static isSessionStorageAvailable() {
    try {
      const test = 'test';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if IndexedDB is available
   * @returns {boolean} Availability status
   */
  static isIndexedDBAvailable() {
    return typeof indexedDB !== 'undefined';
  }
}

// Initialize IndexedDB for offline data
StorageUtils.openIndexedDB('SecBrainOffline', 1, (db, event) => {
  if (!db.objectStoreNames.contains('offlineData')) {
    const store = db.createObjectStore('offlineData', { 
      keyPath: 'id', 
      autoIncrement: true 
    });
    store.createIndex('userId', 'userId', { unique: false });
    store.createIndex('dataType', 'dataType', { unique: false });
    store.createIndex('timestamp', 'timestamp', { unique: false });
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUtils;
}

// Make available globally
window.StorageUtils = StorageUtils;
