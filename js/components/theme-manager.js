/**
 * SecBrain - Theme Manager
 * Manages brightness theme system with dark/light modes
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.isInitialized = false;
    this.listeners = [];
    this.brightnessCache = new Map();
    
    this.init();
  }

  /**
   * Initialize theme manager
   */
  init() {
    try {
      this.loadThemePreference();
      this.applyTheme(this.currentTheme);
      this.setupSystemThemeListener();
      this.isInitialized = true;
      
      console.log('ThemeManager initialized with theme:', this.currentTheme);
    } catch (error) {
      console.error('Failed to initialize ThemeManager:', error);
      // Mark as initialized even in error state to prevent app from hanging
      this.isInitialized = true;
      console.log('ThemeManager initialized in offline mode');
    }
  }

  /**
   * Load theme preference from storage
   */
  loadThemePreference() {
    try {
      // Try to load from localStorage first
      let savedTheme = null;
      if (window.StorageUtils && window.StorageUtils.getLocalItem) {
        savedTheme = window.StorageUtils.getLocalItem('theme', null);
      } else {
        // Fallback to direct localStorage access
        try {
          savedTheme = localStorage.getItem('theme');
        } catch (e) {
          console.warn('localStorage not available');
        }
      }
      
      if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
        this.currentTheme = savedTheme;
        return;
      }
      
      // Fallback to system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        this.currentTheme = 'light';
      } else {
        this.currentTheme = 'dark';
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
      this.currentTheme = 'dark'; // Default fallback
    }
  }

  /**
   * Save theme preference to storage
   */
  saveThemePreference() {
    try {
      StorageUtils.setLocalItem('theme', this.currentTheme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }

  /**
   * Set up system theme change listener
   */
  setupSystemThemeListener() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      
      mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        const savedTheme = StorageUtils.getLocalItem('theme', null);
        if (!savedTheme) {
          this.currentTheme = e.matches ? 'light' : 'dark';
          this.applyTheme(this.currentTheme);
          this.notifyListeners('themeChanged', this.currentTheme);
        }
      });
    }
  }

  /**
   * Toggle between dark and light themes
   * @returns {string} New theme name
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Set specific theme
   * @param {string} themeName - Theme name ('dark' or 'light')
   */
  setTheme(themeName) {
    if (themeName !== 'dark' && themeName !== 'light') {
      throw new Error('Invalid theme name. Must be "dark" or "light"');
    }
    
    if (this.currentTheme !== themeName) {
      this.currentTheme = themeName;
      this.applyTheme(themeName);
      this.saveThemePreference();
      this.notifyListeners('themeChanged', themeName);
      
      console.log('Theme changed to:', themeName);
    }
  }

  /**
   * Get current theme
   * @returns {string} Current theme name
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Apply theme to document
   * @param {string} themeName - Theme name to apply
   */
  applyTheme(themeName) {
    const body = document.body;
    
    // Remove existing theme classes
    body.classList.remove('theme-dark', 'theme-light');
    
    // Add new theme class
    body.classList.add(`theme-${themeName}`);
    
    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor(themeName);
    
    // Update PWA theme color
    this.updatePWAThemeColor(themeName);
  }

  /**
   * Update meta theme-color tag
   * @param {string} themeName - Theme name
   */
  updateMetaThemeColor(themeName) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    
    // Set theme color based on current theme
    metaThemeColor.content = themeName === 'dark' ? '#000000' : '#ffffff';
  }

  /**
   * Update PWA theme color
   * @param {string} themeName - Theme name
   */
  updatePWAThemeColor(themeName) {
    // Update manifest theme color if available
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      // PWA is running in standalone mode
      const themeColor = themeName === 'dark' ? '#000000' : '#ffffff';
      
      // Update document title bar color (if supported)
      if (navigator.userAgent.includes('Windows')) {
        document.documentElement.style.setProperty('--theme-color', themeColor);
      }
    }
  }

  /**
   * Apply brightness logic to element based on progress
   * @param {HTMLElement} element - Element to apply brightness to
   * @param {number} progress - Progress percentage (0-100)
   * @param {boolean} isDark - Whether current theme is dark
   */
  applyBrightnessLogic(element, progress, isDark = null) {
    if (!element) return;
    
    const currentIsDark = isDark !== null ? isDark : this.currentTheme === 'dark';
    
    // Clamp progress between 0 and 100
    progress = Math.max(0, Math.min(100, progress));
    
    // Calculate brightness based on theme
    let brightness;
    if (currentIsDark) {
      // Dark mode: 0% progress = 0% brightness (black), 100% progress = 100% brightness (white)
      brightness = progress;
    } else {
      // Light mode: 0% progress = 100% brightness (white), 100% progress = 0% brightness (black)
      brightness = 100 - progress;
    }
    
    // Apply brightness as CSS custom property
    element.style.setProperty('--brightness-percentage', `${brightness}%`);
    
    // Add brightness class for CSS targeting
    const brightnessClass = `brightness-${Math.round(progress / 10) * 10}`;
    
    // Remove existing brightness classes
    element.classList.remove(...Array.from(element.classList).filter(cls => cls.startsWith('brightness-')));
    
    // Add new brightness class
    element.classList.add(brightnessClass);
    
    // Cache brightness calculation
    this.brightnessCache.set(element, { progress, brightness, isDark: currentIsDark });
  }

  /**
   * Get brightness value for progress
   * @param {number} progress - Progress percentage (0-100)
   * @param {boolean} isDark - Whether theme is dark
   * @returns {number} Brightness percentage
   */
  getBrightnessForProgress(progress, isDark = null) {
    const currentIsDark = isDark !== null ? isDark : this.currentTheme === 'dark';
    
    // Clamp progress between 0 and 100
    progress = Math.max(0, Math.min(100, progress));
    
    if (currentIsDark) {
      return progress;
    } else {
      return 100 - progress;
    }
  }

  /**
   * Update all elements with cached brightness values
   */
  updateAllBrightnessElements() {
    this.brightnessCache.forEach((cache, element) => {
      if (document.contains(element)) {
        this.applyBrightnessLogic(element, cache.progress, this.currentTheme === 'dark');
      } else {
        // Remove stale cache entries
        this.brightnessCache.delete(element);
      }
    });
  }

  /**
   * Clear brightness cache
   */
  clearBrightnessCache() {
    this.brightnessCache.clear();
  }

  /**
   * Get theme-specific CSS custom properties
   * @param {string} themeName - Theme name
   * @returns {Object} CSS custom properties
   */
  getThemeProperties(themeName) {
    const isDark = themeName === 'dark';
    
    return {
      '--bg-primary': isDark ? '#000000' : '#ffffff',
      '--bg-secondary': isDark ? '#171717' : '#f5f5f5',
      '--bg-tertiary': isDark ? '#262626' : '#e5e5e5',
      '--text-primary': isDark ? '#ffffff' : '#000000',
      '--text-secondary': isDark ? '#a3a3a3' : '#525252',
      '--text-muted': isDark ? '#737373' : '#737373',
      '--border-color': isDark ? '#404040' : '#d4d4d4',
      '--shadow-color': isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'
    };
  }

  /**
   * Apply theme properties to document
   * @param {string} themeName - Theme name
   */
  applyThemeProperties(themeName) {
    const properties = this.getThemeProperties(themeName);
    const root = document.documentElement;
    
    Object.entries(properties).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  /**
   * Get contrast color for given background
   * @param {string} backgroundColor - Background color
   * @returns {string} Contrast color (black or white)
   */
  getContrastColor(backgroundColor) {
    // Simple contrast calculation
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Check if theme is dark
   * @returns {boolean} True if current theme is dark
   */
  isDarkTheme() {
    return this.currentTheme === 'dark';
  }

  /**
   * Check if theme is light
   * @returns {boolean} True if current theme is light
   */
  isLightTheme() {
    return this.currentTheme === 'light';
  }

  /**
   * Add theme change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onThemeChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.listeners.push(callback);
    
    // Call immediately with current theme
    callback(this.currentTheme);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify listeners of theme changes
   * @param {string} event - Event type
   * @param {string} themeName - Theme name
   */
  notifyListeners(event, themeName) {
    this.listeners.forEach(callback => {
      try {
        callback(themeName);
      } catch (error) {
        console.error('Error in theme listener:', error);
      }
    });
  }

  /**
   * Check if manager is initialized
   * @returns {boolean} Initialization status
   */
  isManagerInitialized() {
    return this.isInitialized;
  }

  /**
   * Get theme statistics
   * @returns {Object} Theme statistics
   */
  getThemeStats() {
    return {
      currentTheme: this.currentTheme,
      isDark: this.isDarkTheme(),
      isLight: this.isLightTheme(),
      cachedElements: this.brightnessCache.size,
      listeners: this.listeners.length
    };
  }

  /**
   * Reset theme to default
   */
  resetTheme() {
    this.setTheme('dark');
    this.clearBrightnessCache();
  }

  /**
   * Export theme settings
   * @returns {Object} Theme settings
   */
  exportThemeSettings() {
    return {
      theme: this.currentTheme,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Import theme settings
   * @param {Object} settings - Theme settings
   * @returns {boolean} Success status
   */
  importThemeSettings(settings) {
    try {
      if (settings.theme && (settings.theme === 'dark' || settings.theme === 'light')) {
        this.setTheme(settings.theme);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import theme settings:', error);
      return false;
    }
  }
}

// Create global instance
window.ThemeManager = new ThemeManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
