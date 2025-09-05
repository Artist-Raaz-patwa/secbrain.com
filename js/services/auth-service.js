/**
 * SecBrain - Authentication Service
 * Handles Google Authentication with Firebase
 */

class AuthService {
  constructor() {
    this.auth = null;
    this.currentUser = null;
    this.authStateListeners = [];
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize authentication service
   */
  async init() {
    try {
      if (window.FirebaseConfig && window.FirebaseConfig.auth) {
        this.auth = window.FirebaseConfig.auth;
        this.setupAuthStateListener();
        this.isInitialized = true;
        console.log('AuthService initialized successfully with Firebase project:', window.FirebaseConfig.config?.projectId);
      } else {
        console.error('Firebase Auth not available');
        throw new Error('Firebase Auth not available');
      }
    } catch (error) {
      console.error('Failed to initialize AuthService:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Set up authentication state listener
   */
  setupAuthStateListener() {
    if (!this.auth) return;

    this.auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.notifyAuthStateListeners(user);
      
      if (user) {
        console.log('User signed in:', user.uid);
        this.updateUserProfile(user);
      } else {
        console.log('User signed out');
        this.clearUserData();
      }
    });
  }

  /**
   * Sign in with Google using popup
   * @returns {Promise<Object>} User object
   */
  async signInWithGoogle() {
    if (!this.auth) {
      throw new Error('Authentication service not initialized');
    }

    // Check if we're in a supported environment
    const protocol = window.location.protocol;
    if (protocol === 'file:') {
      throw new Error('Firebase requires HTTP/HTTPS protocol. Please run the app using a local server. Double-click start-server.bat or run: npx http-server -p 8000 -o');
    }

    try {
      console.log('Starting Google sign-in process...');
      const provider = new firebase.auth.GoogleAuthProvider();
      
      // Add scopes
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters for better UX
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      console.log('Opening Google sign-in popup...');
      const result = await this.auth.signInWithPopup(provider);
      const user = result.user;
      
      console.log('Google sign-in successful:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      });
      
      // Ensure popup closes immediately after successful authentication
      if (result.credential) {
        console.log('Authentication completed, popup should close automatically');
      }
      
      return user;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with Google using redirect (alternative to popup)
   * This method will redirect the entire page and then redirect back
   * @returns {Promise<void>}
   */
  async signInWithGoogleRedirect() {
    if (!this.auth) {
      throw new Error('Authentication service not initialized');
    }

    // Check if we're in a supported environment
    const protocol = window.location.protocol;
    if (protocol === 'file:') {
      throw new Error('Firebase requires HTTP/HTTPS protocol. Please run the app using a local server. Double-click start-server.bat or run: npx http-server -p 8000 -o');
    }

    try {
      console.log('Starting Google sign-in with redirect...');
      const provider = new firebase.auth.GoogleAuthProvider();
      
      // Add scopes
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      console.log('Redirecting to Google sign-in...');
      await this.auth.signInWithRedirect(provider);
      // Note: This will redirect the page, so the code after this won't execute
    } catch (error) {
      console.error('Google sign-in redirect failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handle redirect result after Google sign-in
   * Call this method when the page loads to check if user was redirected back
   * @returns {Promise<Object|null>} User object or null
   */
  async handleRedirectResult() {
    if (!this.auth) {
      return null;
    }

    try {
      const result = await this.auth.getRedirectResult();
      if (result.user) {
        console.log('Redirect sign-in successful:', {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        });
        return result.user;
      }
      return null;
    } catch (error) {
      console.error('Failed to handle redirect result:', error);
      return null;
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async signOut() {
    if (!this.auth) {
      throw new Error('Authentication service not initialized');
    }

    try {
      await this.auth.signOut();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current user
   * @returns {Object|null} Current user object
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is signed in
   * @returns {boolean} Sign-in status
   */
  isUserSignedIn() {
    return this.currentUser !== null;
  }

  /**
   * Get user ID
   * @returns {string|null} User ID
   */
  getUserId() {
    return this.currentUser ? this.currentUser.uid : null;
  }

  /**
   * Get user display name
   * @returns {string|null} User display name
   */
  getUserDisplayName() {
    return this.currentUser ? this.currentUser.displayName : null;
  }

  /**
   * Get user email
   * @returns {string|null} User email
   */
  getUserEmail() {
    return this.currentUser ? this.currentUser.email : null;
  }

  /**
   * Get user photo URL
   * @returns {string|null} User photo URL
   */
  getUserPhotoURL() {
    return this.currentUser ? this.currentUser.photoURL : null;
  }

  /**
   * Add authentication state change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChanged(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.authStateListeners.push(callback);
    
    // Call immediately with current state
    callback(this.currentUser);

    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all authentication state listeners
   * @param {Object|null} user - User object
   */
  notifyAuthStateListeners(user) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  /**
   * Update user profile information
   * @param {Object} user - User object
   */
  async updateUserProfile(user) {
    try {
      const userProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastSignIn: new Date().toISOString(),
        provider: 'google'
      };

      // Store user profile in localStorage for offline access
      StorageUtils.setLocalItem('userProfile', userProfile);
      
      // Store in session storage for current session
      StorageUtils.setSessionItem('currentUser', userProfile);
      
      console.log('User profile updated:', userProfile);
    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  }

  /**
   * Clear user data on sign out
   */
  clearUserData() {
    try {
      // Clear localStorage user data
      StorageUtils.removeLocalItem('userProfile');
      StorageUtils.removeLocalItem('userHabits');
      StorageUtils.removeLocalItem('userProgress');
      StorageUtils.removeLocalItem('userSettings');
      
      // Clear session storage
      StorageUtils.clearSessionStorage();
      
      // Clear IndexedDB user data
      this.clearIndexedDBUserData();
      
      console.log('User data cleared');
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  }

  /**
   * Clear user data from IndexedDB
   */
  async clearIndexedDBUserData() {
    try {
      const userId = this.getUserId();
      if (userId) {
        await StorageUtils.clearSyncedOfflineData(userId);
      }
    } catch (error) {
      console.error('Failed to clear IndexedDB user data:', error);
    }
  }

  /**
   * Handle authentication errors
   * @param {Object} error - Error object
   * @returns {Error} Processed error
   */
  handleAuthError(error) {
    let errorMessage = 'An authentication error occurred';
    let debugInfo = '';
    
    // Log detailed error information for debugging
    console.error('Firebase Auth Error Details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    });
    
    if (error.code) {
      switch (error.code) {
        case 'auth/internal-error':
          errorMessage = 'Firebase authentication service error. Please check your Firebase Console configuration.';
          debugInfo = `Internal error details: ${error.message || 'No additional details'}`;
          console.error('Firebase Internal Error - Check Console Setup:', {
            'Google Provider Enabled': 'Check Firebase Console > Authentication > Sign-in method',
            'Authorized Domains': 'Check Firebase Console > Authentication > Settings > Authorized domains',
            'API Key Valid': 'Verify API key in firebase-config.js',
            'Project ID': 'Verify project ID matches Firebase Console'
          });
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Sign-in popup was blocked. Please allow popups for this site.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Sign-in was cancelled';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'User account not found.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'Email address is already in use.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Please sign in again to continue.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Google sign-in is not enabled. Please contact support.';
          debugInfo = 'Check Firebase Console > Authentication > Sign-in method > Google';
          break;
        case 'auth/unauthorized-domain':
          errorMessage = 'This domain is not authorized for Firebase authentication.';
          debugInfo = 'Add your domain to Firebase Console > Authentication > Settings > Authorized domains';
          break;
        default:
          errorMessage = error.message || errorMessage;
          debugInfo = `Error code: ${error.code}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Create enhanced error with debug info
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    enhancedError.debugInfo = debugInfo;
    enhancedError.originalError = error;
    
    return enhancedError;
  }

  /**
   * Get authentication token
   * @returns {Promise<string|null>} Authentication token
   */
  async getAuthToken() {
    if (!this.currentUser) return null;
    
    try {
      const token = await this.currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Refresh authentication token
   * @returns {Promise<string|null>} New authentication token
   */
  async refreshAuthToken() {
    if (!this.currentUser) return null;
    
    try {
      const token = await this.currentUser.getIdToken(true);
      return token;
    } catch (error) {
      console.error('Failed to refresh auth token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   * @returns {Promise<boolean>} True if token is expired
   */
  async isTokenExpired() {
    if (!this.currentUser) return true;
    
    try {
      const token = await this.currentUser.getIdTokenResult();
      const expirationTime = new Date(token.expirationTime);
      const currentTime = new Date();
      
      // Check if token expires within the next 5 minutes
      const fiveMinutesFromNow = new Date(currentTime.getTime() + 5 * 60 * 1000);
      
      return expirationTime <= fiveMinutesFromNow;
    } catch (error) {
      console.error('Failed to check token expiration:', error);
      return true;
    }
  }

  /**
   * Delete user account
   * @returns {Promise<void>}
   */
  async deleteAccount() {
    if (!this.currentUser) {
      throw new Error('No user signed in');
    }
    
    try {
      await this.currentUser.delete();
      console.log('User account deleted successfully');
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Re-authenticate user
   * @returns {Promise<Object>} Re-authenticated user
   */
  async reauthenticate() {
    if (!this.currentUser) {
      throw new Error('No user signed in');
    }
    
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.currentUser.reauthenticateWithPopup(provider);
      console.log('User re-authenticated successfully');
      return result.user;
    } catch (error) {
      console.error('Re-authentication failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get user metadata
   * @returns {Object|null} User metadata
   */
  getUserMetadata() {
    if (!this.currentUser) return null;
    
    return {
      creationTime: this.currentUser.metadata.creationTime,
      lastSignInTime: this.currentUser.metadata.lastSignInTime,
      providerData: this.currentUser.providerData
    };
  }

  /**
   * Check if service is initialized
   * @returns {boolean} Initialization status
   */
  isServiceInitialized() {
    return this.isInitialized;
  }

  /**
   * Get authentication provider
   * @returns {string|null} Provider name
   */
  getProvider() {
    if (!this.currentUser || !this.currentUser.providerData.length) {
      return null;
    }
    
    return this.currentUser.providerData[0].providerId;
  }

  /**
   * Check if user is anonymous
   * @returns {boolean} True if user is anonymous
   */
  isAnonymous() {
    return this.currentUser ? this.currentUser.isAnonymous : false;
  }

  /**
   * Get user email verification status
   * @returns {boolean} Email verification status
   */
  isEmailVerified() {
    return this.currentUser ? this.currentUser.emailVerified : false;
  }
}

// Create global instance
window.AuthService = new AuthService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthService;
}
