/**
 * SecBrain - Date Utilities
 * Helper functions for date manipulation and formatting
 */

class DateUtils {
  /**
   * Get current date in YYYY-MM-DD format
   * @returns {string} Current date string
   */
  static getCurrentDateString() {
    const now = new Date();
    return this.formatDateString(now);
  }

  /**
   * Format date to YYYY-MM-DD string
   * @param {Date} date - Date object to format
   * @returns {string} Formatted date string
   */
  static formatDateString(date) {
    if (!date || !(date instanceof Date)) {
      throw new Error('Invalid date provided');
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse date string to Date object
   * @param {string} dateString - Date string in YYYY-MM-DD format
   * @returns {Date} Date object
   */
  static parseDateString(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      throw new Error('Invalid date string provided');
    }
    
    const date = new Date(dateString + 'T00:00:00');
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date string format');
    }
    
    return date;
  }

  /**
   * Get start of month for given date
   * @param {Date} date - Date object
   * @returns {Date} Start of month date
   */
  static getStartOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * Get end of month for given date
   * @param {Date} date - Date object
   * @returns {Date} End of month date
   */
  static getEndOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  /**
   * Get first day of week for given date (Sunday = 0)
   * @param {Date} date - Date object
   * @returns {number} Day of week (0-6)
   */
  static getFirstDayOfWeek(date) {
    const firstDay = this.getStartOfMonth(date);
    return firstDay.getDay();
  }

  /**
   * Get number of days in month
   * @param {Date} date - Date object
   * @returns {number} Number of days in month
   */
  static getDaysInMonth(date) {
    return this.getEndOfMonth(date).getDate();
  }

  /**
   * Add days to date
   * @param {Date} date - Date object
   * @param {number} days - Number of days to add
   * @returns {Date} New date object
   */
  static addDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }

  /**
   * Add months to date
   * @param {Date} date - Date object
   * @param {number} months - Number of months to add
   * @returns {Date} New date object
   */
  static addMonths(date, months) {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
  }

  /**
   * Check if two dates are the same day
   * @param {Date} date1 - First date
   * @param {Date} date2 - Second date
   * @returns {boolean} True if same day
   */
  static isSameDay(date1, date2) {
    if (!date1 || !date2) return false;
    
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Check if date is today
   * @param {Date} date - Date to check
   * @returns {boolean} True if date is today
   */
  static isToday(date) {
    return this.isSameDay(date, new Date());
  }

  /**
   * Check if date is in current month
   * @param {Date} date - Date to check
   * @param {Date} currentMonth - Current month date
   * @returns {boolean} True if date is in current month
   */
  static isInCurrentMonth(date, currentMonth) {
    if (!date || !currentMonth) return false;
    
    return date.getFullYear() === currentMonth.getFullYear() &&
           date.getMonth() === currentMonth.getMonth();
  }

  /**
   * Get month name
   * @param {Date} date - Date object
   * @param {string} locale - Locale string (default: 'en-US')
   * @returns {string} Month name
   */
  static getMonthName(date, locale = 'en-US') {
    return date.toLocaleDateString(locale, { month: 'long' });
  }

  /**
   * Get year
   * @param {Date} date - Date object
   * @returns {number} Year
   */
  static getYear(date) {
    return date.getFullYear();
  }

  /**
   * Get month and year string
   * @param {Date} date - Date object
   * @param {string} locale - Locale string (default: 'en-US')
   * @returns {string} Month and year string
   */
  static getMonthYearString(date, locale = 'en-US') {
    const month = this.getMonthName(date, locale);
    const year = this.getYear(date);
    return `${month} ${year}`;
  }

  /**
   * Get day of week name
   * @param {Date} date - Date object
   * @param {string} locale - Locale string (default: 'en-US')
   * @returns {string} Day of week name
   */
  static getDayOfWeekName(date, locale = 'en-US') {
    return date.toLocaleDateString(locale, { weekday: 'long' });
  }

  /**
   * Get short day of week name
   * @param {Date} date - Date object
   * @param {string} locale - Locale string (default: 'en-US')
   * @returns {string} Short day of week name
   */
  static getShortDayOfWeekName(date, locale = 'en-US') {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }

  /**
   * Get calendar days for month
   * @param {Date} monthDate - Date object representing the month
   * @returns {Array} Array of calendar day objects
   */
  static getCalendarDays(monthDate) {
    const startOfMonth = this.getStartOfMonth(monthDate);
    const endOfMonth = this.getEndOfMonth(monthDate);
    const firstDayOfWeek = this.getFirstDayOfWeek(monthDate);
    const daysInMonth = this.getDaysInMonth(monthDate);
    
    const calendarDays = [];
    
    // Add days from previous month
    const prevMonth = this.addMonths(monthDate, -1);
    const daysInPrevMonth = this.getDaysInMonth(prevMonth);
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), day);
      calendarDays.push({
        date,
        dateString: this.formatDateString(date),
        day,
        isCurrentMonth: false,
        isToday: this.isToday(date),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    
    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      calendarDays.push({
        date,
        dateString: this.formatDateString(date),
        day,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - calendarDays.length; // 6 weeks * 7 days
    const nextMonth = this.addMonths(monthDate, 1);
    
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);
      calendarDays.push({
        date,
        dateString: this.formatDateString(date),
        day,
        isCurrentMonth: false,
        isToday: this.isToday(date),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    
    return calendarDays;
  }

  /**
   * Get week days for calendar header
   * @param {string} locale - Locale string (default: 'en-US')
   * @returns {Array} Array of week day names
   */
  static getWeekDays(locale = 'en-US') {
    const weekDays = [];
    const today = new Date();
    
    // Start from Sunday (0)
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + i);
      weekDays.push({
        short: this.getShortDayOfWeekName(date, locale),
        long: this.getDayOfWeekName(date, locale),
        dayOfWeek: i
      });
    }
    
    return weekDays;
  }

  /**
   * Get relative date string (Today, Yesterday, Tomorrow, or date)
   * @param {Date} date - Date object
   * @returns {string} Relative date string
   */
  static getRelativeDateString(date) {
    if (!date) return '';
    
    const today = new Date();
    const yesterday = this.addDays(today, -1);
    const tomorrow = this.addDays(today, 1);
    
    if (this.isSameDay(date, today)) {
      return 'Today';
    } else if (this.isSameDay(date, yesterday)) {
      return 'Yesterday';
    } else if (this.isSameDay(date, tomorrow)) {
      return 'Tomorrow';
    } else {
      return this.formatDateString(date);
    }
  }

  /**
   * Get date range string
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} locale - Locale string (default: 'en-US')
   * @returns {string} Date range string
   */
  static getDateRangeString(startDate, endDate, locale = 'en-US') {
    if (!startDate || !endDate) return '';
    
    if (this.isSameDay(startDate, endDate)) {
      return this.formatDateString(startDate);
    }
    
    const startStr = startDate.toLocaleDateString(locale, { 
      month: 'short', 
      day: 'numeric' 
    });
    const endStr = endDate.toLocaleDateString(locale, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${startStr} - ${endStr}`;
  }

  /**
   * Validate date string format
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid format
   */
  static isValidDateString(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;
    
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    try {
      const date = this.parseDateString(dateString);
      return date instanceof Date && !isNaN(date.getTime());
    } catch (error) {
      return false;
    }
  }

  /**
   * Get timezone offset in minutes
   * @returns {number} Timezone offset in minutes
   */
  static getTimezoneOffset() {
    return new Date().getTimezoneOffset();
  }

  /**
   * Convert date to UTC
   * @param {Date} date - Date object
   * @returns {Date} UTC date object
   */
  static toUTC(date) {
    return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
  }

  /**
   * Convert UTC date to local time
   * @param {Date} utcDate - UTC date object
   * @returns {Date} Local date object
   */
  static fromUTC(utcDate) {
    return new Date(utcDate.getTime() - (utcDate.getTimezoneOffset() * 60000));
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DateUtils;
}

// Make available globally
window.DateUtils = DateUtils;
