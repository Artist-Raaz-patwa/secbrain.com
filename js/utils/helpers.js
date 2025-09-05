/**
 * SecBrain - Helper Utilities
 * General utility functions for the application
 */

class Helpers {
  /**
   * Generate unique ID
   * @param {string} prefix - Optional prefix for the ID
   * @returns {string} Unique ID
   */
  static generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
  }

  /**
   * Debounce function execution
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @param {boolean} immediate - Execute immediately on first call
   * @returns {Function} Debounced function
   */
  static debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func.apply(this, args);
    };
  }

  /**
   * Throttle function execution
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, limit) {
    let inThrottle;
    
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Deep clone an object
   * @param {any} obj - Object to clone
   * @returns {any} Cloned object
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  /**
   * Check if two objects are equal
   * @param {any} obj1 - First object
   * @param {any} obj2 - Second object
   * @returns {boolean} True if objects are equal
   */
  static isEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return false;
    
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    if (obj1 instanceof Date && obj2 instanceof Date) {
      return obj1.getTime() === obj2.getTime();
    }
    
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) return false;
      for (let i = 0; i < obj1.length; i++) {
        if (!this.isEqual(obj1[i], obj2[i])) return false;
      }
      return true;
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.isEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }

  /**
   * Format number with commas
   * @param {number} num - Number to format
   * @returns {string} Formatted number string
   */
  static formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString();
  }

  /**
   * Format percentage
   * @param {number} value - Value to format
   * @param {number} total - Total value
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted percentage string
   */
  static formatPercentage(value, total, decimals = 1) {
    if (total === 0) return '0%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  static capitalize(str) {
    if (typeof str !== 'string' || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Convert string to title case
   * @param {string} str - String to convert
   * @returns {string} Title case string
   */
  static toTitleCase(str) {
    if (typeof str !== 'string') return str;
    
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  /**
   * Truncate string to specified length
   * @param {string} str - String to truncate
   * @param {number} length - Maximum length
   * @param {string} suffix - Suffix to add if truncated
   * @returns {string} Truncated string
   */
  static truncate(str, length, suffix = '...') {
    if (typeof str !== 'string') return str;
    if (str.length <= length) return str;
    return str.substr(0, length - suffix.length) + suffix;
  }

  /**
   * Remove HTML tags from string
   * @param {string} str - String with HTML tags
   * @returns {string} String without HTML tags
   */
  static stripHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * Escape HTML characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  static escapeHtml(str) {
    if (typeof str !== 'string') return str;
    
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return str.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
  }

  /**
   * Validate email address
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email
   */
  static isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  static isValidUrl(url) {
    if (typeof url !== 'string') return false;
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get random number between min and max
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random number
   */
  static random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Shuffle array
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  static shuffle(array) {
    if (!Array.isArray(array)) return array;
    
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  /**
   * Group array by key
   * @param {Array} array - Array to group
   * @param {string} key - Key to group by
   * @returns {Object} Grouped object
   */
  static groupBy(array, key) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  /**
   * Sort array by key
   * @param {Array} array - Array to sort
   * @param {string} key - Key to sort by
   * @param {string} direction - Sort direction ('asc' or 'desc')
   * @returns {Array} Sorted array
   */
  static sortBy(array, key, direction = 'asc') {
    if (!Array.isArray(array)) return array;
    
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Remove duplicates from array
   * @param {Array} array - Array to deduplicate
   * @param {string} key - Optional key to deduplicate by
   * @returns {Array} Array without duplicates
   */
  static unique(array, key = null) {
    if (!Array.isArray(array)) return array;
    
    if (key) {
      const seen = new Set();
      return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    }
    
    return [...new Set(array)];
  }

  /**
   * Wait for specified time
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after specified time
   */
  static wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function execution
   * @param {Function} fn - Function to retry
   * @param {number} retries - Number of retries
   * @param {number} delay - Delay between retries in milliseconds
   * @returns {Promise} Promise that resolves with function result
   */
  static async retry(fn, retries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await this.wait(delay);
        return this.retry(fn, retries - 1, delay);
      }
      throw error;
    }
  }

  /**
   * Check if device is mobile
   * @returns {boolean} True if mobile device
   */
  static isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Check if device is touch enabled
   * @returns {boolean} True if touch enabled
   */
  static isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get device type
   * @returns {string} Device type ('mobile', 'tablet', 'desktop')
   */
  static getDeviceType() {
    const width = window.innerWidth;
    
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  static async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Download data as file
   * @param {any} data - Data to download
   * @param {string} filename - Filename
   * @param {string} type - MIME type
   */
  static downloadFile(data, filename, type = 'application/json') {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  }

  /**
   * Get query parameter value
   * @param {string} name - Parameter name
   * @returns {string|null} Parameter value
   */
  static getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  /**
   * Set query parameter
   * @param {string} name - Parameter name
   * @param {string} value - Parameter value
   */
  static setQueryParam(name, value) {
    const url = new URL(window.location);
    url.searchParams.set(name, value);
    window.history.replaceState({}, '', url);
  }

  /**
   * Remove query parameter
   * @param {string} name - Parameter name
   */
  static removeQueryParam(name) {
    const url = new URL(window.location);
    url.searchParams.delete(name);
    window.history.replaceState({}, '', url);
  }

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if browser supports feature
   * @param {string} feature - Feature to check
   * @returns {boolean} Support status
   */
  static supportsFeature(feature) {
    const features = {
      localStorage: () => {
        try {
          return typeof Storage !== 'undefined' && localStorage !== null;
        } catch (e) {
          return false;
        }
      },
      sessionStorage: () => {
        try {
          return typeof Storage !== 'undefined' && sessionStorage !== null;
        } catch (e) {
          return false;
        }
      },
      indexedDB: () => typeof indexedDB !== 'undefined',
      serviceWorker: () => 'serviceWorker' in navigator,
      pushNotifications: () => 'Notification' in window,
      geolocation: () => 'geolocation' in navigator,
      webGL: () => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
          return false;
        }
      }
    };
    
    return features[feature] ? features[feature]() : false;
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Helpers;
}

// Make available globally
window.Helpers = Helpers;
