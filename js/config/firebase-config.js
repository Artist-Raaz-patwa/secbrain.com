/**
 * SecBrain - Firebase Configuration
 * Professional habit tracking app with real-time sync
 */

// Firebase configuration object
// Your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCXvUh0c2mgeNQYtAuOo_uRxX0sNWR-LGI",
  authDomain: "secbrain-ad48a.firebaseapp.com",
  databaseURL: "https://secbrain-ad48a-default-rtdb.firebaseio.com",
  projectId: "secbrain-ad48a",
  storageBucket: "secbrain-ad48a.firebasestorage.app",
  messagingSenderId: "837583604539",
  appId: "1:837583604539:web:5efc79bf86564ed0be851e",
  measurementId: "G-JFJMK2K2G0"
};

// Initialize Firebase
let app;
let auth;
let database;

// Check if we're running in a supported environment
const isSupportedEnvironment = () => {
  const protocol = window.location.protocol;
  const supportedProtocols = ['http:', 'https:', 'chrome-extension:'];
  
  if (!supportedProtocols.includes(protocol)) {
    console.error('Firebase requires HTTP/HTTPS protocol. Current protocol:', protocol);
    console.error('Please run the app using a local server:');
    console.error('1. Run: npx http-server -p 8000 -o');
    console.error('2. Or double-click: start-server.bat');
    return false;
  }
  
  return true;
};

// Check if Firebase SDK is loaded
if (typeof firebase === 'undefined') {
  console.error('Firebase SDK not loaded - check your internet connection or CDN');
  // Create mock Firebase services immediately
  auth = {
    onAuthStateChanged: (callback) => {
      setTimeout(() => callback(null), 100);
    },
    signInWithPopup: () => Promise.reject(new Error('Firebase SDK not loaded')),
    signOut: () => Promise.resolve(),
    currentUser: null
  };
  
  database = {
    ref: (path) => ({
      on: () => {},
      off: () => {},
      set: () => Promise.resolve(),
      get: () => Promise.resolve({ val: () => null }),
      push: () => ({ set: () => Promise.resolve() }),
      update: () => Promise.resolve(),
      remove: () => Promise.resolve()
    })
  };
  
  console.log('Firebase SDK not available - using offline mode');
} else if (!isSupportedEnvironment()) {
  // Environment not supported - use mock services
  auth = {
    onAuthStateChanged: (callback) => {
      setTimeout(() => callback(null), 100);
    },
    signInWithPopup: () => Promise.reject(new Error('Unsupported environment - please use HTTP server')),
    signOut: () => Promise.resolve(),
    currentUser: null
  };
  
  database = {
    ref: (path) => ({
      on: () => {},
      off: () => {},
      set: () => Promise.resolve(),
      get: () => Promise.resolve({ val: () => null }),
      push: () => ({ set: () => Promise.resolve() }),
      update: () => Promise.resolve(),
      remove: () => Promise.resolve()
    })
  };
  
  console.log('Unsupported environment - using offline mode');
} else {
  try {
    // Validate configuration first
    if (!validateFirebaseConfig()) {
      throw new Error('Invalid Firebase configuration');
    }
    
    // Initialize Firebase app
    app = firebase.initializeApp(firebaseConfig);
    
    // Initialize Firebase services
    auth = firebase.auth();
    database = firebase.database();
    
    console.log('Firebase initialized successfully with project:', firebaseConfig.projectId);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    
    // Create mock Firebase services for offline mode
    console.log('Initializing offline mode...');
    
    // Mock auth service
    auth = {
      onAuthStateChanged: (callback) => {
        // Simulate no user signed in
        setTimeout(() => callback(null), 100);
      },
      signInWithPopup: () => Promise.reject(new Error('Offline mode - Firebase not available')),
      signOut: () => Promise.resolve(),
      currentUser: null
    };
    
    // Mock database service
    database = {
      ref: (path) => ({
        on: () => {},
        off: () => {},
        set: () => Promise.resolve(),
        get: () => Promise.resolve({ val: () => null }),
        push: () => ({ set: () => Promise.resolve() }),
        update: () => Promise.resolve(),
        remove: () => Promise.resolve()
      })
    };
    
    console.log('Offline mode initialized - Firebase services mocked');
  }
}

// Firebase configuration validation
function validateFirebaseConfig() {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];
  
  const missingFields = requiredFields.filter(field => 
    !firebaseConfig[field] || firebaseConfig[field].includes('your-') || firebaseConfig[field].includes('demo')
  );
  
  if (missingFields.length > 0) {
    console.warn('Firebase configuration incomplete. Missing or placeholder values for:', missingFields);
    return false;
  }
  
  console.log('Firebase configuration validated successfully');
  return true;
}

// Database structure constants
const DB_PATHS = {
  USERS: 'users',
  HABITS: 'habits',
  PROGRESS: 'progress',
  SETTINGS: 'settings',
  METADATA: 'metadata'
};

// Security rules helper
const SECURITY_RULES = {
  // Example security rules for Firebase Realtime Database
  rules: {
    users: {
      '$uid': {
        '.read': '$uid === auth.uid',
        '.write': '$uid === auth.uid',
        habits: {
          '.validate': 'newData.hasChildren() && newData.child("name").isString() && newData.child("name").val().length > 0'
        },
        progress: {
          '.validate': 'newData.hasChildren() && newData.child("date").isString()'
        },
        settings: {
          '.validate': 'newData.hasChildren() && newData.child("theme").isString()'
        }
      }
    }
  }
};

// Firebase service configuration
const FIREBASE_SERVICES = {
  // Authentication providers
  authProviders: {
    google: {
      provider: 'google',
      scopes: ['profile', 'email']
    }
  },
  
  // Database configuration
  database: {
    // Enable offline persistence
    enableOfflinePersistence: true,
    
    // Cache size limit (in MB)
    cacheSizeBytes: 40 * 1024 * 1024, // 40MB
    
    // Connection timeout (in ms)
    connectionTimeout: 10000,
    
    // Retry configuration
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000
    }
  },
  
  // Performance monitoring
  performance: {
    enabled: true,
    traceName: 'secbrain_performance'
  }
};

// Firebase error codes and messages
const FIREBASE_ERRORS = {
  'auth/user-not-found': 'User account not found',
  'auth/wrong-password': 'Incorrect password',
  'auth/email-already-in-use': 'Email address is already in use',
  'auth/weak-password': 'Password is too weak',
  'auth/invalid-email': 'Invalid email address',
  'auth/user-disabled': 'User account has been disabled',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later',
  'auth/network-request-failed': 'Network error. Please check your connection',
  'auth/requires-recent-login': 'Please sign in again to continue',
  'database/permission-denied': 'Permission denied. Please check your access rights',
  'database/unavailable': 'Database is temporarily unavailable',
  'database/network-error': 'Network error. Please check your connection'
};

// Helper function to get Firebase error message
function getFirebaseErrorMessage(error) {
  const errorCode = error.code || error.message;
  return FIREBASE_ERRORS[errorCode] || 'An unexpected error occurred';
}

// Firebase connection status
let isFirebaseConnected = false;
let connectionRetryCount = 0;
const MAX_CONNECTION_RETRIES = 5;

// Monitor Firebase connection status
function monitorFirebaseConnection() {
  if (!database) return;
  
  const connectedRef = database.ref('.info/connected');
  
  connectedRef.on('value', (snapshot) => {
    const isConnected = snapshot.val();
    isFirebaseConnected = isConnected;
    
    if (isConnected) {
      console.log('Firebase connected');
      connectionRetryCount = 0;
      // Dispatch custom event for connection status
      window.dispatchEvent(new CustomEvent('firebaseConnected'));
    } else {
      console.log('Firebase disconnected');
      // Dispatch custom event for disconnection
      window.dispatchEvent(new CustomEvent('firebaseDisconnected'));
      
      // Attempt to reconnect
      if (connectionRetryCount < MAX_CONNECTION_RETRIES) {
        connectionRetryCount++;
        setTimeout(() => {
          console.log(`Attempting to reconnect to Firebase (${connectionRetryCount}/${MAX_CONNECTION_RETRIES})`);
          monitorFirebaseConnection();
        }, 2000 * connectionRetryCount);
      }
    }
  });
}

// Initialize connection monitoring
if (database) {
  monitorFirebaseConnection();
}

// Firebase configuration export
window.FirebaseConfig = {
  app,
  auth,
  database,
  config: firebaseConfig,
  paths: DB_PATHS,
  services: FIREBASE_SERVICES,
  errors: FIREBASE_ERRORS,
  isConnected: () => isFirebaseConnected,
  getErrorMessage: getFirebaseErrorMessage,
  validateConfig: validateFirebaseConfig,
  securityRules: SECURITY_RULES
};

// Development mode configuration
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || 
    window.location.protocol === 'file:') {
  console.log('SecBrain running in development mode');
  
  // Enable Firebase emulator in development
  if (window.location.search.includes('emulator=true')) {
    console.log('Firebase emulator mode enabled');
    
    // Uncomment these lines to use Firebase emulator
    // auth.useEmulator('http://localhost:9099');
    // database.useEmulator('localhost', 9000);
  }
}

// Production mode configuration
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.log('SecBrain running in production mode');
  
  // Enable performance monitoring in production
  if (firebase.performance) {
    const perf = firebase.performance();
    console.log('Firebase Performance Monitoring enabled');
  }
  
  // Enable analytics in production
  if (firebase.analytics) {
    const analytics = firebase.analytics();
    analytics.logEvent('app_initialized');
    console.log('Firebase Analytics enabled');
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    firebaseConfig,
    DB_PATHS,
    FIREBASE_SERVICES,
    FIREBASE_ERRORS,
    getFirebaseErrorMessage
  };
}
