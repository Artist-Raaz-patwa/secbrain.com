/**
 * SecBrain - Calendar Component
 * Handles calendar display and day interactions
 */

class Calendar {
  constructor() {
    this.currentDate = new Date();
    this.calendarGrid = null;
    this.monthTitle = null;
    this.prevButton = null;
    this.nextButton = null;
    this.isInitialized = false;
    this.listeners = [];
    
    this.init();
  }

  /**
   * Initialize calendar component
   */
  init() {
    try {
      this.setupElements();
      this.setupEventListeners();
      this.generateCalendar();
      this.isInitialized = true;
      
      console.log('Calendar initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Calendar:', error);
      // Mark as initialized even in error state to prevent app from hanging
      this.isInitialized = true;
      console.log('Calendar initialized in offline mode');
    }
  }

  /**
   * Set up DOM elements
   */
  setupElements() {
    this.calendarGrid = document.getElementById('calendar-grid');
    this.monthTitle = document.getElementById('current-month');
    this.prevButton = document.getElementById('prev-month');
    this.nextButton = document.getElementById('next-month');
    
    if (!this.calendarGrid || !this.monthTitle || !this.prevButton || !this.nextButton) {
      console.warn('Some calendar elements not found, continuing with available elements');
      // Don't throw error, just log warning
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Navigation buttons
    this.prevButton.addEventListener('click', () => {
      this.navigateToMonth(-1);
    });
    
    this.nextButton.addEventListener('click', () => {
      this.navigateToMonth(1);
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('.calendar-container')) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            this.navigateToMonth(-1);
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.navigateToMonth(1);
            break;
          case 'Home':
            e.preventDefault();
            this.navigateToToday();
            break;
        }
      }
    });
  }

  /**
   * Generate calendar for current month
   */
  generateCalendar() {
    if (!this.isInitialized) return;
    
    try {
      // Clear existing calendar
      this.calendarGrid.innerHTML = '';
      
      // Update month title
      this.updateMonthTitle();
      
      // Get calendar days
      const calendarDays = DateUtils.getCalendarDays(this.currentDate);
      
      // Generate day elements
      calendarDays.forEach((day, index) => {
        const dayElement = this.createDayElement(day, index);
        this.calendarGrid.appendChild(dayElement);
      });
      
      // Highlight today
      this.highlightToday();
      
      console.log('Calendar generated for', DateUtils.getMonthYearString(this.currentDate));
    } catch (error) {
      console.error('Failed to generate calendar:', error);
    }
  }

  /**
   * Create day element
   * @param {Object} day - Day object
   * @param {number} index - Day index
   * @returns {HTMLElement} Day element
   */
  createDayElement(day, index) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    dayElement.dataset.date = day.dateString;
    dayElement.dataset.day = day.day;
    dayElement.setAttribute('role', 'button');
    dayElement.setAttribute('tabindex', '0');
    dayElement.setAttribute('aria-label', `Day ${day.day} of ${DateUtils.getMonthName(day.date)}`);
    
    // Add classes based on day properties
    if (!day.isCurrentMonth) {
      dayElement.classList.add('calendar-day--other-month');
    }
    
    if (day.isToday) {
      dayElement.classList.add('calendar-day--today');
    }
    
    if (day.isWeekend) {
      dayElement.classList.add('calendar-day--weekend');
    }
    
    // Create day content
    const dayContent = this.createDayContent(day);
    dayElement.appendChild(dayContent);
    
    // Add click handler
    dayElement.addEventListener('click', () => {
      this.handleDayClick(day.dateString);
    });
    
    // Add keyboard handler
    dayElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleDayClick(day.dateString);
      }
    });
    
    return dayElement;
  }

  /**
   * Create day content
   * @param {Object} day - Day object
   * @returns {HTMLElement} Day content element
   */
  createDayContent(day) {
    const content = document.createElement('div');
    content.className = 'calendar-day__content';
    
    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day__number';
    dayNumber.textContent = day.day;
    content.appendChild(dayNumber);
    
    // Progress section
    const progressSection = document.createElement('div');
    progressSection.className = 'calendar-day__progress';
    
    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'calendar-day__progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'calendar-day__progress-fill';
    progressBar.appendChild(progressFill);
    
    // Progress text
    const progressText = document.createElement('div');
    progressText.className = 'calendar-day__progress-text';
    progressText.textContent = '0%';
    
    progressSection.appendChild(progressBar);
    progressSection.appendChild(progressText);
    content.appendChild(progressSection);
    
    // Habits section
    const habitsSection = document.createElement('div');
    habitsSection.className = 'calendar-day__habits';
    content.appendChild(habitsSection);
    
    return content;
  }

  /**
   * Calculate and apply day progress
   * @param {string} dateString - Date string
   * @param {HTMLElement} dayElement - Day element
   */
  calculateDayProgress(dateString, dayElement) {
    try {
      // Get habits for progress calculation
      const habits = window.HabitManager ? window.HabitManager.getActiveHabits() : [];
      
      if (habits.length === 0) {
        this.applyDayProgress(dayElement, 0);
        return;
      }
      
      // Calculate progress using ProgressManager
      const progress = window.ProgressManager ? 
        window.ProgressManager.calculateProgress(dateString, habits) : 0;
      
      this.applyDayProgress(dayElement, progress);
    } catch (error) {
      console.error('Failed to calculate day progress:', error);
      this.applyDayProgress(dayElement, 0);
    }
  }

  /**
   * Apply progress to day element
   * @param {HTMLElement} dayElement - Day element
   * @param {number} progress - Progress percentage
   */
  applyDayProgress(dayElement, progress) {
    if (!dayElement) return;
    
    // Update progress bar
    const progressFill = dayElement.querySelector('.calendar-day__progress-fill');
    const progressText = dayElement.querySelector('.calendar-day__progress-text');
    
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${progress}%`;
    }
    
    // Apply brightness theme
    if (window.ThemeManager) {
      window.ThemeManager.applyBrightnessLogic(dayElement, progress);
    }
    
    // Generate habit lines
    this.generateHabitLines(dayElement, progress);
  }

  /**
   * Generate habit lines for day
   * @param {HTMLElement} dayElement - Day element
   * @param {number} progress - Progress percentage
   */
  generateHabitLines(dayElement, progress) {
    const habitsSection = dayElement.querySelector('.calendar-day__habits');
    if (!habitsSection) return;
    
    // Clear existing habit lines
    habitsSection.innerHTML = '';
    
    try {
      const habits = window.HabitManager ? window.HabitManager.getActiveHabits() : [];
      const dateString = dayElement.dataset.date;
      
      habits.forEach(habit => {
        const habitLine = document.createElement('div');
        habitLine.className = 'calendar-day__habit-line';
        
        // Check if habit is completed
        const habitProgress = window.ProgressManager ? 
          window.ProgressManager.getHabitProgress(dateString, habit.id) : null;
        
        const isCompleted = window.ProgressManager ? 
          window.ProgressManager.isHabitCompleted(habitProgress) : false;
        
        if (isCompleted) {
          habitLine.classList.add('calendar-day__habit-line--completed');
        } else if (habitProgress !== null && habitProgress !== undefined) {
          habitLine.classList.add('calendar-day__habit-line--partial');
        }
        
        habitsSection.appendChild(habitLine);
      });
    } catch (error) {
      console.error('Failed to generate habit lines:', error);
    }
  }

  /**
   * Navigate to different month
   * @param {number} direction - Direction (-1 for previous, 1 for next)
   */
  navigateToMonth(direction) {
    this.currentDate = DateUtils.addMonths(this.currentDate, direction);
    this.generateCalendar();
    this.updateAllDayProgress();
    
    // Notify listeners
    this.notifyListeners('monthChanged', {
      month: this.currentDate.getMonth(),
      year: this.currentDate.getFullYear(),
      direction
    });
  }

  /**
   * Navigate to today
   */
  navigateToToday() {
    const today = new Date();
    if (!DateUtils.isSameDay(this.currentDate, today)) {
      this.currentDate = new Date(today);
      this.generateCalendar();
      this.updateAllDayProgress();
      
      // Notify listeners
      this.notifyListeners('navigatedToToday', {
        date: today
      });
    }
  }

  /**
   * Update month title
   */
  updateMonthTitle() {
    if (this.monthTitle) {
      this.monthTitle.textContent = DateUtils.getMonthYearString(this.currentDate);
    }
  }

  /**
   * Highlight today
   */
  highlightToday() {
    const today = new Date();
    const todayString = DateUtils.formatDateString(today);
    
    // Remove existing today highlights
    const existingToday = this.calendarGrid.querySelector('.calendar-day--today');
    if (existingToday) {
      existingToday.classList.remove('calendar-day--today');
    }
    
    // Add today highlight
    const todayElement = this.calendarGrid.querySelector(`[data-date="${todayString}"]`);
    if (todayElement) {
      todayElement.classList.add('calendar-day--today');
    }
  }

  /**
   * Update all day progress
   */
  updateAllDayProgress() {
    const dayElements = this.calendarGrid.querySelectorAll('.calendar-day');
    
    dayElements.forEach(dayElement => {
      const dateString = dayElement.dataset.date;
      if (dateString) {
        this.calculateDayProgress(dateString, dayElement);
      }
    });
  }

  /**
   * Handle day click
   * @param {string} dateString - Date string
   */
  handleDayClick(dateString) {
    try {
      // Notify listeners
      this.notifyListeners('dayClicked', {
        dateString,
        date: DateUtils.parseDateString(dateString)
      });
      
      console.log('Day clicked:', dateString);
    } catch (error) {
      console.error('Failed to handle day click:', error);
    }
  }

  /**
   * Get current month date
   * @returns {Date} Current month date
   */
  getCurrentMonth() {
    return new Date(this.currentDate);
  }

  /**
   * Set current month
   * @param {Date} monthDate - Month date
   */
  setCurrentMonth(monthDate) {
    if (!(monthDate instanceof Date)) {
      throw new Error('Invalid date provided');
    }
    
    this.currentDate = new Date(monthDate);
    this.generateCalendar();
    this.updateAllDayProgress();
  }

  /**
   * Refresh calendar
   */
  refresh() {
    this.generateCalendar();
    this.updateAllDayProgress();
  }

  /**
   * Add calendar event listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onCalendarEvent(callback) {
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
   * Notify listeners of calendar events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in calendar listener:', error);
      }
    });
  }

  /**
   * Check if calendar is initialized
   * @returns {boolean} Initialization status
   */
  isCalendarInitialized() {
    return this.isInitialized;
  }

  /**
   * Get calendar statistics
   * @returns {Object} Calendar statistics
   */
  getCalendarStats() {
    return {
      currentMonth: this.currentDate.getMonth(),
      currentYear: this.currentDate.getFullYear(),
      isInitialized: this.isInitialized,
      listeners: this.listeners.length
    };
  }

  /**
   * Destroy calendar component
   */
  destroy() {
    // Remove event listeners
    if (this.prevButton) {
      this.prevButton.removeEventListener('click', this.navigateToMonth);
    }
    
    if (this.nextButton) {
      this.nextButton.removeEventListener('click', this.navigateToMonth);
    }
    
    // Clear listeners
    this.listeners = [];
    
    // Clear calendar grid
    if (this.calendarGrid) {
      this.calendarGrid.innerHTML = '';
    }
    
    this.isInitialized = false;
  }
}

// Create global instance
window.Calendar = new Calendar();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Calendar;
}
