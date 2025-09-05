/**
 * SecBrain - Habit Manager
 * Manages habit data and operations
 */

class HabitManager {
  constructor() {
    this.habits = {};
    this.habitIdCounter = 1;
    this.listeners = [];
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize habit manager
   */
  async init() {
    try {
      // Wait for services to be ready
      await this.waitForServices();
      
      // Load habits from database
      await this.loadHabits();
      
      this.isInitialized = true;
      console.log('HabitManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize HabitManager:', error);
      // Mark as initialized even in error state to prevent app from hanging
      this.isInitialized = true;
      console.log('HabitManager initialized in offline mode');
    }
  }

  /**
   * Wait for required services
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
    
    console.warn('Required services not initialized within timeout, proceeding with offline mode');
    // Don't throw error, just proceed
  }

  /**
   * Load habits from database
   */
  async loadHabits() {
    try {
      const userId = window.AuthService.getUserId();
      if (!userId) return;
      
      const habits = await window.DatabaseService.loadHabits(userId);
      this.habits = habits || {};
      
      // Update ID counter
      this.updateIdCounter();
      
      console.log('Habits loaded:', Object.keys(this.habits).length);
    } catch (error) {
      console.error('Failed to load habits:', error);
      this.habits = {};
    }
  }

  /**
   * Update ID counter based on existing habits
   */
  updateIdCounter() {
    let maxId = 0;
    
    for (const habitId in this.habits) {
      const habit = this.habits[habitId];
      if (habit.id && habit.id > maxId) {
        maxId = habit.id;
      }
    }
    
    this.habitIdCounter = maxId + 1;
  }

  /**
   * Generate unique habit ID
   * @returns {number} Unique habit ID
   */
  generateId() {
    return this.habitIdCounter++;
  }

  /**
   * Add new habit
   * @param {string} name - Habit name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created habit object
   */
  async addHabit(name, options = {}) {
    if (!this.isInitialized) {
      throw new Error('HabitManager not initialized');
    }
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Habit name is required');
    }
    
    const trimmedName = name.trim();
    
    // Check if habit already exists
    if (this.habitExists(trimmedName)) {
      throw new Error('Habit with this name already exists');
    }
    
    try {
      const habitId = this.generateId();
      const habit = {
        id: habitId,
        name: trimmedName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        color: options.color || null,
        description: options.description || '',
        category: options.category || 'general',
        target: options.target || 1, // Daily target
        unit: options.unit || 'times',
        ...options
      };
      
      // Add to local storage
      this.habits[habitId] = habit;
      
      // Save to database
      await this.saveHabits();
      
      // Notify listeners
      this.notifyListeners('habitAdded', habit);
      
      console.log('Habit added:', habit.name);
      return habit;
    } catch (error) {
      console.error('Failed to add habit:', error);
      throw error;
    }
  }

  /**
   * Update existing habit
   * @param {number} habitId - Habit ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated habit object
   */
  async updateHabit(habitId, updates) {
    if (!this.isInitialized) {
      throw new Error('HabitManager not initialized');
    }
    
    if (!this.habits[habitId]) {
      throw new Error('Habit not found');
    }
    
    try {
      const habit = this.habits[habitId];
      const updatedHabit = {
        ...habit,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Validate name if being updated
      if (updates.name) {
        const trimmedName = updates.name.trim();
        if (trimmedName.length === 0) {
          throw new Error('Habit name cannot be empty');
        }
        
        // Check if name already exists (excluding current habit)
        if (this.habitExists(trimmedName, habitId)) {
          throw new Error('Habit with this name already exists');
        }
        
        updatedHabit.name = trimmedName;
      }
      
      // Update local storage
      this.habits[habitId] = updatedHabit;
      
      // Save to database
      await this.saveHabits();
      
      // Notify listeners
      this.notifyListeners('habitUpdated', updatedHabit);
      
      console.log('Habit updated:', updatedHabit.name);
      return updatedHabit;
    } catch (error) {
      console.error('Failed to update habit:', error);
      throw error;
    }
  }

  /**
   * Remove habit
   * @param {number} habitId - Habit ID
   * @returns {Promise<boolean>} Success status
   */
  async removeHabit(habitId) {
    if (!this.isInitialized) {
      throw new Error('HabitManager not initialized');
    }
    
    if (!this.habits[habitId]) {
      throw new Error('Habit not found');
    }
    
    try {
      const habit = this.habits[habitId];
      
      // Remove from local storage
      delete this.habits[habitId];
      
      // Save to database
      await this.saveHabits();
      
      // Notify listeners
      this.notifyListeners('habitRemoved', habit);
      
      console.log('Habit removed:', habit.name);
      return true;
    } catch (error) {
      console.error('Failed to remove habit:', error);
      throw error;
    }
  }

  /**
   * Get habit by ID
   * @param {number} habitId - Habit ID
   * @returns {Object|null} Habit object or null
   */
  getHabit(habitId) {
    return this.habits[habitId] || null;
  }

  /**
   * Get all habits
   * @returns {Object} All habits object
   */
  getHabits() {
    return { ...this.habits };
  }

  /**
   * Get active habits
   * @returns {Array} Array of active habits
   */
  getActiveHabits() {
    return Object.values(this.habits).filter(habit => habit.isActive);
  }

  /**
   * Get habits by category
   * @param {string} category - Category name
   * @returns {Array} Array of habits in category
   */
  getHabitsByCategory(category) {
    return Object.values(this.habits).filter(habit => habit.category === category);
  }

  /**
   * Check if habit exists
   * @param {string} name - Habit name
   * @param {number} excludeId - Habit ID to exclude from check
   * @returns {boolean} True if habit exists
   */
  habitExists(name, excludeId = null) {
    const trimmedName = name.trim().toLowerCase();
    
    for (const habitId in this.habits) {
      if (excludeId && parseInt(habitId) === excludeId) continue;
      
      const habit = this.habits[habitId];
      if (habit.name.toLowerCase() === trimmedName) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Toggle habit active status
   * @param {number} habitId - Habit ID
   * @returns {Promise<Object>} Updated habit object
   */
  async toggleHabitActive(habitId) {
    const habit = this.getHabit(habitId);
    if (!habit) {
      throw new Error('Habit not found');
    }
    
    return await this.updateHabit(habitId, { isActive: !habit.isActive });
  }

  /**
   * Get habit statistics
   * @param {number} habitId - Habit ID
   * @returns {Object} Habit statistics
   */
  getHabitStats(habitId) {
    const habit = this.getHabit(habitId);
    if (!habit) return null;
    
    const createdAt = new Date(habit.createdAt);
    const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      id: habit.id,
      name: habit.name,
      createdAt: habit.createdAt,
      daysSinceCreation,
      isActive: habit.isActive,
      category: habit.category,
      target: habit.target,
      unit: habit.unit
    };
  }

  /**
   * Get all habit categories
   * @returns {Array} Array of unique categories
   */
  getCategories() {
    const categories = new Set();
    
    Object.values(this.habits).forEach(habit => {
      if (habit.category) {
        categories.add(habit.category);
      }
    });
    
    return Array.from(categories).sort();
  }

  /**
   * Search habits
   * @param {string} query - Search query
   * @returns {Array} Array of matching habits
   */
  searchHabits(query) {
    if (!query || typeof query !== 'string') {
      return Object.values(this.habits);
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    return Object.values(this.habits).filter(habit => {
      return habit.name.toLowerCase().includes(searchTerm) ||
             (habit.description && habit.description.toLowerCase().includes(searchTerm)) ||
             (habit.category && habit.category.toLowerCase().includes(searchTerm));
    });
  }

  /**
   * Save habits to database
   * @returns {Promise<boolean>} Success status
   */
  async saveHabits() {
    try {
      const userId = window.AuthService.getUserId();
      if (!userId) {
        console.warn('No user ID for saving habits');
        return false;
      }
      
      await window.DatabaseService.saveHabits(userId, this.habits);
      return true;
    } catch (error) {
      console.error('Failed to save habits:', error);
      return false;
    }
  }

  /**
   * Add habit change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onHabitChange(callback) {
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
   * Notify listeners of habit changes
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in habit listener:', error);
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
   * Get habit count
   * @returns {number} Number of habits
   */
  getHabitCount() {
    return Object.keys(this.habits).length;
  }

  /**
   * Get active habit count
   * @returns {number} Number of active habits
   */
  getActiveHabitCount() {
    return this.getActiveHabits().length;
  }

  /**
   * Clear all habits
   * @returns {Promise<boolean>} Success status
   */
  async clearAllHabits() {
    try {
      this.habits = {};
      await this.saveHabits();
      
      this.notifyListeners('habitsCleared', null);
      
      console.log('All habits cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear habits:', error);
      return false;
    }
  }

  /**
   * Export habits data
   * @returns {Object} Exported habits data
   */
  exportHabits() {
    return {
      habits: this.habits,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Import habits data
   * @param {Object} data - Imported habits data
   * @returns {Promise<boolean>} Success status
   */
  async importHabits(data) {
    try {
      if (!data.habits || typeof data.habits !== 'object') {
        throw new Error('Invalid habits data format');
      }
      
      // Merge with existing habits
      for (const habitId in data.habits) {
        const importedHabit = data.habits[habitId];
        
        // Generate new ID to avoid conflicts
        const newId = this.generateId();
        importedHabit.id = newId;
        importedHabit.updatedAt = new Date().toISOString();
        
        this.habits[newId] = importedHabit;
      }
      
      await this.saveHabits();
      
      this.notifyListeners('habitsImported', data.habits);
      
      console.log('Habits imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import habits:', error);
      return false;
    }
  }
}

// Create global instance
window.HabitManager = new HabitManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HabitManager;
}
