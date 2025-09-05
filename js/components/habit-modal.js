/**
 * SecBrain - Habit Modal Component
 * Handles habit modal display and interactions
 */

class HabitModal {
  constructor() {
    this.modal = null;
    this.modalOverlay = null;
    this.modalContent = null;
    this.modalTitle = null;
    this.closeButton = null;
    this.habitsList = null;
    this.addHabitButton = null;
    this.currentDate = null;
    this.isInitialized = false;
    this.listeners = [];
    
    this.init();
  }

  /**
   * Initialize habit modal component
   */
  init() {
    try {
      this.setupElements();
      this.setupEventListeners();
      this.isInitialized = true;
      
      console.log('HabitModal initialized successfully');
    } catch (error) {
      console.error('Failed to initialize HabitModal:', error);
      // Mark as initialized even in error state to prevent app from hanging
      this.isInitialized = true;
      console.log('HabitModal initialized in offline mode');
    }
  }

  /**
   * Set up DOM elements
   */
  setupElements() {
    this.modal = document.getElementById('habit-modal');
    this.modalOverlay = this.modal?.querySelector('.modal__overlay');
    this.modalContent = this.modal?.querySelector('.modal__content');
    this.modalTitle = this.modal?.querySelector('#modal-title');
    this.closeButton = this.modal?.querySelector('#close-modal');
    this.habitsList = this.modal?.querySelector('#modal-habits');
    this.addHabitButton = this.modal?.querySelector('#add-habit-btn');
    
    if (!this.modal || !this.modalOverlay || !this.modalContent || 
        !this.modalTitle || !this.closeButton || !this.habitsList || !this.addHabitButton) {
      console.warn('Some modal elements not found, continuing with available elements');
      // Don't throw error, just log warning
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Close button
    this.closeButton.addEventListener('click', () => {
      this.closeModal();
    });
    
    // Overlay click
    this.modalOverlay.addEventListener('click', () => {
      this.closeModal();
    });
    
    // Add habit button
    this.addHabitButton.addEventListener('click', () => {
      this.showHabitForm();
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (this.isModalOpen() && e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  /**
   * Open modal for specific date
   * @param {string} dateString - Date string (YYYY-MM-DD)
   */
  openModal(dateString) {
    if (!this.isInitialized) {
      console.error('HabitModal not initialized');
      return;
    }
    
    try {
      this.currentDate = dateString;
      this.updateModalTitle(dateString);
      this.populateHabits(dateString);
      this.showModal();
      
      // Notify listeners
      this.notifyListeners('modalOpened', { dateString });
      
      console.log('Modal opened for date:', dateString);
    } catch (error) {
      console.error('Failed to open modal:', error);
    }
  }

  /**
   * Close modal
   */
  closeModal() {
    if (!this.isInitialized) return;
    
    try {
      this.hideModal();
      this.currentDate = null;
      
      // Notify listeners
      this.notifyListeners('modalClosed', {});
      
      console.log('Modal closed');
    } catch (error) {
      console.error('Failed to close modal:', error);
    }
  }

  /**
   * Show modal
   */
  showModal() {
    this.modal.classList.remove('hidden');
    
    // Focus management
    this.modalContent.focus();
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide modal
   */
  hideModal() {
    this.modal.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Check if modal is open
   * @returns {boolean} True if modal is open
   */
  isModalOpen() {
    return !this.modal.classList.contains('hidden');
  }

  /**
   * Update modal title
   * @param {string} dateString - Date string
   */
  updateModalTitle(dateString) {
    try {
      const date = DateUtils.parseDateString(dateString);
      const relativeDate = DateUtils.getRelativeDateString(date);
      
      this.modalTitle.textContent = `Habits for ${relativeDate}`;
    } catch (error) {
      console.error('Failed to update modal title:', error);
      this.modalTitle.textContent = 'Habits for Today';
    }
  }

  /**
   * Populate habits in modal
   * @param {string} dateString - Date string
   */
  populateHabits(dateString) {
    try {
      // Clear existing habits
      this.habitsList.innerHTML = '';
      
      // Get habits
      const habits = window.HabitManager ? window.HabitManager.getActiveHabits() : [];
      
      if (habits.length === 0) {
        this.showEmptyState();
        return;
      }
      
      // Create habit items
      habits.forEach(habit => {
        const habitItem = this.createHabitItem(habit, dateString);
        this.habitsList.appendChild(habitItem);
      });
      
      // Update progress display
      this.updateProgressDisplay(dateString, habits);
    } catch (error) {
      console.error('Failed to populate habits:', error);
      this.showErrorState();
    }
  }

  /**
   * Create habit item element
   * @param {Object} habit - Habit object
   * @param {string} dateString - Date string
   * @returns {HTMLElement} Habit item element
   */
  createHabitItem(habit, dateString) {
    const habitItem = document.createElement('div');
    habitItem.className = 'habit-item';
    habitItem.dataset.habitId = habit.id;
    
    // Get current progress
    const currentProgress = window.ProgressManager ? 
      window.ProgressManager.getHabitProgress(dateString, habit.id) : null;
    
    const isCompleted = window.ProgressManager ? 
      window.ProgressManager.isHabitCompleted(currentProgress) : false;
    
    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'habit-checkbox';
    checkbox.checked = isCompleted;
    checkbox.setAttribute('aria-label', `Mark ${habit.name} as ${isCompleted ? 'incomplete' : 'complete'}`);
    
    // Create habit info
    const habitInfo = document.createElement('div');
    habitInfo.className = 'habit-info';
    
    const habitName = document.createElement('h4');
    habitName.className = 'habit-name';
    habitName.textContent = habit.name;
    
    const habitStreak = document.createElement('p');
    habitStreak.className = 'habit-streak';
    
    // Get streak information
    const streak = window.ProgressManager ? 
      window.ProgressManager.getHabitStreak(habit.id, dateString) : 0;
    
    habitStreak.textContent = `${streak} day streak`;
    
    habitInfo.appendChild(habitName);
    habitInfo.appendChild(habitStreak);
    
    // Create progress section
    const progressSection = this.createProgressSection(habit, dateString, currentProgress);
    
    // Assemble habit item
    habitItem.appendChild(checkbox);
    habitItem.appendChild(habitInfo);
    habitItem.appendChild(progressSection);
    
    // Add event listeners
    checkbox.addEventListener('change', () => {
      this.toggleHabit(habit.id, dateString, checkbox.checked);
    });
    
    return habitItem;
  }

  /**
   * Create progress section
   * @param {Object} habit - Habit object
   * @param {string} dateString - Date string
   * @param {any} currentProgress - Current progress value
   * @returns {HTMLElement} Progress section element
   */
  createProgressSection(habit, dateString, currentProgress) {
    const progressSection = document.createElement('div');
    progressSection.className = 'habit-progress';
    
    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-bar__fill';
    
    // Calculate progress percentage
    let progressPercentage = 0;
    if (currentProgress !== null && currentProgress !== undefined) {
      if (typeof currentProgress === 'boolean') {
        progressPercentage = currentProgress ? 100 : 0;
      } else if (typeof currentProgress === 'number') {
        const target = habit.target || 1;
        progressPercentage = Math.min((currentProgress / target) * 100, 100);
      }
    }
    
    progressFill.style.width = `${progressPercentage}%`;
    progressBar.appendChild(progressFill);
    
    // Progress text
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.textContent = `${Math.round(progressPercentage)}%`;
    
    progressSection.appendChild(progressBar);
    progressSection.appendChild(progressText);
    
    return progressSection;
  }

  /**
   * Toggle habit completion
   * @param {number} habitId - Habit ID
   * @param {string} dateString - Date string
   * @param {boolean} completed - Completion status
   */
  async toggleHabit(habitId, dateString, completed) {
    try {
      if (window.ProgressManager) {
        await window.ProgressManager.setHabitProgress(dateString, habitId, completed);
        
        // Update progress display
        this.updateProgressDisplay(dateString);
        
        // Notify listeners
        this.notifyListeners('habitToggled', {
          habitId,
          dateString,
          completed
        });
        
        console.log(`Habit ${habitId} toggled for ${dateString}:`, completed);
      }
    } catch (error) {
      console.error('Failed to toggle habit:', error);
      
      // Revert checkbox state
      const checkbox = this.habitsList.querySelector(`[data-habit-id="${habitId}"] .habit-checkbox`);
      if (checkbox) {
        checkbox.checked = !completed;
      }
    }
  }

  /**
   * Update progress display
   * @param {string} dateString - Date string
   * @param {Array} habits - Optional habits array
   */
  updateProgressDisplay(dateString, habits = null) {
    try {
      const habitsToUse = habits || (window.HabitManager ? window.HabitManager.getActiveHabits() : []);
      
      if (habitsToUse.length === 0) return;
      
      // Calculate overall progress
      const overallProgress = window.ProgressManager ? 
        window.ProgressManager.calculateProgress(dateString, habitsToUse) : 0;
      
      // Update progress in modal title or add progress indicator
      this.updateModalProgress(overallProgress);
      
      // Update individual habit progress bars
      this.updateHabitProgressBars(dateString, habitsToUse);
    } catch (error) {
      console.error('Failed to update progress display:', error);
    }
  }

  /**
   * Update modal progress indicator
   * @param {number} progress - Progress percentage
   */
  updateModalProgress(progress) {
    // Add or update progress indicator in modal title
    let progressIndicator = this.modalTitle.querySelector('.modal-progress');
    
    if (!progressIndicator) {
      progressIndicator = document.createElement('span');
      progressIndicator.className = 'modal-progress';
      this.modalTitle.appendChild(progressIndicator);
    }
    
    progressIndicator.textContent = ` (${progress}% complete)`;
  }

  /**
   * Update habit progress bars
   * @param {string} dateString - Date string
   * @param {Array} habits - Habits array
   */
  updateHabitProgressBars(dateString, habits) {
    habits.forEach(habit => {
      const habitItem = this.habitsList.querySelector(`[data-habit-id="${habit.id}"]`);
      if (!habitItem) return;
      
      const progressSection = habitItem.querySelector('.habit-progress');
      if (!progressSection) return;
      
      // Get current progress
      const currentProgress = window.ProgressManager ? 
        window.ProgressManager.getHabitProgress(dateString, habit.id) : null;
      
      // Update progress bar
      const progressFill = progressSection.querySelector('.progress-bar__fill');
      const progressText = progressSection.querySelector('.progress-text');
      
      if (progressFill && progressText) {
        let progressPercentage = 0;
        if (currentProgress !== null && currentProgress !== undefined) {
          if (typeof currentProgress === 'boolean') {
            progressPercentage = currentProgress ? 100 : 0;
          } else if (typeof currentProgress === 'number') {
            const target = habit.target || 1;
            progressPercentage = Math.min((currentProgress / target) * 100, 100);
          }
        }
        
        progressFill.style.width = `${progressPercentage}%`;
        progressText.textContent = `${Math.round(progressPercentage)}%`;
      }
    });
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.habitsList.innerHTML = `
      <div class="empty-state">
        <p>No habits found. Add your first habit to start tracking!</p>
      </div>
    `;
  }

  /**
   * Show error state
   */
  showErrorState() {
    this.habitsList.innerHTML = `
      <div class="error-state">
        <p>Failed to load habits. Please try again.</p>
      </div>
    `;
  }

  /**
   * Show habit form
   */
  showHabitForm() {
    // This would integrate with the add habit form component
    // For now, we'll just notify listeners
    this.notifyListeners('showHabitForm', {
      dateString: this.currentDate
    });
  }

  /**
   * Add modal event listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onModalEvent(callback) {
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
   * Notify listeners of modal events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in modal listener:', error);
      }
    });
  }

  /**
   * Check if modal is initialized
   * @returns {boolean} Initialization status
   */
  isModalInitialized() {
    return this.isInitialized;
  }

  /**
   * Get current date
   * @returns {string|null} Current date string
   */
  getCurrentDate() {
    return this.currentDate;
  }

  /**
   * Refresh modal content
   */
  refresh() {
    if (this.currentDate && this.isModalOpen()) {
      this.populateHabits(this.currentDate);
    }
  }

  /**
   * Get modal statistics
   * @returns {Object} Modal statistics
   */
  getModalStats() {
    return {
      isOpen: this.isModalOpen(),
      currentDate: this.currentDate,
      isInitialized: this.isInitialized,
      listeners: this.listeners.length
    };
  }
}

// Create global instance
window.HabitModal = new HabitModal();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HabitModal;
}
