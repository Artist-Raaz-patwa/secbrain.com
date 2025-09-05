/**
 * SecBrain - Progress Manager
 * Manages habit progress tracking and statistics
 */

class ProgressManager {
  constructor() {
    this.progress = {};
    this.listeners = [];
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize progress manager
   */
  async init() {
    try {
      // Wait for services to be ready
      await this.waitForServices();
      
      // Load progress from database
      await this.loadProgress();
      
      this.isInitialized = true;
      console.log('ProgressManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ProgressManager:', error);
      // Mark as initialized even in error state to prevent app from hanging
      this.isInitialized = true;
      console.log('ProgressManager initialized in offline mode');
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
   * Load progress from database
   */
  async loadProgress() {
    try {
      const userId = window.AuthService.getUserId();
      if (!userId) return;
      
      const progress = await window.DatabaseService.loadProgress(userId);
      this.progress = progress || {};
      
      console.log('Progress loaded for', Object.keys(this.progress).length, 'days');
    } catch (error) {
      console.error('Failed to load progress:', error);
      this.progress = {};
    }
  }

  /**
   * Set habit progress for a specific date
   * @param {string} dateString - Date string (YYYY-MM-DD)
   * @param {number} habitId - Habit ID
   * @param {boolean|number} completed - Completion status or count
   * @returns {Promise<boolean>} Success status
   */
  async setHabitProgress(dateString, habitId, completed) {
    if (!this.isInitialized) {
      throw new Error('ProgressManager not initialized');
    }
    
    if (!DateUtils.isValidDateString(dateString)) {
      throw new Error('Invalid date string format');
    }
    
    try {
      // Initialize day progress if it doesn't exist
      if (!this.progress[dateString]) {
        this.progress[dateString] = {};
      }
      
      // Set habit progress
      this.progress[dateString][habitId] = completed;
      
      // Save to database
      await this.saveProgress();
      
      // Notify listeners
      this.notifyListeners('progressUpdated', {
        dateString,
        habitId,
        completed,
        dayProgress: this.progress[dateString]
      });
      
      console.log(`Progress updated for habit ${habitId} on ${dateString}:`, completed);
      return true;
    } catch (error) {
      console.error('Failed to set habit progress:', error);
      throw error;
    }
  }

  /**
   * Get habit progress for a specific date
   * @param {string} dateString - Date string (YYYY-MM-DD)
   * @param {number} habitId - Habit ID
   * @returns {boolean|number|null} Progress value or null if not found
   */
  getHabitProgress(dateString, habitId) {
    if (!this.progress[dateString]) {
      return null;
    }
    
    return this.progress[dateString][habitId] || null;
  }

  /**
   * Get all progress for a specific date
   * @param {string} dateString - Date string (YYYY-MM-DD)
   * @returns {Object} Day progress object
   */
  getDayProgress(dateString) {
    return this.progress[dateString] || {};
  }

  /**
   * Calculate progress percentage for a date
   * @param {string} dateString - Date string (YYYY-MM-DD)
   * @param {Array} habits - Array of habit objects
   * @returns {number} Progress percentage (0-100)
   */
  calculateProgress(dateString, habits) {
    if (!habits || habits.length === 0) {
      return 0;
    }
    
    const dayProgress = this.getDayProgress(dateString);
    let completedCount = 0;
    let totalCount = 0;
    
    habits.forEach(habit => {
      if (!habit.isActive) return;
      
      const progress = dayProgress[habit.id];
      const target = habit.target || 1;
      
      if (progress !== null && progress !== undefined) {
        if (typeof progress === 'boolean') {
          if (progress) {
            completedCount += target;
          }
        } else if (typeof progress === 'number') {
          completedCount += Math.min(progress, target);
        }
      }
      
      totalCount += target;
    });
    
    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  }

  /**
   * Get habit streak
   * @param {number} habitId - Habit ID
   * @param {string} endDate - End date string (YYYY-MM-DD)
   * @returns {number} Streak count
   */
  getHabitStreak(habitId, endDate = null) {
    const targetDate = endDate ? DateUtils.parseDateString(endDate) : new Date();
    let streak = 0;
    let currentDate = new Date(targetDate);
    
    while (true) {
      const dateString = DateUtils.formatDateString(currentDate);
      const progress = this.getHabitProgress(dateString, habitId);
      
      // Check if habit was completed
      const isCompleted = this.isHabitCompleted(progress);
      
      if (isCompleted) {
        streak++;
        currentDate = DateUtils.addDays(currentDate, -1);
      } else {
        break;
      }
    }
    
    return streak;
  }

  /**
   * Check if habit is completed
   * @param {boolean|number} progress - Progress value
   * @returns {boolean} True if completed
   */
  isHabitCompleted(progress) {
    if (progress === null || progress === undefined) {
      return false;
    }
    
    if (typeof progress === 'boolean') {
      return progress;
    }
    
    if (typeof progress === 'number') {
      return progress > 0;
    }
    
    return false;
  }

  /**
   * Get habit completion rate
   * @param {number} habitId - Habit ID
   * @param {number} days - Number of days to check
   * @returns {number} Completion rate (0-100)
   */
  getHabitCompletionRate(habitId, days = 30) {
    const endDate = new Date();
    const startDate = DateUtils.addDays(endDate, -days);
    
    let completedDays = 0;
    let totalDays = 0;
    
    for (let i = 0; i < days; i++) {
      const currentDate = DateUtils.addDays(startDate, i);
      const dateString = DateUtils.formatDateString(currentDate);
      const progress = this.getHabitProgress(dateString, habitId);
      
      totalDays++;
      
      if (this.isHabitCompleted(progress)) {
        completedDays++;
      }
    }
    
    return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
  }

  /**
   * Get progress statistics for a date range
   * @param {string} startDate - Start date string (YYYY-MM-DD)
   * @param {string} endDate - End date string (YYYY-MM-DD)
   * @param {Array} habits - Array of habit objects
   * @returns {Object} Progress statistics
   */
  getProgressStats(startDate, endDate, habits) {
    const start = DateUtils.parseDateString(startDate);
    const end = DateUtils.parseDateString(endDate);
    
    const stats = {
      totalDays: 0,
      completedDays: 0,
      averageProgress: 0,
      bestDay: null,
      worstDay: null,
      habitStats: {}
    };
    
    let totalProgress = 0;
    let bestProgress = -1;
    let worstProgress = 101;
    
    // Initialize habit stats
    habits.forEach(habit => {
      stats.habitStats[habit.id] = {
        name: habit.name,
        completedDays: 0,
        totalDays: 0,
        completionRate: 0,
        currentStreak: 0
      };
    });
    
    // Calculate stats for each day
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateString = DateUtils.formatDateString(currentDate);
      const dayProgress = this.calculateProgress(dateString, habits);
      
      stats.totalDays++;
      totalProgress += dayProgress;
      
      if (dayProgress === 100) {
        stats.completedDays++;
      }
      
      // Track best and worst days
      if (dayProgress > bestProgress) {
        bestProgress = dayProgress;
        stats.bestDay = {
          date: dateString,
          progress: dayProgress
        };
      }
      
      if (dayProgress < worstProgress) {
        worstProgress = dayProgress;
        stats.worstDay = {
          date: dateString,
          progress: dayProgress
        };
      }
      
      // Update habit stats
      habits.forEach(habit => {
        if (!habit.isActive) return;
        
        const habitProgress = this.getHabitProgress(dateString, habit.id);
        const isCompleted = this.isHabitCompleted(habitProgress);
        
        stats.habitStats[habit.id].totalDays++;
        
        if (isCompleted) {
          stats.habitStats[habit.id].completedDays++;
        }
      });
      
      currentDate = DateUtils.addDays(currentDate, 1);
    }
    
    // Calculate averages and rates
    stats.averageProgress = stats.totalDays > 0 ? Math.round(totalProgress / stats.totalDays) : 0;
    
    habits.forEach(habit => {
      const habitStat = stats.habitStats[habit.id];
      habitStat.completionRate = habitStat.totalDays > 0 ? 
        Math.round((habitStat.completedDays / habitStat.totalDays) * 100) : 0;
      habitStat.currentStreak = this.getHabitStreak(habit.id);
    });
    
    return stats;
  }

  /**
   * Get monthly progress summary
   * @param {Date} monthDate - Date representing the month
   * @param {Array} habits - Array of habit objects
   * @returns {Object} Monthly progress summary
   */
  getMonthlyProgress(monthDate, habits) {
    const startOfMonth = DateUtils.getStartOfMonth(monthDate);
    const endOfMonth = DateUtils.getEndOfMonth(monthDate);
    
    const startDateString = DateUtils.formatDateString(startOfMonth);
    const endDateString = DateUtils.formatDateString(endOfMonth);
    
    return this.getProgressStats(startDateString, endDateString, habits);
  }

  /**
   * Get weekly progress summary
   * @param {Date} weekDate - Date representing the week
   * @param {Array} habits - Array of habit objects
   * @returns {Object} Weekly progress summary
   */
  getWeeklyProgress(weekDate, habits) {
    const startOfWeek = new Date(weekDate);
    startOfWeek.setDate(weekDate.getDate() - weekDate.getDay());
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startDateString = DateUtils.formatDateString(startOfWeek);
    const endDateString = DateUtils.formatDateString(endOfWeek);
    
    return this.getProgressStats(startDateString, endDateString, habits);
  }

  /**
   * Clear progress for a specific date
   * @param {string} dateString - Date string (YYYY-MM-DD)
   * @returns {Promise<boolean>} Success status
   */
  async clearDayProgress(dateString) {
    if (!this.isInitialized) {
      throw new Error('ProgressManager not initialized');
    }
    
    try {
      if (this.progress[dateString]) {
        delete this.progress[dateString];
        await this.saveProgress();
        
        this.notifyListeners('progressCleared', { dateString });
        
        console.log(`Progress cleared for ${dateString}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to clear day progress:', error);
      throw error;
    }
  }

  /**
   * Clear all progress
   * @returns {Promise<boolean>} Success status
   */
  async clearAllProgress() {
    try {
      this.progress = {};
      await this.saveProgress();
      
      this.notifyListeners('progressCleared', { all: true });
      
      console.log('All progress cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear all progress:', error);
      return false;
    }
  }

  /**
   * Save progress to database
   * @returns {Promise<boolean>} Success status
   */
  async saveProgress() {
    try {
      const userId = window.AuthService.getUserId();
      if (!userId) {
        console.warn('No user ID for saving progress');
        return false;
      }
      
      await window.DatabaseService.saveProgress(userId, this.progress);
      return true;
    } catch (error) {
      console.error('Failed to save progress:', error);
      return false;
    }
  }

  /**
   * Add progress change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onProgressChange(callback) {
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
   * Notify listeners of progress changes
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in progress listener:', error);
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
   * Get total progress entries
   * @returns {number} Number of progress entries
   */
  getProgressCount() {
    return Object.keys(this.progress).length;
  }

  /**
   * Export progress data
   * @returns {Object} Exported progress data
   */
  exportProgress() {
    return {
      progress: this.progress,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Import progress data
   * @param {Object} data - Imported progress data
   * @returns {Promise<boolean>} Success status
   */
  async importProgress(data) {
    try {
      if (!data.progress || typeof data.progress !== 'object') {
        throw new Error('Invalid progress data format');
      }
      
      this.progress = { ...this.progress, ...data.progress };
      await this.saveProgress();
      
      this.notifyListeners('progressImported', data.progress);
      
      console.log('Progress imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import progress:', error);
      return false;
    }
  }
}

// Create global instance
window.ProgressManager = new ProgressManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressManager;
}
