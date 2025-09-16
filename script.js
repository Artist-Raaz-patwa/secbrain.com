// Second Brain - Main JavaScript File

// Firebase Service Class
class FirebaseService {
    constructor() {
        this.db = null;
        this.auth = null;
        this.userId = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            // Wait for Firebase to be available with timeout
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds timeout
            
            while (!window.firebase && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.firebase) {
                throw new Error('Firebase initialization timeout');
            }
            
            this.db = window.firebase.db;
            this.auth = window.firebase.auth;
            
            // Set up auth state listener for future user authentication
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.userId = user.uid;
                    console.log('User authenticated:', user.uid);
                    
                    // Preload data in background for better performance
                    this.preloadData();
                    
                    // If SecondBrain app exists, reload modules with new user data
                    if (window.secondBrain) {
                        console.log('🔄 Reloading modules for authenticated user...');
                        await window.secondBrain.reloadModulesForUser();
                    }
                } else {
                    // For now, use a default user ID for anonymous usage
                    this.userId = 'anonymous_user';
                    console.log('Using anonymous user');
                    
                    // If SecondBrain app exists, reload modules for anonymous user
                    if (window.secondBrain) {
                        console.log('🔄 Reloading modules for anonymous user...');
                        await window.secondBrain.reloadModulesForUser();
                    }
                }
            });
            
            this.isInitialized = true;
            console.log('Firebase service initialized');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            // Fallback to local storage if Firebase fails
            this.isInitialized = false;
            this.userId = 'anonymous_user';
            console.log('Using local storage fallback');
        }
    }

    // Preload data in background for better performance
    async preloadData() {
        try {
            console.log('🚀 Preloading data in background...');
            
            // Preload projects data
            if (window.secondBrain && window.secondBrain.crm) {
                await window.secondBrain.crm.loadProjects();
            }
            
            // Preload completed tasks data
            if (window.secondBrain && window.secondBrain.completedTasks) {
                window.secondBrain.completedTasks.loadCompletedTasks();
            }
            
            console.log('✅ Background data preloading completed');
        } catch (error) {
            console.error('❌ Error preloading data:', error);
        }
    }

    // Generic document operations
    async getDocument(collection, docId) {
        if (!this.isInitialized) return this.getFromLocalStorage(collection, docId);
        
        try {
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const docRef = doc(this.db, collection, docId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting document:', error);
            return this.getFromLocalStorage(collection, docId);
        }
    }

    async setDocument(collection, docId, data) {
        if (!this.isInitialized) return this.setToLocalStorage(collection, docId, data);
        
        try {
            // Show server activity
            if (window.secondBrain) {
                window.secondBrain.showServerActivity('Saving to cloud...');
            }
            
            const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const docRef = doc(this.db, collection, docId);
            
            // Add metadata
            const dataWithMetadata = {
                ...data,
                userId: this.userId,
                updatedAt: new Date().toISOString(),
                createdAt: data.createdAt || new Date().toISOString()
            };
            
            await setDoc(docRef, dataWithMetadata);
            
            // Also save to local storage as backup
            this.setToLocalStorage(collection, docId, data);
            
            // Hide server activity
            if (window.secondBrain) {
                setTimeout(() => window.secondBrain.hideServerActivity(), 500);
            }
            
            return true;
        } catch (error) {
            console.error('Error setting document:', error);
            
            // Show server error
            if (window.secondBrain) {
                window.secondBrain.showServerError('Save failed');
                setTimeout(() => window.secondBrain.hideServerActivity(), 2000);
            }
            
            // Fallback to local storage
            return this.setToLocalStorage(collection, docId, data);
        }
    }

    async getCollection(collection) {
        if (!this.isInitialized) return this.getFromLocalStorage(collection);
        
        try {
            // Show server activity
            if (window.secondBrain) {
                window.secondBrain.showServerActivity('Loading from cloud...');
            }
            
            const { collection: firestoreCollection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const collectionRef = firestoreCollection(this.db, collection);
            
            // Simple query without ordering to avoid index requirement
            const q = query(collectionRef, where('userId', '==', this.userId));
            const querySnapshot = await getDocs(q);
            
            const documents = [];
            querySnapshot.forEach((doc) => {
                documents.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Sort in JavaScript instead of Firestore to avoid index requirement
            documents.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.createdAt || 0);
                const dateB = new Date(b.updatedAt || b.createdAt || 0);
                return dateB - dateA; // Newest first
            });
            
            // Hide server activity
            if (window.secondBrain) {
                setTimeout(() => window.secondBrain.hideServerActivity(), 500);
            }
            
            return documents;
        } catch (error) {
            console.error('Error getting collection:', error);
            
            // Show server error
            if (window.secondBrain) {
                window.secondBrain.showServerError('Load failed');
                setTimeout(() => window.secondBrain.hideServerActivity(), 2000);
            }
            
            return this.getFromLocalStorage(collection);
        }
    }

    async addDocument(collection, data) {
        if (!this.isInitialized) return this.addToLocalStorage(collection, data);
        
        try {
            const { collection: firestoreCollection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const collectionRef = firestoreCollection(this.db, collection);
            
            // Add metadata
            const dataWithMetadata = {
                ...data,
                userId: this.userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const docRef = await addDoc(collectionRef, dataWithMetadata);
            
            // Also save to local storage as backup
            this.addToLocalStorage(collection, { id: docRef.id, ...dataWithMetadata });
            
            return docRef.id;
        } catch (error) {
            console.error('Error adding document:', error);
            // Fallback to local storage
            return this.addToLocalStorage(collection, data);
        }
    }

    async updateDocument(collection, docId, data) {
        if (!this.isInitialized) return this.updateInLocalStorage(collection, docId, data);
        
        try {
            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const docRef = doc(this.db, collection, docId);
            
            // Add metadata
            const dataWithMetadata = {
                ...data,
                updatedAt: new Date().toISOString()
            };
            
            await updateDoc(docRef, dataWithMetadata);
            
            // Also update local storage as backup
            this.updateInLocalStorage(collection, docId, data);
            
            return true;
        } catch (error) {
            console.error('Error updating document:', error);
            // Fallback to local storage
            return this.updateInLocalStorage(collection, docId, data);
        }
    }

    async deleteDocument(collection, docId) {
        if (!this.isInitialized) return this.deleteFromLocalStorage(collection, docId);
        
        try {
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const docRef = doc(this.db, collection, docId);
            await deleteDoc(docRef);
            
            // Also delete from local storage
            this.deleteFromLocalStorage(collection, docId);
            
            return true;
        } catch (error) {
            console.error('Error deleting document:', error);
            // Fallback to local storage
            return this.deleteFromLocalStorage(collection, docId);
        }
    }

    // Local storage fallback methods
    getFromLocalStorage(collection, docId = null) {
        try {
            const key = `firebase_${collection}${docId ? `_${docId}` : ''}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : (docId ? null : []);
        } catch (error) {
            console.error('Local storage read error:', error);
            return docId ? null : [];
        }
    }

    setToLocalStorage(collection, docId, data) {
        try {
            const key = `firebase_${collection}_${docId}`;
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Local storage write error:', error);
            return false;
        }
    }

    addToLocalStorage(collection, data) {
        try {
            const key = `firebase_${collection}`;
            const existing = this.getFromLocalStorage(collection) || [];
            const newId = Date.now().toString();
            const newItem = { id: newId, ...data };
            existing.push(newItem);
            localStorage.setItem(key, JSON.stringify(existing));
            return newId;
        } catch (error) {
            console.error('Local storage add error:', error);
            return null;
        }
    }

    updateInLocalStorage(collection, docId, data) {
        try {
            const key = `firebase_${collection}`;
            const existing = this.getFromLocalStorage(collection) || [];
            const index = existing.findIndex(item => item.id === docId);
            if (index !== -1) {
                existing[index] = { ...existing[index], ...data };
                localStorage.setItem(key, JSON.stringify(existing));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Local storage update error:', error);
            return false;
        }
    }

    deleteFromLocalStorage(collection, docId) {
        try {
            const key = `firebase_${collection}`;
            const existing = this.getFromLocalStorage(collection) || [];
            const filtered = existing.filter(item => item.id !== docId);
            localStorage.setItem(key, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Local storage delete error:', error);
            return false;
        }
    }

    // Specific methods for Second Brain data
    async getProjects() {
        return await this.getCollection('projects');
    }

    async saveProject(project) {
        // Check if this project already exists in Firebase
        if (project.id) {
            try {
                // Try to get the existing document first
                const existingDoc = await this.getDocument('projects', project.id.toString());
                if (existingDoc) {
                    // Document exists, update it
                    return await this.updateDocument('projects', project.id.toString(), project);
                } else {
                    // Document doesn't exist, create it with the specified ID
                    return await this.setDocument('projects', project.id.toString(), project);
                }
            } catch (error) {
                // If there's an error checking, assume it doesn't exist and create it
                console.log(`Project ${project.id} not found, creating new document`);
                return await this.setDocument('projects', project.id.toString(), project);
            }
        } else {
            // No ID specified, let Firebase generate one
            return await this.addDocument('projects', project);
        }
    }

    async deleteProject(projectId) {
        return await this.deleteDocument('projects', projectId.toString());
    }

    async getPomodoroSessions() {
        return await this.getCollection('pomodoro_sessions');
    }

    async savePomodoroSession(session) {
        // If session has an ID, try to update existing, otherwise create new
        if (session.id) {
            try {
                const existingDoc = await this.getDocument('pomodoro_sessions', session.id.toString());
                if (existingDoc) {
                    return await this.updateDocument('pomodoro_sessions', session.id.toString(), session);
                } else {
                    return await this.setDocument('pomodoro_sessions', session.id.toString(), session);
                }
            } catch (error) {
                console.log(`Pomodoro session ${session.id} not found, creating new document`);
                return await this.setDocument('pomodoro_sessions', session.id.toString(), session);
            }
        } else {
            return await this.addDocument('pomodoro_sessions', session);
        }
    }

    async getPomodoroSettings() {
        const settings = await this.getDocument('pomodoro_settings', this.userId);
        return settings || {
            focusTime: 25 * 60, // 25 minutes in seconds
            breakTime: 5 * 60,  // 5 minutes in seconds
            sessionName: 'Focus Session'
        };
    }

    async savePomodoroSettings(settings) {
        return await this.setDocument('pomodoro_settings', this.userId, settings);
    }

    async getPomodoroState() {
        const state = await this.getDocument('pomodoro_state', this.userId);
        return state || {
            currentTime: 25 * 60,
            isRunning: false,
            isPaused: false,
            isFocusMode: true,
            startTime: null,
            pausedTime: 0
        };
    }

    async savePomodoroState(state) {
        return await this.setDocument('pomodoro_state', this.userId, state);
    }

    // Calendar methods
    async getCalendarEvents() {
        return await this.getCollection('calendar_events');
    }

    async saveCalendarEvent(event) {
        if (event.id) {
            return await this.setDocument('calendar_events', event.id.toString(), event);
        } else {
            return await this.addDocument('calendar_events', event);
        }
    }

    async deleteCalendarEvent(eventId) {
        return await this.deleteDocument('calendar_events', eventId.toString());
    }

    // Habits methods
    async getHabits() {
        return await this.getCollection('habits');
    }

    async saveHabit(habit) {
        if (habit.id) {
            return await this.setDocument('habits', habit.id.toString(), habit);
        } else {
            return await this.addDocument('habits', habit);
        }
    }

    async deleteHabit(habitId) {
        return await this.deleteDocument('habits', habitId.toString());
    }

    // User Authentication Methods (for future expansion)
    async signInWithEmail(email, password) {
        if (!this.isInitialized) {
            console.error('Firebase not initialized');
            return null;
        }
        
        try {
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            this.userId = userCredential.user.uid;
            console.log('User signed in:', this.userId);
            return userCredential.user;
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    async signUpWithEmail(email, password) {
        if (!this.isInitialized) {
            console.error('Firebase not initialized');
            return null;
        }
        
        try {
            const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            this.userId = userCredential.user.uid;
            console.log('User signed up:', this.userId);
            return userCredential.user;
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    }

    async clearUserData() {
        if (!this.isInitialized) {
            console.error('Firebase not initialized');
            return;
        }

        try {
            console.log('🧹 Clearing user data for:', this.userId);
            
            // Clear all collections for the current user
            const collections = ['projects', 'pomodoro_sessions', 'pomodoro_settings', 'pomodoro_state', 'crm_counters', 'calendar_events', 'habits'];
            
            for (const collection of collections) {
                try {
                    // Get all documents in the collection
                    const documents = await this.getCollection(collection);
                    
                    // Delete each document that belongs to the current user
                    for (const doc of documents) {
                        if (doc.userId === this.userId) {
                            await this.deleteDocument(collection, doc.id || doc.userId);
                            console.log(`🗑️ Deleted ${collection}/${doc.id || doc.userId} for user ${this.userId}`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Error clearing ${collection}:`, error.message);
                }
            }
            
            console.log('✅ User data cleared successfully for:', this.userId);
        } catch (error) {
            console.error('Error clearing user data:', error);
            throw error;
        }
    }

    async signOut() {
        if (!this.isInitialized) {
            console.error('Firebase not initialized');
            return;
        }
        
        try {
            // Don't clear Firebase data - just sign out
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signOut(this.auth);
            this.userId = 'anonymous_user';
            console.log('User signed out - data preserved on server');
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    async signInAnonymously() {
        if (!this.isInitialized) {
            console.error('Firebase not initialized');
            return null;
        }
        
        try {
            const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const userCredential = await signInAnonymously(this.auth);
            this.userId = userCredential.user.uid;
            console.log('User signed in anonymously:', this.userId);
            return userCredential.user;
        } catch (error) {
            console.error('Anonymous sign in error:', error);
            throw error;
        }
    }

    getCurrentUser() {
        return this.auth ? this.auth.currentUser : null;
    }

    isUserAuthenticated() {
        return this.userId && this.userId !== 'anonymous_user';
    }

    // Data migration methods for when users sign up
    async migrateAnonymousDataToUser(userId) {
        try {
            // Get all anonymous data
            const anonymousProjects = await this.getCollection('projects');
            const anonymousSessions = await this.getCollection('pomodoro_sessions');
            const anonymousSettings = await this.getDocument('pomodoro_settings', 'anonymous_user');
            const anonymousState = await this.getDocument('pomodoro_state', 'anonymous_user');
            
            // Update user IDs for all data
            for (const project of anonymousProjects) {
                await this.updateDocument('projects', project.id, { userId: userId });
            }
            
            for (const session of anonymousSessions) {
                await this.updateDocument('pomodoro_sessions', session.id, { userId: userId });
            }
            
            if (anonymousSettings) {
                await this.setDocument('pomodoro_settings', userId, { ...anonymousSettings, userId: userId });
            }
            
            if (anonymousState) {
                await this.setDocument('pomodoro_state', userId, { ...anonymousState, userId: userId });
            }
            
            console.log('Data migrated successfully for user:', userId);
            return true;
        } catch (error) {
            console.error('Data migration error:', error);
            return false;
        }
    }
}

class SecondBrain {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.mainContent = document.getElementById('mainContent');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentModule = 'dashboard';
        this.serverIndicator = document.getElementById('serverIndicator');
        
        // Calendar properties
        this.calendar = null;
        this.currentDate = new Date();
        this.selectedDate = new Date();
        
        // Initialize Firebase service and then start the app
        this.initializeApp();
    }

    async initializeApp() {
        // Initialize Firebase service
        this.firebase = new FirebaseService();
        
        // Wait for Firebase to be ready with timeout
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds timeout
        
        while (!this.firebase.isInitialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (this.firebase.isInitialized) {
            console.log('✅ Firebase initialized successfully, starting app...');
            console.log('🔑 User ID:', this.firebase.userId);
        } else {
            console.log('⚠️ Firebase not available, using local storage fallback...');
        }
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupResponsiveBehavior();
        
        // Check if there's an active nav link to determine current module
        const activeNavLink = document.querySelector('.nav-link.active');
        if (activeNavLink && activeNavLink.dataset.module) {
            this.currentModule = activeNavLink.dataset.module;
        }
        
        // Initialize dashboard event listeners if we're on dashboard
        if (this.currentModule === 'dashboard') {
            setTimeout(() => {
                this.setupDashboardEventListeners();
            }, 100);
        }
        
        this.loadModule(this.currentModule);
        
        // Initialize CRM if we're starting on the CRM module
        if (this.currentModule === 'crm') {
            setTimeout(async () => {
                await this.initializeCrm();
            }, 100);
        }

        // Initialize Wallet if we're starting on the Wallet module
        if (this.currentModule === 'wallet') {
            setTimeout(async () => {
                await this.initializeWallet();
            }, 100);
        }

        // Initialize Notes if we're starting on the Notes module
        if (this.currentModule === 'notes') {
            setTimeout(async () => {
                await this.initializeNotes();
            }, 100);
        }

        // Initialize Tasks if we're starting on the Tasks module
        if (this.currentModule === 'tasks') {
            setTimeout(async () => {
                await this.initializeTasks();
            }, 100);
        }

        // Initialize Goals if we're starting on the Goals module
        if (this.currentModule === 'goals') {
            setTimeout(async () => {
                await this.initializeGoals();
            }, 100);
        }

        // Initialize Analytics if we're starting on the Analytics module
        if (this.currentModule === 'analytics') {
            setTimeout(async () => {
                await this.initializeAnalytics();
            }, 100);
        }

        // Initialize Pomodoro if we're starting on the pomodoro module
        if (this.currentModule === 'pomodoro') {
            setTimeout(async () => {
                await this.initializePomodoro();
            }, 100);
        }
    }

    setupEventListeners() {
        // Sidebar toggle
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Navigation links
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const module = link.dataset.module;
                if (module) {
                    this.switchModule(module);
                }
            });
        });

        // Header action buttons
        const manualSaveBtn = document.getElementById('manualSaveBtn');
        const searchBtn = document.getElementById('searchBtn');
        const settingsBtn = document.getElementById('settingsBtn');

        if (manualSaveBtn) {
            manualSaveBtn.addEventListener('click', () => {
                this.handleManualSave();
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.handleSearch();
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.handleSettings();
            });
        }

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!this.sidebar.contains(e.target) && 
                    !this.sidebarToggle.contains(e.target) && 
                    this.sidebar.classList.contains('open')) {
                    this.closeSidebar();
                }
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Task completion modal event listeners
        this.setupTaskCompletionModalListeners();
    }

    setupTaskCompletionModalListeners() {
        const modal = document.getElementById('taskCompletionModal');
        const closeBtn = document.getElementById('taskCompletionModalClose');
        const cancelBtn = document.getElementById('cancelTaskCompletion');
        const confirmBtn = document.getElementById('confirmTaskCompletion');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.secondBrain.crm.hideTaskCompletionModal();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                window.secondBrain.crm.hideTaskCompletionModal();
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                window.secondBrain.crm.confirmTaskCompletion().catch(console.error);
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    window.secondBrain.crm.hideTaskCompletionModal();
                }
            });
        }

        // Handle Enter key in modal
        document.addEventListener('keydown', (e) => {
            if (modal && modal.classList.contains('open')) {
                if (e.key === 'Enter' && e.target.id === 'hoursSpent') {
                    e.preventDefault();
                    document.getElementById('completionNote').focus();
                } else if (e.key === 'Enter' && e.target.id === 'completionNote') {
                    e.preventDefault();
                    window.secondBrain.crm.confirmTaskCompletion().catch(console.error);
                } else if (e.key === 'Escape') {
                    window.secondBrain.crm.hideTaskCompletionModal();
                }
            }
        });

        // Setup auth modal close button
        const authModalClose = document.getElementById('authModalClose');
        if (authModalClose) {
            authModalClose.addEventListener('click', () => {
                window.secondBrain.hideAuthModal();
            });
        }

        // Handle auth modal background click
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.addEventListener('click', (e) => {
                if (e.target === authModal) {
                    window.secondBrain.hideAuthModal();
                }
            });
        }
    }

    setupResponsiveBehavior() {
        // Check initial screen size
        this.handleResize();
    }

    toggleSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.toggle('open');
            
            // Update hamburger animation
            const hamburgers = this.sidebarToggle.querySelectorAll('.hamburger');
            if (this.sidebar.classList.contains('open')) {
                hamburgers[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                hamburgers[1].style.opacity = '0';
                hamburgers[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                hamburgers[0].style.transform = 'none';
                hamburgers[1].style.opacity = '1';
                hamburgers[2].style.transform = 'none';
            }
        }
    }

    closeSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.remove('open');
            
            // Reset hamburger animation
            const hamburgers = this.sidebarToggle.querySelectorAll('.hamburger');
            hamburgers[0].style.transform = 'none';
            hamburgers[1].style.opacity = '1';
            hamburgers[2].style.transform = 'none';
        }
    }

    switchModule(moduleName) {
        // Update active nav link
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.module === moduleName) {
                link.classList.add('active');
            }
        });

        // Update current module
        this.currentModule = moduleName;
        
        // Load module content
        this.loadModule(moduleName);

        // Initialize calendar if switching to calendar module
        if (moduleName === 'calendar') {
            setTimeout(async () => {
                await this.initializeCalendar();
            }, 100);
        }

        // Initialize habits if switching to habits module
        if (moduleName === 'habits') {
            setTimeout(async () => {
                await this.initializeHabits();
            }, 100);
        }

        // Initialize CRM if switching to CRM module
        if (moduleName === 'crm') {
            setTimeout(async () => {
                await this.initializeCrm();
            }, 100);
        }

        // Initialize Wallet if switching to Wallet module
        if (moduleName === 'wallet') {
            setTimeout(async () => {
                await this.initializeWallet();
            }, 100);
        }

        // Initialize Notes if switching to Notes module
        if (moduleName === 'notes') {
            setTimeout(async () => {
                await this.initializeNotes();
            }, 100);
        }

        // Initialize Tasks if switching to Tasks module
        if (moduleName === 'tasks') {
            setTimeout(async () => {
                await this.initializeTasks();
            }, 100);
        }

        // Initialize Goals if switching to Goals module
        if (moduleName === 'goals') {
            setTimeout(async () => {
                await this.initializeGoals();
            }, 100);
        }

        // Initialize Analytics if switching to Analytics module
        if (moduleName === 'analytics') {
            setTimeout(async () => {
                await this.initializeAnalytics();
            }, 100);
        }

        // Initialize Completed Tasks if switching to completed-tasks module
        if (moduleName === 'completed-tasks') {
            setTimeout(() => {
                this.initializeCompletedTasks();
                this.completedTasks.loadCompletedTasks(); // Will use cache if available
            }, 100);
        }

        // Initialize Pomodoro if switching to pomodoro module
        if (moduleName === 'pomodoro') {
            setTimeout(async () => {
                await this.initializePomodoro();
            }, 100);
        }

        // Initialize Auth if switching to auth module
        if (moduleName === 'auth') {
            setTimeout(() => {
                this.initializeAuth();
            }, 100);
        }

        // Initialize Settings if switching to Settings module
        if (moduleName === 'settings') {
            setTimeout(() => {
                initializeSettings();
            }, 100);
        }

        // Initialize Logs if switching to Logs module
        if (moduleName === 'logs') {
            setTimeout(() => {
                initializeLogs();
            }, 100);
        }

        // Close sidebar on mobile after navigation
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
    }

    loadModule(moduleName) {
        const contentTitle = document.querySelector('.content-title');
        const contentSubtitle = document.querySelector('.content-subtitle');
        const contentBody = document.querySelector('.content-body');

        if (!contentTitle || !contentSubtitle || !contentBody) return;

        // Special handling for dashboard - restore original content
        if (moduleName === 'dashboard') {
            contentTitle.textContent = 'Dashboard';
            contentSubtitle.textContent = 'Welcome to your Second Brain';
            
            // Restore the original dashboard content
            contentBody.innerHTML = this.getDashboardContent();
            
            // Reinitialize dashboard widgets and event listeners
            setTimeout(() => {
            if (window.dashboardWidgets) {
                    // Re-setup event listeners for dashboard buttons
                    this.setupDashboardEventListeners();
                    
                    // Re-render all existing widgets
                    window.dashboardWidgets.widgets.forEach(widget => {
                        window.dashboardWidgets.renderWidget(widget);
                    });
                    
                window.dashboardWidgets.updateEmptyState();
                // Refresh all widgets when returning to dashboard
                window.dashboardWidgets.refreshAllWidgets().catch(console.error);
            }
            }, 100);
            return;
        }

        // Module configurations
        const modules = {
            notes: {
                title: 'Notes',
                subtitle: 'Capture and organize your thoughts',
                content: this.getNotesContent()
            },
            tasks: {
                title: 'Tasks',
                subtitle: 'Manage your to-do list',
                content: this.getTasksContent()
            },
            bookmarks: {
                title: 'Bookmarks',
                subtitle: 'Save and organize web resources',
                content: this.getBookmarksContent()
            },
            calendar: {
                title: 'Calendar',
                subtitle: 'Schedule and track events',
                content: this.getCalendarContent()
            },
            search: {
                title: 'Search',
                subtitle: 'Find anything in your Second Brain',
                content: this.getSearchContent()
            },
            analytics: {
                title: 'Analytics',
                subtitle: 'Insights and statistics',
                content: this.getAnalyticsContent()
            },
            habits: {
                title: 'Habits',
                subtitle: 'Track your daily habits and build consistency',
                content: this.getHabitsContent()
            },
            crm: {
                title: 'CRM',
                subtitle: 'Project and task management system',
                content: this.getCrmContent()
            },
            wallet: {
                title: 'Wallet',
                subtitle: 'Track your income and expenses',
                content: this.getWalletContent()
            },
            goals: {
                title: 'Goals',
                subtitle: 'Achieve your dreams with focused tracking',
                content: this.getGoalsContent()
            },
            settings: {
                title: 'Settings',
                subtitle: 'Customize your Second Brain experience',
                content: this.getSettingsContent()
            },
            logs: {
                title: 'Activity Log',
                subtitle: 'Track all your app activities and changes',
                content: this.getLogsContent()
            },
            'completed-tasks': {
                title: 'Completed Tasks',
                subtitle: 'View and manage completed tasks',
                content: this.getCompletedTasksContent()
            },
            pomodoro: {
                title: 'Pomodoro Timer',
                subtitle: 'Focus with the Pomodoro Technique',
                content: this.getPomodoroContent()
            },
            auth: {
                title: 'Account',
                subtitle: 'Manage your account and authentication',
                content: this.getAuthContent()
            }
        };

        const module = modules[moduleName];
        if (module) {
            contentTitle.textContent = module.title;
            contentSubtitle.textContent = module.subtitle;
            contentBody.innerHTML = module.content;
        }
    }

    setupDashboardEventListeners() {
        // Add widget button
        const addWidgetBtn = document.getElementById('addWidgetBtn');
        const addFirstWidgetBtn = document.getElementById('addFirstWidgetBtn');
        const refreshWidgetsBtn = document.getElementById('refreshWidgetsBtn');

        if (addWidgetBtn) {
            addWidgetBtn.addEventListener('click', () => {
                if (window.dashboardWidgets) {
                    window.dashboardWidgets.showWidgetSelectionModal();
                }
            });
        }

        if (addFirstWidgetBtn) {
            addFirstWidgetBtn.addEventListener('click', () => {
                if (window.dashboardWidgets) {
                    window.dashboardWidgets.showWidgetSelectionModal();
                }
            });
        }

        if (refreshWidgetsBtn) {
            refreshWidgetsBtn.addEventListener('click', () => {
                if (window.dashboardWidgets) {
                    window.dashboardWidgets.refreshAllWidgets().catch(console.error);
                }
            });
        }
    }

    getDashboardContent() {
        // Return the original dashboard content
        return `
            <!-- Dashboard Header with Add Widget Button -->
            <div class="dashboard-header">
                <div class="dashboard-header-content">
                    <div class="dashboard-title-section">
                        <h2 class="dashboard-title">My Dashboard</h2>
                        <p class="dashboard-subtitle">Customize your workspace with widgets from all modules</p>
                    </div>
                    <div class="dashboard-actions">
                        <button class="refresh-widgets-btn" id="refreshWidgetsBtn" title="Refresh all widgets">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                            </svg>
                            Refresh
                        </button>
                        <button class="add-widget-btn" id="addWidgetBtn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Widget
                        </button>
                    </div>
                </div>
            </div>

            <!-- Dashboard Grid Container -->
            <div class="dashboard-widgets-container" id="dashboardWidgetsContainer">
                <!-- Empty State -->
                <div class="dashboard-empty-state" id="dashboardEmptyState">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                        </div>
                        <h3 class="empty-state-title">Your Dashboard is Empty</h3>
                        <p class="empty-state-description">Add widgets from your modules to create a personalized workspace that fits your workflow.</p>
                        <button class="btn btn-primary btn-large" id="addFirstWidgetBtn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Your First Widget
                        </button>
                    </div>
                </div>

                <!-- Widget Grid -->
                <div class="widget-grid" id="widgetGrid" style="display: none;">
                    <!-- Widgets will be dynamically added here -->
                </div>
            </div>
        `;
    }

    getNotesContent() {
        return `
            <div class="notes-container">
                <div class="notes-header">
                    <h2>My Notes</h2>
                    <button class="btn btn-primary" id="addNoteBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New Note
                    </button>
                </div>
                
                <div class="notes-stats" id="notesStats">
                    <div class="notes-stat-card">
                        <span class="notes-stat-number" id="totalNotes">0</span>
                        <span class="notes-stat-label">Total Notes</span>
                    </div>
                    <div class="notes-stat-card">
                        <span class="notes-stat-number" id="recentNotes">0</span>
                        <span class="notes-stat-label">This Week</span>
                    </div>
                </div>
                
                <div class="notes-list" id="notesList">
                    <div class="empty-state" id="notesEmptyState">
                        <div class="empty-state-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                            </svg>
                        </div>
                        <h3>No Notes Yet</h3>
                        <p>Create your first note to get started!</p>
                    </div>
                </div>
            </div>
        `;
    }

    getTasksContent() {
        return `
            <div class="tasks-container">
                <div class="tasks-header">
                    <h2>My Tasks</h2>
                    <button class="btn btn-primary" id="addTaskBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New Task
                    </button>
                </div>
                
                <div class="tasks-stats" id="tasksStats">
                    <div class="tasks-stat-card">
                        <span class="tasks-stat-number" id="totalTasks">0</span>
                        <span class="tasks-stat-label">Total Tasks</span>
                    </div>
                    <div class="tasks-stat-card">
                        <span class="tasks-stat-number" id="completedTasks">0</span>
                        <span class="tasks-stat-label">Completed</span>
                    </div>
                    <div class="tasks-stat-card">
                        <span class="tasks-stat-number" id="pendingTasks">0</span>
                        <span class="tasks-stat-label">Pending</span>
                    </div>
                </div>
                
                <div class="tasks-filters">
                    <div class="filter-group">
                        <label for="taskFilter">Filter:</label>
                        <select id="taskFilter" class="filter-select">
                            <option value="all">All Tasks</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="searchTasks">Search:</label>
                        <input type="text" id="searchTasks" class="filter-input" placeholder="Search tasks...">
                    </div>
                </div>
                
                <div class="tasks-list" id="tasksList">
                    <div class="empty-state" id="tasksEmptyState">
                        <div class="empty-state-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <path d="M9 11l3 3l8-8"></path>
                                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
                            </svg>
                        </div>
                        <h3>No Tasks Yet</h3>
                        <p>Create your first task to get started!</p>
                    </div>
                </div>
            </div>
        `;
    }

    getBookmarksContent() {
        return `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Add Bookmark</h3>
                    <div class="action-buttons">
                        <button class="btn btn-primary">+ Add Bookmark</button>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Bookmarks</h3>
                    <div class="activity-list">
                        <div class="activity-item">
                            <div class="activity-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </div>
                            <div class="activity-content">
                                <p class="activity-text">No bookmarks yet</p>
                                <span class="activity-time">Save your first bookmark</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getCalendarContent() {
        return `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="calendar-nav-btn" id="prevMonth" aria-label="Previous month">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15,18 9,12 15,6"></polyline>
                        </svg>
                    </button>
                    <h2 class="calendar-month-year" id="calendarMonthYear"></h2>
                    <button class="calendar-nav-btn" id="nextMonth" aria-label="Next month">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                    </button>
                </div>
                
                <div class="calendar-grid">
                    <div class="calendar-weekdays">
                        <div class="weekday">Sun</div>
                        <div class="weekday">Mon</div>
                        <div class="weekday">Tue</div>
                        <div class="weekday">Wed</div>
                        <div class="weekday">Thu</div>
                        <div class="weekday">Fri</div>
                        <div class="weekday">Sat</div>
                    </div>
                    <div class="calendar-days" id="calendarDays"></div>
                </div>
                
                <div class="calendar-actions">
                    <button class="btn btn-primary" id="todayBtn">Today</button>
                    <button class="btn btn-secondary" id="addEventBtn">Add Event</button>
                </div>
            </div>
        `;
    }

    getSearchContent() {
        return `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Search</h3>
                    <div style="margin-bottom: 1rem;">
                        <input type="text" placeholder="Search your Second Brain..." 
                               style="width: 100%; padding: 0.75rem; border: 1px solid var(--color-gray-300); border-radius: var(--border-radius); font-size: 1rem;">
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-primary">Search</button>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Search Results</h3>
                    <div class="activity-list">
                        <div class="activity-item">
                            <div class="activity-content">
                                <p class="activity-text">No search results</p>
                                <span class="activity-time">Enter a search term above</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getAnalyticsContent() {
        return `
            <div class="analytics-container">
                <!-- Analytics Header -->
                <div class="analytics-header">
                    <h2 class="analytics-title">📊 Analytics Dashboard</h2>
                    <div class="analytics-controls">
                        <select id="analyticsTimeRange" class="analytics-select">
                            <option value="7">Last 7 days</option>
                            <option value="30" selected>Last 30 days</option>
                            <option value="90">Last 90 days</option>
                            <option value="365">Last year</option>
                        </select>
                        <button id="exportAnalyticsBtn" class="analytics-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7,10 12,15 17,10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export Data
                        </button>
                    </div>
                </div>

                <!-- Key Metrics Overview -->
                <div class="analytics-overview">
                    <div class="metric-card">
                        <div class="metric-icon">📝</div>
                        <div class="metric-content">
                            <span class="metric-number" id="totalNotes">0</span>
                            <span class="metric-label">Total Notes</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">✅</div>
                        <div class="metric-content">
                            <span class="metric-number" id="completedTasks">0</span>
                            <span class="metric-label">Completed Tasks</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">🎯</div>
                        <div class="metric-content">
                            <span class="metric-number" id="activeGoals">0</span>
                            <span class="metric-label">Active Goals</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">💰</div>
                        <div class="metric-content">
                            <span class="metric-number" id="totalRevenue">₹0</span>
                            <span class="metric-label">Total Revenue</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">🔥</div>
                        <div class="metric-content">
                            <span class="metric-number" id="habitStreak">0</span>
                            <span class="metric-label">Best Habit Streak</span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">⏱️</div>
                        <div class="metric-content">
                            <span class="metric-number" id="focusTime">0h</span>
                            <span class="metric-label">Focus Time</span>
                        </div>
                    </div>
                </div>

                <!-- Charts Grid -->
                <div class="analytics-charts">
                    <!-- Task Completion Trends -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>📈 Task Completion Trends</h3>
                            <div class="chart-controls">
                                <button class="chart-btn active" data-chart="tasks-weekly">Weekly</button>
                                <button class="chart-btn" data-chart="tasks-monthly">Monthly</button>
                            </div>
                        </div>
                        <div class="chart-container">
                            <canvas id="taskCompletionChart"></canvas>
                        </div>
                    </div>

                    <!-- Goal Progress -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>🎯 Goal Progress Overview</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="goalProgressChart"></canvas>
                        </div>
                    </div>

                    <!-- Revenue Analytics -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>💰 Revenue Analytics</h3>
                            <div class="chart-controls">
                                <button class="chart-btn active" data-chart="revenue-monthly">Monthly</button>
                                <button class="chart-btn" data-chart="revenue-project">By Project</button>
                            </div>
                        </div>
                        <div class="chart-container">
                            <canvas id="revenueChart"></canvas>
                        </div>
                    </div>

                    <!-- Habit Tracking -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>🔥 Habit Consistency</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="habitChart"></canvas>
                        </div>
                    </div>

                    <!-- Productivity Heatmap -->
                    <div class="chart-card full-width">
                        <div class="chart-header">
                            <h3>📅 Productivity Heatmap</h3>
                            <div class="chart-controls">
                                <button class="chart-btn active" data-chart="heatmap-tasks">Tasks</button>
                                <button class="chart-btn" data-chart="heatmap-focus">Focus Time</button>
                            </div>
                        </div>
                        <div class="chart-container">
                            <canvas id="productivityHeatmap"></canvas>
                        </div>
                    </div>

                    <!-- Module Usage Stats -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>📊 Module Usage</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="moduleUsageChart"></canvas>
                        </div>
                    </div>

                    <!-- Time Distribution -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3>⏰ Time Distribution</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="timeDistributionChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Detailed Insights -->
                <div class="analytics-insights">
                    <div class="insights-card">
                        <h3>💡 Key Insights</h3>
                        <div id="insightsList" class="insights-list">
                            <div class="insight-item">
                                <span class="insight-icon">📈</span>
                                <span class="insight-text">Loading insights...</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="insights-card">
                        <h3>🎯 Recommendations</h3>
                        <div id="recommendationsList" class="recommendations-list">
                            <div class="recommendation-item">
                                <span class="recommendation-icon">💡</span>
                                <span class="recommendation-text">Loading recommendations...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getHabitsContent() {
        return `
            <div class="habits-container">
                <div class="habits-header">
                    <h2 class="habits-title">Habit Tracker</h2>
                </div>
                
                <div class="habit-stats" id="habitStats">
                    <div class="habit-stat-card">
                        <span class="habit-stat-number" id="totalHabits">0</span>
                        <span class="habit-stat-label">Total Habits</span>
                    </div>
                    <div class="habit-stat-card">
                        <span class="habit-stat-number" id="completedToday">0</span>
                        <span class="habit-stat-label">Completed Today</span>
                    </div>
                    <div class="habit-stat-card">
                        <span class="habit-stat-number" id="streakDays">0</span>
                        <span class="habit-stat-label">Current Streak</span>
                    </div>
                </div>
                
                <div class="add-habit-form">
                    <div class="habit-input-group">
                        <input type="text" class="habit-input" id="habitInput" placeholder="Enter a new habit...">
                        <div class="habit-quantity-settings">
                            <label class="quantity-label">
                                <input type="checkbox" id="quantityEnabled" class="quantity-checkbox">
                                <span class="quantity-label-text">Set quantity target</span>
                            </label>
                            <div class="quantity-input-group" id="quantityInputGroup" style="display: none;">
                                <input type="number" id="quantityTarget" class="quantity-target-input" placeholder="Target" min="1" max="100" value="1">
                                <span class="quantity-unit-label">times per day</span>
                            </div>
                        </div>
                    </div>
                    <button class="add-habit-btn" id="addHabitBtn">Add Habit</button>
                </div>
                
                <div class="habits-list" id="habitsList">
                    <div class="empty-state" id="emptyState">
                        <div class="empty-state-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
                            </svg>
                        </div>
                        <h3>No habits yet</h3>
                        <p>Add your first habit to start tracking your progress</p>
                    </div>
                </div>
            </div>
        `;
    }

    getCrmContent() {
        return `
            <div class="crm-container">
                <div class="crm-header">
                    <h2 class="crm-title">Project & Task Management</h2>
                    <div class="crm-header-actions">
                        <div class="mobile-info" style="display: none; font-size: 0.875rem; color: var(--color-gray-600); margin-right: 1rem;">
                            📱 Mobile: Switch between Tree & Flat views for better task navigation
                        </div>
                        <button class="btn btn-primary" id="addProjectBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            New Project
                        </button>
                    </div>
                </div>
                
                <div class="crm-stats" id="crmStats">
                    <div class="crm-stat-card">
                        <span class="crm-stat-number" id="totalProjects">0</span>
                        <span class="crm-stat-label">Total Projects</span>
                    </div>
                    <div class="crm-stat-card">
                        <span class="crm-stat-number" id="totalTasks">0</span>
                        <span class="crm-stat-label">Total Tasks</span>
                    </div>
                    <div class="crm-stat-card">
                        <span class="crm-stat-number" id="completedTasks">0</span>
                        <span class="crm-stat-label">Completed Tasks</span>
                    </div>
                    <div class="crm-stat-card">
                        <span class="crm-stat-number" id="totalValue">₹0</span>
                        <span class="crm-stat-label">Total Value</span>
                    </div>
                    <div class="crm-stat-card">
                        <span class="crm-stat-number" id="receivedMoney">₹0</span>
                        <span class="crm-stat-label">Received Money</span>
                    </div>
                    <div class="crm-stat-card">
                        <span class="crm-stat-number" id="pendingMoney">₹0</span>
                        <span class="crm-stat-label">Pending Money</span>
                    </div>
                </div>
                
                <div class="projects-list" id="projectsList">
                    <div class="empty-state" id="crmEmptyState">
                        <div class="empty-state-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                <path d="M12 11h4"></path>
                                <path d="M12 16h4"></path>
                                <path d="M8 11h.01"></path>
                                <path d="M8 16h.01"></path>
                            </svg>
                        </div>
                        <h3>No projects yet</h3>
                        <p>Create your first project to start managing tasks and clients</p>
                    </div>
                </div>
            </div>
        `;
    }

    getWalletContent() {
        return `
            <div class="wallet-container">
                <div class="wallet-header">
                    <h2 class="wallet-title">Expense Tracker</h2>
                    <button class="btn btn-primary" id="addTransactionBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Transaction
                    </button>
                </div>
                
                <div class="balance-section">
                    <div class="current-balance">
                        <span class="balance-label">Current Balance</span>
                        <span class="balance-amount" id="currentBalance">₹0</span>
                    </div>
                </div>
                
                <div class="wallet-stats" id="walletStats">
                    <div class="wallet-stat-card">
                        <span class="wallet-stat-number" id="totalIncome">₹0</span>
                        <span class="wallet-stat-label">Total Income</span>
                    </div>
                    <div class="wallet-stat-card">
                        <span class="wallet-stat-number" id="totalExpenses">₹0</span>
                        <span class="wallet-stat-label">Total Expenses</span>
                    </div>
                    <div class="wallet-stat-card">
                        <span class="wallet-stat-number" id="netBalance">₹0</span>
                        <span class="wallet-stat-label">Net Balance</span>
                    </div>
                </div>
                
                <div class="filters-section">
                    <div class="filter-buttons">
                        <button class="filter-btn active" data-filter="all">All</button>
                        <button class="filter-btn" data-filter="income">Income Only</button>
                        <button class="filter-btn" data-filter="expense">Expenses Only</button>
                    </div>
                </div>
                
                <div class="transactions-section">
                    <h3 class="transactions-title">Transaction History</h3>
                    <div class="transactions-list" id="transactionsList">
                        <div class="empty-state" id="walletEmptyState">
                            <div class="empty-state-icon">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
                                </svg>
                            </div>
                            <h3>No transactions yet</h3>
                            <p>Add your first income or expense to start tracking</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getGoalsContent() {
        return `
            <div class="goals-container">
                <div class="goals-header">
                    <h2>My Goals</h2>
                    <button class="btn btn-primary" id="addGoalBtn">+ New Goal</button>
                </div>
                <div id="goalsList">
                    <p>No goals yet. Click "New Goal" to get started!</p>
                </div>
            </div>
        `;
    }

    getSettingsContent() {
        return `
            <div class="settings-container">
                <div class="settings-header">
                    <h2>Settings</h2>
                    <p>Customize your Second Brain experience</p>
                </div>
                
                <div class="settings-sections">
                    <!-- Theme Management -->
                    <div class="settings-section">
                        <h3>Theme Management</h3>
                        <div class="setting-item">
                            <label for="themeSelect">Theme:</label>
                            <select id="themeSelect" class="setting-input">
                                <option value="light">Light Mode</option>
                                <option value="dark">Dark Mode</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <button id="previewTheme" class="btn btn-secondary">Preview Theme</button>
                        </div>
                    </div>

                    <!-- Currency Settings -->
                    <div class="settings-section">
                        <h3>Currency Settings</h3>
                        <div class="setting-item">
                            <label for="currencySelect">Default Currency:</label>
                            <select id="currencySelect" class="setting-input">
                                <option value="INR">₹ Indian Rupee (INR)</option>
                                <option value="USD">$ US Dollar (USD)</option>
                                <option value="EUR">€ Euro (EUR)</option>
                                <option value="GBP">£ British Pound (GBP)</option>
                                <option value="JPY">¥ Japanese Yen (JPY)</option>
                                <option value="CAD">C$ Canadian Dollar (CAD)</option>
                                <option value="AUD">A$ Australian Dollar (AUD)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Display Preferences -->
                    <div class="settings-section">
                        <h3>Display Preferences</h3>
                        <div class="setting-item">
                            <label for="dateFormat">Date Format:</label>
                            <select id="dateFormat" class="setting-input">
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label for="firstDayOfWeek">First Day of Week:</label>
                            <select id="firstDayOfWeek" class="setting-input">
                                <option value="sunday">Sunday</option>
                                <option value="monday">Monday</option>
                            </select>
                        </div>
                    </div>

                    <!-- Advanced Settings -->
                    <div class="settings-section">
                        <h3>Advanced Settings</h3>
                        <div class="setting-item">
                            <label for="autoSaveInterval">Auto-save Interval:</label>
                            <select id="autoSaveInterval" class="setting-input">
                                <option value="immediate">Immediate</option>
                                <option value="30">30 seconds</option>
                                <option value="60">1 minute</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label class="setting-toggle">
                                <input type="checkbox" id="confirmDialogs" class="toggle-input">
                                <span class="toggle-slider"></span>
                                <span class="toggle-label">Confirmation dialogs for delete actions</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <label class="setting-toggle">
                                <input type="checkbox" id="soundNotifications" class="toggle-input">
                                <span class="toggle-slider"></span>
                                <span class="toggle-label">Sound notifications for completions</span>
                            </label>
                        </div>
                    </div>

                    <!-- Data Management -->
                    <div class="settings-section">
                        <h3>Data Management</h3>
                        <div class="setting-item">
                            <button id="exportData" class="btn btn-primary">Export All Data</button>
                            <button id="importData" class="btn btn-secondary">Import Data</button>
                        </div>
                        <div class="setting-item">
                            <button id="backupData" class="btn btn-secondary">Create Backup</button>
                            <button id="clearAllData" class="btn btn-danger">Clear All Data</button>
                        </div>
                        <div class="setting-item">
                            <div id="dataStats" class="data-stats">
                                <h4>Data Statistics</h4>
                                <div id="statsContent">Loading...</div>
                            </div>
                        </div>
                    </div>

                    <!-- App Info -->
                    <div class="settings-section">
                        <h3>App Information</h3>
                        <div class="setting-item">
                            <p><strong>Version:</strong> 1.0.0</p>
                            <p><strong>Build:</strong> 2024.01</p>
                            <p><strong>Developer:</strong> Second Brain Team</p>
                        </div>
                    </div>
                </div>

                <div class="settings-actions">
                    <button id="saveSettings" class="btn btn-primary">Save All Settings</button>
                    <button id="resetSettings" class="btn btn-secondary">Reset to Defaults</button>
                </div>
            </div>
        `;
    }

    getLogsContent() {
        return `
            <div class="logs-container">
                <div class="logs-header">
                    <h2>Activity Log</h2>
                    <p>Track all your app activities and changes</p>
                </div>
                
                <div class="logs-controls">
                    <div class="logs-filters">
                        <div class="filter-group">
                            <label for="dateFrom">From:</label>
                            <input type="date" id="dateFrom" class="filter-input">
                        </div>
                        <div class="filter-group">
                            <label for="dateTo">To:</label>
                            <input type="date" id="dateTo" class="filter-input">
                        </div>
                        <div class="filter-group">
                            <label for="moduleFilter">Module:</label>
                            <select id="moduleFilter" class="filter-input">
                                <option value="">All Modules</option>
                                <option value="Habits">Habits</option>
                                <option value="CRM">CRM</option>
                                <option value="Wallet">Wallet</option>
                                <option value="Goals">Goals</option>
                                <option value="Settings">Settings</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="actionFilter">Action:</label>
                            <select id="actionFilter" class="filter-input">
                                <option value="">All Actions</option>
                                <option value="Added">Added</option>
                                <option value="Updated">Updated</option>
                                <option value="Deleted">Deleted</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <button id="applyFilters" class="btn btn-primary">Apply Filters</button>
                            <button id="clearFilters" class="btn btn-secondary">Clear</button>
                        </div>
                    </div>
                    
                    <div class="logs-actions">
                        <button id="exportLogs" class="btn btn-primary">Export Logs</button>
                        <button id="clearLogs" class="btn btn-danger">Clear Logs</button>
                    </div>
                </div>
                
                <div class="logs-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Activities:</span>
                        <span id="totalActivities" class="stat-value">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Today:</span>
                        <span id="todayActivities" class="stat-value">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">This Week:</span>
                        <span id="weekActivities" class="stat-value">0</span>
                    </div>
                </div>
                
                <div class="logs-list" id="logsList">
                    <div class="loading">Loading activity log...</div>
                </div>
            </div>
        `;
    }

    getCompletedTasksContent() {
        return `
            <div class="completed-tasks-container">
                <div class="completed-tasks-header">
                    <div class="completed-tasks-title-section">
                        <h2 class="completed-tasks-title">Completed Tasks</h2>
                        <p class="completed-tasks-subtitle">Review and select tasks for client reports</p>
                    </div>
                    <div class="completed-tasks-actions">
                        <div class="selection-info">
                            <span id="selectedCount">0</span> of <span id="totalCount">0</span> tasks selected
                        </div>
                        <button class="btn btn-secondary" id="selectAllBtn">Select All</button>
                        <button class="btn btn-secondary" id="clearSelectionBtn">Clear Selection</button>
                        <button class="btn btn-primary" id="generateReportBtn" disabled>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            Generate Report
                        </button>
                    </div>
                </div>

                <div class="completed-tasks-filters">
                    <div class="filter-group">
                        <label for="projectFilter">Project:</label>
                        <select id="projectFilter" class="filter-select">
                            <option value="">All Projects</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="dateRangeStart">From Date:</label>
                        <input type="date" id="dateRangeStart" class="filter-input">
                    </div>
                    <div class="filter-group">
                        <label for="dateRangeEnd">To Date:</label>
                        <input type="date" id="dateRangeEnd" class="filter-input">
                    </div>
                    <div class="filter-group">
                        <label for="searchTasks">Search:</label>
                        <input type="text" id="searchTasks" class="filter-input" placeholder="Search tasks...">
                    </div>
                    <div class="filter-group">
                        <button class="btn btn-secondary" id="clearFiltersBtn">Clear Filters</button>
                    </div>
                </div>

                <div class="completed-tasks-stats">
                    <div class="stat-card">
                        <div class="stat-number" id="totalCompletedTasks">0</div>
                        <div class="stat-label">Total Completed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="totalHoursSpent">0h</div>
                        <div class="stat-label">Hours Spent</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="totalValue">₹0</div>
                        <div class="stat-label">Total Value</div>
                    </div>
                </div>

                <!-- Productivity Calendar Section -->
                <div class="productivity-calendar-section">
                    <div class="productivity-calendar-header">
                        <h3 class="productivity-calendar-title">Productivity Calendar</h3>
                        <div class="view-toggle">
                            <button class="view-toggle-btn active" id="listViewBtn" data-view="list">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="8" y1="6" x2="21" y2="6"></line>
                                    <line x1="8" y1="12" x2="21" y2="12"></line>
                                    <line x1="8" y1="18" x2="21" y2="18"></line>
                                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                                </svg>
                                List View
                            </button>
                            <button class="view-toggle-btn" id="calendarViewBtn" data-view="calendar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                Calendar View
                            </button>
                        </div>
                    </div>

                    <!-- Calendar View -->
                    <div class="productivity-calendar-container" id="productivityCalendarContainer" style="display: none;">
                        <div class="calendar-header">
                            <button class="calendar-nav-btn" id="prevMonthProductivity">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="15,18 9,12 15,6"></polyline>
                                </svg>
                            </button>
                            <h2 class="calendar-month-year" id="productivityCalendarMonthYear">January 2024</h2>
                            <button class="calendar-nav-btn" id="nextMonthProductivity">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9,18 15,12 9,6"></polyline>
                                </svg>
                            </button>
                        </div>

                        <div class="calendar-grid">
                            <div class="calendar-weekdays">
                                <div class="calendar-weekday">Sun</div>
                                <div class="calendar-weekday">Mon</div>
                                <div class="calendar-weekday">Tue</div>
                                <div class="calendar-weekday">Wed</div>
                                <div class="calendar-weekday">Thu</div>
                                <div class="calendar-weekday">Fri</div>
                                <div class="calendar-weekday">Sat</div>
                            </div>
                            <div class="calendar-days" id="productivityCalendarDays">
                                <!-- Calendar days will be rendered here -->
                            </div>
                        </div>

                        <div class="productivity-legend">
                            <div class="legend-title">Productivity Scale</div>
                            <div class="legend-items">
                                <div class="legend-item">
                                    <div class="legend-color" style="background-color: #374151;"></div>
                                    <span>0-25%</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color" style="background-color: #6b7280;"></div>
                                    <span>26-50%</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color" style="background-color: #9ca3af;"></div>
                                    <span>51-75%</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color" style="background-color: #d1d5db;"></div>
                                    <span>76-100%</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color legend-100-plus" style="background-color: #ffffff;"></div>
                                    <span>100%+</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="completed-tasks-list" id="completedTasksList">
                    <!-- Completed tasks will be rendered here -->
                </div>

                <div class="empty-state" id="emptyCompletedTasks" style="display: none;">
                    <div class="empty-state-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
                        </svg>
                    </div>
                    <h3>No Completed Tasks</h3>
                    <p>Complete some tasks to see them here and generate client reports.</p>
                </div>
            </div>
        `;
    }

    getPomodoroContent() {
        return `
            <div class="pomodoro-container">
                <div class="pomodoro-header">
                    <h2 class="pomodoro-title">Pomodoro Timer</h2>
                    <p class="pomodoro-subtitle">Focus with the Pomodoro Technique</p>
                </div>

                <div class="pomodoro-timer">
                    <div class="timer-display">
                        <div class="timer-circle">
                            <svg class="timer-svg" viewBox="0 0 100 100">
                                <circle class="timer-bg" cx="50" cy="50" r="45"></circle>
                                <circle class="timer-progress" cx="50" cy="50" r="45" id="timerProgress"></circle>
                            </svg>
                            <div class="timer-text">
                                <div class="timer-time" id="timerDisplay">25:00</div>
                                <div class="timer-mode" id="timerMode">Focus Time</div>
                            </div>
                        </div>
                    </div>

                    <div class="timer-controls">
                        <button class="btn btn-primary" id="startPauseBtn">Start</button>
                        <button class="btn btn-secondary" id="stopBtn">Stop</button>
                        <button class="btn btn-secondary" id="resetBtn">Reset</button>
                    </div>

                    <div class="timer-settings">
                        <div class="setting-group">
                            <label for="sessionName">Session Name:</label>
                            <input type="text" id="sessionName" class="form-input" placeholder="Enter session name..." maxlength="50">
                        </div>
                        <div class="setting-row">
                            <div class="setting-group">
                                <label for="focusTime">Focus Time (min):</label>
                                <input type="number" id="focusTime" class="form-input" value="25" min="1" max="60">
                            </div>
                            <div class="setting-group">
                                <label for="breakTime">Break Time (min):</label>
                                <input type="number" id="breakTime" class="form-input" value="5" min="1" max="30">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="pomodoro-sessions">
                    <div class="sessions-header">
                        <h3>Session History</h3>
                        <button class="btn btn-secondary" id="clearHistoryBtn">Clear History</button>
                    </div>
                    <div class="sessions-list" id="sessionsList">
                        <!-- Session history will be displayed here -->
                    </div>
                </div>
            </div>
        `;
    }

    getAuthContent() {
        return `
            <div class="auth-container">
                <div class="auth-header">
                    <h2>Account Management</h2>
                    <p>Sign in to sync your data across devices or create a new account</p>
                </div>
                
                <div class="auth-status" id="authStatus">
                    <div class="status-card">
                        <div class="status-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div class="status-info">
                            <h3 id="statusTitle">Guest User</h3>
                            <p id="statusDescription">You're using the app as a guest. Sign in to sync your data.</p>
                        </div>
                    </div>
                </div>
                
                <div class="auth-actions" id="authActions">
                    <div class="action-buttons">
                        <button class="btn btn-primary" id="signInBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10,17 15,12 10,7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                            </svg>
                            Sign In
                        </button>
                        <button class="btn btn-secondary" id="signUpBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                            Create Account
                        </button>
                    </div>
                    <div class="test-actions" style="margin-top: 1rem;">
                        <button class="btn btn-secondary" id="testFirebaseBtn" style="font-size: 0.9rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
                            </svg>
                            Test Firebase Connection
                        </button>
                    </div>
                </div>
                
                <div class="auth-benefits">
                    <h3>Benefits of Creating an Account</h3>
                    <div class="benefits-grid">
                        <div class="benefit-item">
                            <div class="benefit-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                    <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                </svg>
                            </div>
                            <div class="benefit-content">
                                <h4>Cloud Sync</h4>
                                <p>Access your data from any device, anywhere</p>
                            </div>
                        </div>
                        <div class="benefit-item">
                            <div class="benefit-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                            </div>
                            <div class="benefit-content">
                                <h4>Data Security</h4>
                                <p>Your data is encrypted and securely stored</p>
                            </div>
                        </div>
                        <div class="benefit-item">
                            <div class="benefit-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <div class="benefit-content">
                                <h4>Team Collaboration</h4>
                                <p>Share projects and collaborate with team members</p>
                            </div>
                        </div>
                        <div class="benefit-item">
                            <div class="benefit-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10,9 9,9 8,9"></polyline>
                                </svg>
                            </div>
                            <div class="benefit-content">
                                <h4>Data Backup</h4>
                                <p>Automatic backups ensure you never lose your work</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async handleManualSave() {
        const saveBtn = document.getElementById('manualSaveBtn');
        if (!saveBtn) return;

        // Show loading state
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>
        `;
        saveBtn.disabled = true;

        try {
            // First, let's diagnose the Firebase connection
            await this.diagnoseFirebaseConnection();

            let savedItems = [];
            let errors = [];

            // Save CRM data to Google Firebase
            if (this.crm) {
                try {
                    console.log('🔄 Saving CRM data to Firebase...');
                    await this.crm.saveProjects();
                    savedItems.push('Projects & Tasks');
                    console.log('✅ CRM data saved to Google Firebase successfully');
                } catch (error) {
                    const errorMsg = error.message.includes('No document to update') 
                        ? 'Some projects need to be created first' 
                        : error.message;
                    errors.push(`CRM: ${errorMsg}`);
                    console.error('❌ CRM save error:', error);
                }
            } else {
                console.log('⚠️ CRM manager not initialized');
            }

            // Save Wallet data to Google Firebase
            if (this.wallet) {
                try {
                    console.log('🔄 Saving Wallet data to Firebase...');
                    await this.wallet.saveTransactions();
                    savedItems.push('Wallet Transactions');
                    console.log('✅ Wallet data saved to Google Firebase successfully');
                } catch (error) {
                    errors.push(`Wallet: ${error.message}`);
                    console.error('❌ Wallet save error:', error);
                }
            } else {
                console.log('⚠️ Wallet manager not initialized');
            }

            // Save Notes data to Google Firebase
            if (this.notes) {
                try {
                    console.log('🔄 Saving Notes data to Firebase...');
                    await this.notes.saveNotes();
                    savedItems.push('Notes');
                    console.log('✅ Notes data saved to Google Firebase successfully');
                } catch (error) {
                    errors.push(`Notes: ${error.message}`);
                    console.error('❌ Notes save error:', error);
                }
            } else {
                console.log('⚠️ Notes manager not initialized');
            }

            // Save Tasks data to Google Firebase
            if (this.tasks) {
                try {
                    console.log('🔄 Saving Tasks data to Firebase...');
                    await this.tasks.saveTasks();
                    savedItems.push('Tasks');
                    console.log('✅ Tasks data saved to Google Firebase successfully');
                } catch (error) {
                    errors.push(`Tasks: ${error.message}`);
                    console.error('❌ Tasks save error:', error);
                }
            } else {
                console.log('⚠️ Tasks manager not initialized');
            }

            // Save Goals data to Google Firebase
            try {
                console.log('🔄 Saving Goals data to Firebase...');
                if (typeof saveGoals === 'function') {
                    await saveGoals();
                    savedItems.push('Goals');
                    console.log('✅ Goals data saved to Google Firebase successfully');
                } else {
                    console.log('⚠️ Goals save function not available');
                }
            } catch (error) {
                errors.push(`Goals: ${error.message}`);
                console.error('❌ Goals save error:', error);
            }

            // Save Pomodoro data to Google Firebase
            if (this.pomodoro) {
                try {
                    console.log('🔄 Saving Pomodoro data to Firebase...');
                    await this.pomodoro.saveState();
                    await this.pomodoro.saveSessions();
                    savedItems.push('Pomodoro Sessions');
                    console.log('✅ Pomodoro data saved to Google Firebase successfully');
                } catch (error) {
                    errors.push(`Pomodoro: ${error.message}`);
                    console.error('❌ Pomodoro save error:', error);
                }
            } else {
                console.log('⚠️ Pomodoro manager not initialized');
            }

            // Show feedback based on results
            if (savedItems.length > 0 && errors.length === 0) {
                const message = `Data saved to Google Cloud! (${savedItems.join(', ')})`;
                this.showSaveNotification(message, 'success');
            } else if (savedItems.length > 0 && errors.length > 0) {
                const message = `Partial save: ${savedItems.join(', ')} saved. Errors: ${errors.join(', ')}`;
                this.showSaveNotification(message, 'error');
            } else if (errors.length > 0) {
                const message = `Save failed: ${errors.join(', ')}`;
                this.showSaveNotification(message, 'error');
            } else {
                this.showSaveNotification('No data to save.', 'info');
            }
            
        } catch (error) {
            console.error('❌ Error in manual save:', error);
            this.showSaveNotification(`Save error: ${error.message}`, 'error');
        } finally {
            // Restore button state
            saveBtn.innerHTML = originalHTML;
            saveBtn.disabled = false;
        }
    }

    async diagnoseFirebaseConnection() {
        console.log('🔍 Diagnosing Firebase connection...');
        
        // Check if Firebase is available globally
        if (!window.firebase) {
            throw new Error('Firebase not loaded - check internet connection');
        }
        console.log('✅ Firebase SDK loaded');

        // Check if our Firebase service is initialized
        if (!this.firebase) {
            throw new Error('Firebase service not initialized');
        }
        console.log('✅ Firebase service exists');

        if (!this.firebase.isInitialized) {
            throw new Error('Firebase service not initialized - check connection');
        }
        console.log('✅ Firebase service initialized');

        // Check if we have a database connection
        if (!this.firebase.db) {
            throw new Error('Firestore database not connected');
        }
        console.log('✅ Firestore database connected');

        // Test a simple write operation
        try {
            const testData = {
                test: true,
                timestamp: new Date().toISOString(),
                userId: this.firebase.userId
            };
            
            await this.firebase.setDocument('test_collection', 'test_doc', testData);
            console.log('✅ Test write successful - Firebase is working!');
            
            // Clean up test document
            await this.firebase.deleteDocument('test_collection', 'test_doc');
            console.log('✅ Test cleanup successful');
            
        } catch (error) {
            console.error('❌ Test write failed:', error);
            throw new Error(`Firebase write test failed: ${error.message}`);
        }
    }

    showSaveNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `save-notification ${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline>';
        } else if (type === 'error') {
            iconSvg = '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
        } else if (type === 'info') {
            iconSvg = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
        }
        
        notification.innerHTML = `
            <div class="notification-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${iconSvg}
                </svg>
                <span>${message}</span>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    handleSearch() {
        this.switchModule('search');
    }

    handleSettings() {
        // Placeholder for settings functionality
        console.log('Settings clicked');
    }

    handleResize() {
        if (window.innerWidth > 768) {
            // Desktop view - ensure sidebar is visible
            this.sidebar.classList.remove('open');
            this.mainContent.style.marginLeft = 'var(--sidebar-width)';
        } else {
            // Mobile view - hide sidebar by default
            this.sidebar.classList.remove('open');
            this.mainContent.style.marginLeft = '0';
        }
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.handleSearch();
        }
        
        // Escape to close sidebar on mobile
        if (e.key === 'Escape' && window.innerWidth <= 768) {
            this.closeSidebar();
        }
    }

    // Calendar Methods
    async initializeCalendar() {
        this.calendar = new Calendar(this.currentDate, this.firebase);
        await this.calendar.loadEvents();
        this.setupCalendarEventListeners();
        
        // Always initialize habit tracker for calendar functionality
        if (!this.habitTracker) {
            this.habitTracker = new HabitTracker(this.firebase);
            await this.habitTracker.loadHabits();
        }
        
        // Connect calendar with habit tracker
        this.calendar.setHabitTracker(this.habitTracker);
        this.habitTracker.setCalendar(this.calendar);
        this.calendar.updateHabitProgress();
        
        // Ensure calendar is rendered after initialization
        setTimeout(() => {
            this.calendar.render();
        }, 100);
        
        console.log('✅ Calendar initialized with habit tracker connection');
    }

    setupCalendarEventListeners() {
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        const todayBtn = document.getElementById('todayBtn');
        const addEventBtn = document.getElementById('addEventBtn');

        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                this.calendar.previousMonth();
            });
        }

        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                this.calendar.nextMonth();
            });
        }

        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                this.calendar.goToToday();
            });
        }

        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => {
                this.handleAddEvent();
            });
        }
    }

    handleAddEvent() {
        // Placeholder for add event functionality
        console.log('Add event clicked for date:', this.calendar.selectedDate);
    }

    // Habit Tracker Methods
    async initializeHabits() {
        this.habitTracker = new HabitTracker(this.firebase);
        await this.habitTracker.loadHabits();
        this.setupHabitEventListeners();
        
        // Connect with calendar if it exists
        if (this.calendar) {
            this.calendar.setHabitTracker(this.habitTracker);
            this.habitTracker.setCalendar(this.calendar);
            this.calendar.updateHabitProgress();
        }
    }

    setupHabitEventListeners() {
        const habitInput = document.getElementById('habitInput');
        const addHabitBtn = document.getElementById('addHabitBtn');
        const quantityEnabled = document.getElementById('quantityEnabled');
        const quantityInputGroup = document.getElementById('quantityInputGroup');

        if (habitInput && addHabitBtn) {
            addHabitBtn.addEventListener('click', async () => {
                await this.addHabit();
            });

            habitInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.addHabit();
                }
            });
        }

        if (quantityEnabled && quantityInputGroup) {
            quantityEnabled.addEventListener('change', (e) => {
                if (e.target.checked) {
                    quantityInputGroup.style.display = 'flex';
                } else {
                    quantityInputGroup.style.display = 'none';
                }
            });
        }
    }

    async addHabit() {
        const habitInput = document.getElementById('habitInput');
        const quantityEnabled = document.getElementById('quantityEnabled');
        const quantityTarget = document.getElementById('quantityTarget');
        
        if (habitInput && habitInput.value.trim()) {
            const habitName = habitInput.value.trim();
            const isQuantityEnabled = quantityEnabled && quantityEnabled.checked;
            const target = isQuantityEnabled && quantityTarget ? parseInt(quantityTarget.value) || 1 : 1;
            
            await this.habitTracker.addHabit(habitName, isQuantityEnabled, target);
            
            // Reset form
            habitInput.value = '';
            if (quantityEnabled) quantityEnabled.checked = false;
            if (quantityTarget) quantityTarget.value = '1';
            document.getElementById('quantityInputGroup').style.display = 'none';
            
            // Update calendar progress when new habit is added
            if (this.calendar) {
                this.calendar.updateHabitProgress();
            }
        }
    }

    // CRM Methods
    async initializeCrm() {
        console.log('🔄 Initializing CRM module...');
        this.crm = new CrmManager(this.firebase);
        await this.crm.loadProjects(); // Will use cache if available
        this.crm.renderProjects();
        this.crm.updateStats();
        this.setupCrmEventListeners();
        console.log('✅ CRM module initialized successfully');
    }

    // Pomodoro Methods
    async initializePomodoro() {
        this.pomodoro = new PomodoroManager(this.firebase);
        await this.pomodoro.loadState();
        this.pomodoro.renderSessions();
        this.setupPomodoroEventListeners();
    }

    // Authentication Methods
    initializeAuth() {
        this.updateAuthStatus();
        this.setupAuthEventListeners();
    }

    updateAuthStatus() {
        const statusTitle = document.getElementById('statusTitle');
        const statusDescription = document.getElementById('statusDescription');
        const authActions = document.getElementById('authActions');

        if (!statusTitle || !statusDescription || !authActions) return;

        if (this.firebase && this.firebase.isUserAuthenticated()) {
            const user = this.firebase.getCurrentUser();
            statusTitle.textContent = 'Signed In';
            statusDescription.textContent = `Welcome back! You're signed in as ${user?.email || 'User'}`;
            authActions.innerHTML = `
                <div class="action-buttons">
                    <button class="btn btn-danger" id="clearAllDataBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Clear All Data
                    </button>
                    <button class="btn btn-secondary" id="signOutBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16,17 21,12 16,7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Sign Out
                    </button>
                </div>
            `;
        } else {
            statusTitle.textContent = 'Guest User';
            statusDescription.textContent = 'You\'re using the app as a guest. Sign in to sync your data.';
            authActions.innerHTML = `
                <div class="action-buttons">
                    <button class="btn btn-primary" id="signInBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10,17 15,12 10,7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                        Sign In
                    </button>
                    <button class="btn btn-secondary" id="signUpBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        Create Account
                    </button>
                </div>
            `;
        }
    }

    setupAuthEventListeners() {
        // Sign In Button
        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => {
                this.showAuthModal('signin');
            });
        }

        // Sign Up Button
        const signUpBtn = document.getElementById('signUpBtn');
        if (signUpBtn) {
            signUpBtn.addEventListener('click', () => {
                this.showAuthModal('signup');
            });
        }

        // Clear All Data Button
        const clearAllDataBtn = document.getElementById('clearAllDataBtn');
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', () => {
                this.clearAllData();
            });
        }

        // Sign Out Button
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }

        // Test Firebase Button
        const testFirebaseBtn = document.getElementById('testFirebaseBtn');
        if (testFirebaseBtn) {
            testFirebaseBtn.addEventListener('click', () => {
                this.testFirebaseConnection();
            });
        }
    }

    showAuthModal(mode) {
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authModalTitle');
        const submitBtn = document.getElementById('authSubmitBtn');
        const switchBtn = document.getElementById('authSwitchBtn');

        if (!modal || !title || !submitBtn || !switchBtn) return;

        if (mode === 'signin') {
            title.textContent = 'Sign In';
            submitBtn.textContent = 'Sign In';
            switchBtn.textContent = 'Create Account';
        } else {
            title.textContent = 'Create Account';
            submitBtn.textContent = 'Create Account';
            switchBtn.textContent = 'Sign In';
        }

        modal.style.display = 'flex';
        modal.classList.add('open');

        // Clear form
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';

        // Setup form submission
        const form = document.getElementById('authForm');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.handleAuthSubmit(mode);
            };
        }

        // Setup switch button
        switchBtn.onclick = () => {
            this.showAuthModal(mode === 'signin' ? 'signup' : 'signin');
        };
    }

    async handleAuthSubmit(mode) {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const submitBtn = document.getElementById('authSubmitBtn');

        if (!email || !password) {
            alert('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Please wait...';

        try {
            if (mode === 'signin') {
                await this.firebase.signInWithEmail(email, password);
                this.showSaveNotification('Successfully signed in!', 'success');
            } else {
                await this.firebase.signUpWithEmail(email, password);
                this.showSaveNotification('Account created successfully!', 'success');
            }

            this.hideAuthModal();
            this.updateAuthStatus();
            
            // Reload modules to load user's data
            await this.reloadModulesForUser();
            
        } catch (error) {
            console.error('Auth error:', error);
            this.showSaveNotification(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
        }
    }

    async clearAllData() {
        // Show options dialog
        const choice = confirm(
            'Choose how to clear your data:\n\n' +
            'Click OK for: Clear from device only (data stays on server)\n' +
            'Click Cancel for: Permanently delete from server (cannot be undone)'
        );
        
        if (choice === null) {
            return; // User cancelled
        }
        
        if (choice) {
            // Clear local data only
            await this.clearLocalDataOnly();
        } else {
            // Permanently delete from server
            await this.permanentlyDeleteData();
        }
    }

    async clearLocalDataOnly() {
        const confirmed = confirm(
            'Clear data from this device only?\n\n' +
            '📱 This will:\n' +
            '• Clear data from this device\n' +
            '• Keep your data safe on the server\n' +
            '• You can log back in to access your data\n\n' +
            'Click OK to continue or Cancel to keep your data.'
        );
        
        if (!confirmed) {
            return;
        }
        
        try {
            // Clear all local storage data only
            localStorage.clear();
            console.log('🧹 Local storage cleared (server data preserved)');
            
            // Reset app state
            this.crm = null;
            this.pomodoro = null;
            this.completedTasks = null;
            
            // Show success message
            this.showSaveNotification('Local data cleared! Your data is safe on the server.', 'success');
            
            // Update auth status
            this.updateAuthStatus();
            
            // Refresh the current module to show empty state
            if (this.currentModule) {
                this.switchModule(this.currentModule);
            }
            
        } catch (error) {
            console.error('Clear local data error:', error);
            this.showSaveNotification(`Error clearing local data: ${error.message}`, 'error');
        }
    }

    async permanentlyDeleteData() {
        const confirmed = confirm(
            '⚠️ PERMANENTLY DELETE ALL DATA?\n\n' +
            'This will permanently delete ALL your data including:\n' +
            '• All projects and tasks\n' +
            '• All Pomodoro sessions and history\n' +
            '• All settings and preferences\n\n' +
            '⚠️ This action cannot be undone!\n' +
            '⚠️ Your data will be lost forever!\n\n' +
            'Click OK to permanently delete or Cancel to keep your data.'
        );
        
        if (!confirmed) {
            return;
        }
        
        try {
            // Clear all local storage data
            localStorage.clear();
            console.log('🧹 Local storage cleared');
            
            // Clear Firebase data permanently
            await this.firebase.clearUserData();
            
            // Reset app state
            this.crm = null;
            this.pomodoro = null;
            this.completedTasks = null;
            
            // Show success message
            this.showSaveNotification('All data permanently deleted!', 'success');
            
            // Update auth status
            this.updateAuthStatus();
            
            // Refresh the current module to show empty state
            if (this.currentModule) {
                this.switchModule(this.currentModule);
            }
            
        } catch (error) {
            console.error('Permanent delete error:', error);
            this.showSaveNotification(`Error deleting data: ${error.message}`, 'error');
        }
    }

    async reloadModulesForUser() {
        try {
            console.log('🔄 Reloading modules for user:', this.firebase.userId);
            
            // Reset app state
            this.crm = null;
            this.pomodoro = null;
            this.completedTasks = null;
            this.calendar = null;
            this.habitTracker = null;
            this.notes = null;
            this.tasks = null;
            
            // Reinitialize modules based on current module
            if (this.currentModule === 'crm') {
                await this.initializeCrm();
            } else if (this.currentModule === 'pomodoro') {
                await this.initializePomodoro();
            } else if (this.currentModule === 'completed-tasks') {
                await this.initializeCompletedTasks();
            } else if (this.currentModule === 'calendar') {
                await this.initializeCalendar();
            } else if (this.currentModule === 'habits') {
                await this.initializeHabits();
            } else if (this.currentModule === 'wallet') {
                await this.initializeWallet();
            } else if (this.currentModule === 'notes') {
                await this.initializeNotes();
            } else if (this.currentModule === 'tasks') {
                await this.initializeTasks();
            } else if (this.currentModule === 'goals') {
                await this.initializeGoals();
            } else if (this.currentModule === 'analytics') {
                await this.initializeAnalytics();
            }
            
            // Update auth status
            this.updateAuthStatus();
            
            console.log('✅ Modules reloaded successfully');
        } catch (error) {
            console.error('Error reloading modules:', error);
        }
    }

    async signOut() {
        // Show confirmation dialog
        const confirmed = confirm(
            'Are you sure you want to sign out?\n\n' +
            '📱 This will:\n' +
            '• Clear data from this device\n' +
            '• Sign you out of your account\n\n' +
            '💾 Your data will be safely stored on the server and will be available when you log back in.\n\n' +
            'Click OK to continue or Cancel to stay signed in.'
        );
        
        if (!confirmed) {
            return;
        }
        
        try {
            // Clear all local storage data (device only)
            localStorage.clear();
            console.log('🧹 Local storage cleared');
            
            // Sign out (but keep data on Firebase server)
            await this.firebase.signOut();
            
            // Reset app state
            this.crm = null;
            this.pomodoro = null;
            this.completedTasks = null;
            
            // Show success message
            this.showSaveNotification('Successfully signed out! Your data is safe on the server.', 'success');
            
            // Update auth status
            this.updateAuthStatus();
            
            // Refresh the current module to show empty state
            if (this.currentModule) {
                this.switchModule(this.currentModule);
            }
            
        } catch (error) {
            console.error('Sign out error:', error);
            this.showSaveNotification(`Error during logout: ${error.message}`, 'error');
        }
    }

    hideAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    async testFirebaseConnection() {
        const testBtn = document.getElementById('testFirebaseBtn');
        if (!testBtn) return;

        const originalText = testBtn.innerHTML;
        testBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>
            Testing...
        `;
        testBtn.disabled = true;

        try {
            await this.diagnoseFirebaseConnection();
            
            // Test creating and saving a sample project
            await this.createTestData();
            
            this.showSaveNotification('Firebase connection successful! Test data created and saved to Google Cloud.', 'success');
        } catch (error) {
            console.error('Firebase test failed:', error);
            this.showSaveNotification(`Firebase test failed: ${error.message}`, 'error');
        } finally {
            testBtn.innerHTML = originalText;
            testBtn.disabled = false;
        }
    }

    async createTestData() {
        console.log('🔄 Creating test data...');
        
        // Create a test project
        const testProject = {
            id: 999,
            name: 'Test Project - Firebase Save',
            description: 'This is a test project to verify Firebase saving works',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
            client: {
                name: 'Test Company',
                email: 'test@example.com'
            },
            tasks: [
                {
                    id: 1,
                    name: 'Test Task 1',
                    description: 'First test task',
                    price: 100,
                    completed: false,
                    hoursSpent: null,
                    completionNote: null,
                    completedAt: null,
                    parentTaskId: null,
                    subtasks: []
                }
            ],
            completed: false
        };

        // Save the test project
        await this.firebase.saveProject(testProject);
        console.log('✅ Test project saved successfully');
        
        // Create a test Pomodoro session
        const testSession = {
            name: 'Test Focus Session',
            type: 'focus',
            duration: 1500, // 25 minutes
            completedAt: new Date().toISOString()
        };

        await this.firebase.savePomodoroSession(testSession);
        console.log('✅ Test Pomodoro session saved successfully');
        
        // Clean up test data after 30 seconds
        setTimeout(async () => {
            try {
                await this.firebase.deleteDocument('projects', '999');
                await this.firebase.deleteDocument('pomodoro_sessions', testSession.id || 'test');
                console.log('🧹 Test data cleaned up');
            } catch (error) {
                console.log('Note: Test data cleanup failed (this is normal)');
            }
        }, 30000);
    }

    setupCrmEventListeners() {
        const addProjectBtn = document.getElementById('addProjectBtn');

        if (addProjectBtn) {
            addProjectBtn.addEventListener('click', () => {
                this.crm.showAddProjectModal();
            });
        }
    }

    setupPomodoroEventListeners() {
        const startPauseBtn = document.getElementById('startPauseBtn');
        const stopBtn = document.getElementById('stopBtn');
        const resetBtn = document.getElementById('resetBtn');
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const sessionNameInput = document.getElementById('sessionName');
        const focusTimeInput = document.getElementById('focusTime');
        const breakTimeInput = document.getElementById('breakTime');

        if (startPauseBtn) {
            startPauseBtn.addEventListener('click', () => {
                this.pomodoro.toggleTimer();
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.pomodoro.stopTimer().catch(console.error);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.pomodoro.resetTimer().catch(console.error);
            });
        }

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                this.pomodoro.clearHistory().catch(console.error);
            });
        }

        if (sessionNameInput) {
            sessionNameInput.addEventListener('input', () => {
                this.pomodoro.updateSessionName(sessionNameInput.value).catch(console.error);
            });
        }

        if (focusTimeInput) {
            focusTimeInput.addEventListener('change', () => {
                this.pomodoro.updateFocusTime(parseInt(focusTimeInput.value)).catch(console.error);
            });
        }

        if (breakTimeInput) {
            breakTimeInput.addEventListener('change', () => {
                this.pomodoro.updateBreakTime(parseInt(breakTimeInput.value)).catch(console.error);
            });
        }
    }

    // Wallet Methods
    async initializeWallet() {
        console.log('🔄 Initializing Wallet module...');
        this.wallet = new WalletManager(this.firebase);
        await this.wallet.loadTransactions();
        this.wallet.renderTransactions();
        this.wallet.updateStats();
        this.setupWalletEventListeners();
        console.log('✅ Wallet module initialized successfully');
    }

    setupWalletEventListeners() {
        const addTransactionBtn = document.getElementById('addTransactionBtn');

        if (addTransactionBtn) {
            addTransactionBtn.addEventListener('click', () => {
                this.wallet.showAddTransactionModal();
            });
        }
    }

    // Notes Methods
    async initializeNotes() {
        console.log('🔄 Initializing Notes module...');
        this.notes = new NotesManager(this.firebase);
        await this.notes.loadNotes();
        this.notes.renderNotes();
        this.notes.updateStats();
        this.setupNotesEventListeners();
        console.log('✅ Notes module initialized successfully');
    }

    setupNotesEventListeners() {
        const addNoteBtn = document.getElementById('addNoteBtn');

        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => {
                this.notes.showAddNoteModal();
            });
        }
    }

    // Tasks Methods
    async initializeTasks() {
        console.log('🔄 Initializing Tasks module...');
        this.tasks = new TasksManager(this.firebase);
        await this.tasks.loadTasks();
        this.tasks.renderTasks();
        this.tasks.updateStats();
        this.setupTasksEventListeners();
        console.log('✅ Tasks module initialized successfully');
    }

    async initializeGoals() {
        console.log('🔄 Initializing Goals module...');
        this.goals = new GoalsManager(this.firebase);
        await this.goals.loadGoals();
        this.goals.renderGoals();
        this.goals.updateStats();
        this.setupGoalsEventListeners();
        console.log('✅ Goals module initialized successfully');
    }

    async initializeAnalytics() {
        console.log('🔄 Initializing Analytics module...');
        this.analytics = new AnalyticsManager(this.firebase);
        console.log('✅ Analytics module initialized successfully');
    }

    setupTasksEventListeners() {
        const addTaskBtn = document.getElementById('addTaskBtn');
        const taskFilter = document.getElementById('taskFilter');
        const searchTasks = document.getElementById('searchTasks');

        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.tasks.showAddTaskModal();
            });
        }

        if (taskFilter) {
            taskFilter.addEventListener('change', () => {
                this.tasks.filterTasks();
            });
        }

        if (searchTasks) {
            // Use debounced search for better performance
            const debouncedSearch = this.tasks.debounce ? this.tasks.debounce(() => {
                this.tasks.searchTasks();
            }, 300) : () => this.tasks.searchTasks();
            
            searchTasks.addEventListener('input', debouncedSearch);
        }
    }

    setupGoalsEventListeners() {
        const addGoalBtn = document.getElementById('addGoalBtn');

        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', () => {
                this.goals.showAddGoalModal();
            });
        }
    }

    // Completed Tasks Methods
    initializeCompletedTasks() {
        this.completedTasks = new CompletedTasksManager();
        this.productivityCalendar = new ProductivityCalendar(this.completedTasks, this.firebase);
        this.setupCompletedTasksEventListeners();
        this.productivityCalendar.initialize();
    }

    setupCompletedTasksEventListeners() {
        const selectAllBtn = document.getElementById('selectAllBtn');
        const clearSelectionBtn = document.getElementById('clearSelectionBtn');
        const generateReportBtn = document.getElementById('generateReportBtn');
        const projectFilter = document.getElementById('projectFilter');
        const dateRangeStart = document.getElementById('dateRangeStart');
        const dateRangeEnd = document.getElementById('dateRangeEnd');
        const searchTasks = document.getElementById('searchTasks');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.completedTasks.selectAllTasks();
            });
        }

        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => {
                this.completedTasks.clearSelection();
            });
        }

        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => {
                this.completedTasks.generateClientReport();
            });
        }

        if (projectFilter) {
            projectFilter.addEventListener('change', () => {
                this.completedTasks.filterTasks();
            });
        }

        if (dateRangeStart) {
            dateRangeStart.addEventListener('change', () => {
                this.completedTasks.filterTasks();
            });
        }

        if (dateRangeEnd) {
            dateRangeEnd.addEventListener('change', () => {
                this.completedTasks.filterTasks();
            });
        }

        if (searchTasks) {
            // Use debounced search for better performance
            const debouncedFilter = this.completedTasks.debounce(() => {
                this.completedTasks.filterTasks();
            }, 300);
            
            searchTasks.addEventListener('input', debouncedFilter);
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.completedTasks.clearAllFilters();
            });
        }
    }

    // Goals Methods - Using simple global functions

    // ========================================
    // SERVER INDICATOR METHODS
    // ========================================

    showServerActivity(message = 'Syncing...') {
        if (this.serverIndicator) {
            this.serverIndicator.classList.remove('error', 'offline');
            this.serverIndicator.classList.add('active');
            this.serverIndicator.setAttribute('data-status', message);
        }
    }

    hideServerActivity() {
        if (this.serverIndicator) {
            this.serverIndicator.classList.remove('active');
            this.serverIndicator.setAttribute('data-status', 'Connected');
        }
    }

    showServerError(message = 'Connection Error') {
        if (this.serverIndicator) {
            this.serverIndicator.classList.remove('active', 'offline');
            this.serverIndicator.classList.add('error');
            this.serverIndicator.setAttribute('data-status', message);
        }
    }

    showServerOffline() {
        if (this.serverIndicator) {
            this.serverIndicator.classList.remove('active', 'error');
            this.serverIndicator.classList.add('offline');
            this.serverIndicator.setAttribute('data-status', 'Offline');
        }
    }

    // Enhanced save notification with server indicator
    showSaveNotification(message, type = 'success') {
        // Show server activity
        this.showServerActivity('Saving...');
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '80px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // Set background color based on type
        if (type === 'success') {
            notification.style.backgroundColor = '#10b981';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#ef4444';
        } else {
            notification.style.backgroundColor = '#6b7280';
        }

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Hide server activity after a delay
        setTimeout(() => {
            this.hideServerActivity();
        }, 1000);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Completed Tasks Manager
class CompletedTasksManager {
    constructor() {
        this.completedTasks = [];
        this.filteredTasks = [];
        this.selectedTasks = new Set();
        this.filters = {
            project: '',
            dateStart: '',
            dateEnd: '',
            search: ''
        };
        this.cache = {
            tasks: null,
            lastUpdated: null,
            cacheTimeout: 15000 // 15 seconds cache for completed tasks
        };
        this.isLoading = false;
    }

    // Cache management
    invalidateCache() {
        this.cache.tasks = null;
        this.cache.lastUpdated = null;
        console.log('🗑️ Completed tasks cache invalidated');
    }

    // Debounced search for better performance
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    loadCompletedTasks(forceReload = false) {
        // Prevent multiple simultaneous loads
        if (this.isLoading) {
            console.log('⏳ Completed tasks loading already in progress, skipping...');
            return;
        }

        // Check cache first
        if (!forceReload && this.cache.tasks && this.cache.lastUpdated) {
            const now = Date.now();
            if (now - this.cache.lastUpdated < this.cache.cacheTimeout) {
                console.log('📦 Using cached completed tasks data');
                this.completedTasks = this.cache.tasks;
                this.filteredTasks = [...this.completedTasks];
                this.updateProjectFilter();
                this.renderCompletedTasks();
                this.updateStats();
                return;
            }
        }

        this.isLoading = true;
        
        try {
            // Get all completed tasks from CRM projects
            this.completedTasks = [];
            
            if (window.secondBrain && window.secondBrain.crm && window.secondBrain.crm.projects) {
                window.secondBrain.crm.projects.forEach(project => {
                    this.collectCompletedTasks(project.tasks, project);
                });
            }

            // Sort by completion date (newest first)
            this.completedTasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
            
            // Update cache
            this.cache.tasks = [...this.completedTasks];
            this.cache.lastUpdated = Date.now();
            
            this.filteredTasks = [...this.completedTasks];
            this.updateProjectFilter();
            this.renderCompletedTasks();
            this.updateStats();
            
            // Update productivity calendar if it exists
            if (window.secondBrain && window.secondBrain.productivityCalendar) {
                window.secondBrain.productivityCalendar.updateCalendar();
            }
        } finally {
            this.isLoading = false;
        }
    }

    collectCompletedTasks(tasks, project, parentTask = null) {
        tasks.forEach(task => {
            if (task.completed && task.completedAt) {
                this.completedTasks.push({
                    ...task,
                    projectName: project.name,
                    projectId: project.id,
                    companyName: project.client ? project.client.name : 'Unknown Company',
                    parentTaskName: parentTask ? parentTask.name : null
                });
            }
            
            if (task.subtasks && task.subtasks.length > 0) {
                this.collectCompletedTasks(task.subtasks, project, task);
            }
        });
    }

    updateProjectFilter() {
        const projectFilter = document.getElementById('projectFilter');
        if (!projectFilter) return;

        // Get unique project names
        const projects = [...new Set(this.completedTasks.map(task => task.projectName))];
        
        // Clear existing options except "All Projects"
        projectFilter.innerHTML = '<option value="">All Projects</option>';
        
        // Add project options
        projects.forEach(projectName => {
            const option = document.createElement('option');
            option.value = projectName;
            option.textContent = projectName;
            projectFilter.appendChild(option);
        });
    }

    filterTasks() {
        const projectFilter = document.getElementById('projectFilter');
        const dateRangeStart = document.getElementById('dateRangeStart');
        const dateRangeEnd = document.getElementById('dateRangeEnd');
        const searchInput = document.getElementById('searchTasks');

        this.filters.project = projectFilter ? projectFilter.value : '';
        this.filters.dateStart = dateRangeStart ? dateRangeStart.value : '';
        this.filters.dateEnd = dateRangeEnd ? dateRangeEnd.value : '';
        this.filters.search = searchInput ? searchInput.value.toLowerCase() : '';

        this.filteredTasks = this.completedTasks.filter(task => {
            // Project filter
            if (this.filters.project && task.projectName !== this.filters.project) {
                return false;
            }

            // Date range filter
            if (this.filters.dateStart || this.filters.dateEnd) {
                const taskDate = new Date(task.completedAt);
                const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                
                if (this.filters.dateStart) {
                    const startDate = new Date(this.filters.dateStart);
                    if (taskDateOnly < startDate) return false;
                }
                
                if (this.filters.dateEnd) {
                    const endDate = new Date(this.filters.dateEnd);
                    if (taskDateOnly > endDate) return false;
                }
            }

            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search;
                if (!task.name.toLowerCase().includes(searchTerm) &&
                    !task.description.toLowerCase().includes(searchTerm) &&
                    !task.projectName.toLowerCase().includes(searchTerm) &&
                    !(task.completionNote && task.completionNote.toLowerCase().includes(searchTerm))) {
                    return false;
                }
            }

            return true;
        });

        this.renderCompletedTasks();
        this.updateStats();
    }

    renderCompletedTasks() {
        const tasksList = document.getElementById('completedTasksList');
        const emptyState = document.getElementById('emptyCompletedTasks');
        
        if (!tasksList) return;

        if (this.filteredTasks.length === 0) {
            tasksList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        tasksList.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        tasksList.innerHTML = this.filteredTasks.map(task => this.renderTaskItem(task)).join('');
        this.updateSelectionInfo();
    }

    renderTaskItem(task) {
        const isSelected = this.selectedTasks.has(task.id);
        const completedDate = new Date(task.completedAt).toLocaleDateString();
        const completedTime = new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="completed-task-item ${isSelected ? 'selected' : ''}" data-task-id="${task.id}">
                <div class="task-selection-checkbox ${isSelected ? 'checked' : ''}" 
                     onclick="event.stopPropagation(); window.secondBrain.completedTasks.toggleTaskSelection(${task.id})"></div>
                <div class="completed-task-content" onclick="window.secondBrain.completedTasks.toggleTaskSelection(${task.id})">
                    <div class="completed-task-header">
                        <div class="completed-task-info">
                            <h3 class="completed-task-name">${task.name}</h3>
                            <p class="completed-task-project">${task.projectName}</p>
                            <p class="completed-task-description">${task.description}</p>
                        </div>
                        <div class="completed-task-details">
                            <div class="completed-task-detail">
                                <svg class="completed-task-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                                <span class="completed-task-detail-label">Hours:</span>
                                <span class="completed-task-detail-value">${task.hoursSpent}h</span>
                            </div>
                            <div class="completed-task-detail">
                                <svg class="completed-task-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                <span class="completed-task-detail-label">Date:</span>
                                <span class="completed-task-detail-value">${completedDate}</span>
                            </div>
                            <div class="completed-task-detail">
                                <svg class="completed-task-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                                <span class="completed-task-detail-label">Time:</span>
                                <span class="completed-task-detail-value">${completedTime}</span>
                            </div>
                        </div>
                    </div>
                    <div class="completed-task-meta">
                        ${task.price > 0 ? `<div class="completed-task-price">₹${task.price.toLocaleString()}</div>` : ''}
                        <button class="edit-completion-date-btn" onclick="event.stopPropagation(); window.secondBrain.completedTasks.openEditCompletionDateModal(${task.id})" title="Edit completion date">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    </div>
                    ${task.completionNote ? `
                        <div class="completed-task-note">
                            <p class="completed-task-note-text">"${task.completionNote}"</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    toggleTaskSelection(taskId) {
        if (this.selectedTasks.has(taskId)) {
            this.selectedTasks.delete(taskId);
        } else {
            this.selectedTasks.add(taskId);
        }
        this.renderCompletedTasks();
        this.updateSelectionInfo();
    }

    selectAllTasks() {
        this.filteredTasks.forEach(task => {
            this.selectedTasks.add(task.id);
        });
        this.renderCompletedTasks();
        this.updateSelectionInfo();
    }

    clearSelection() {
        this.selectedTasks.clear();
        this.renderCompletedTasks();
        this.updateSelectionInfo();
    }

    clearAllFilters() {
        const projectFilter = document.getElementById('projectFilter');
        const dateRangeStart = document.getElementById('dateRangeStart');
        const dateRangeEnd = document.getElementById('dateRangeEnd');
        const searchInput = document.getElementById('searchTasks');

        if (projectFilter) projectFilter.value = '';
        if (dateRangeStart) dateRangeStart.value = '';
        if (dateRangeEnd) dateRangeEnd.value = '';
        if (searchInput) searchInput.value = '';

        this.filters = {
            project: '',
            dateStart: '',
            dateEnd: '',
            search: ''
        };

        this.filteredTasks = [...this.completedTasks];
        this.renderCompletedTasks();
        this.updateStats();
    }

    updateSelectionInfo() {
        const selectedCount = document.getElementById('selectedCount');
        const totalCount = document.getElementById('totalCount');
        const generateReportBtn = document.getElementById('generateReportBtn');

        if (selectedCount) selectedCount.textContent = this.selectedTasks.size;
        if (totalCount) totalCount.textContent = this.filteredTasks.length;
        if (generateReportBtn) {
            generateReportBtn.disabled = this.selectedTasks.size === 0;
        }
    }

    updateStats() {
        const totalCompletedTasks = document.getElementById('totalCompletedTasks');
        const totalHoursSpent = document.getElementById('totalHoursSpent');
        const totalValue = document.getElementById('totalValue');

        if (totalCompletedTasks) totalCompletedTasks.textContent = this.filteredTasks.length;
        
        const totalHours = this.filteredTasks.reduce((sum, task) => sum + (task.hoursSpent || 0), 0);
        if (totalHoursSpent) totalHoursSpent.textContent = `${totalHours}h`;
        
        const totalTaskValue = this.filteredTasks.reduce((sum, task) => sum + (task.price || 0), 0);
        if (totalValue) totalValue.textContent = `₹${totalTaskValue.toLocaleString()}`;
    }

    generateClientReport() {
        if (this.selectedTasks.size === 0) {
            alert('Please select at least one task to generate a report.');
            return;
        }

        const selectedTasksData = this.filteredTasks.filter(task => this.selectedTasks.has(task.id));
        
        // Create report data
        const reportData = {
            generatedAt: new Date().toISOString(),
            totalTasks: selectedTasksData.length,
            totalHours: selectedTasksData.reduce((sum, task) => sum + (task.hoursSpent || 0), 0),
            totalValue: selectedTasksData.reduce((sum, task) => sum + (task.price || 0), 0),
            tasks: selectedTasksData.map(task => ({
                name: task.name,
                project: task.projectName,
                company: task.companyName,
                description: task.description,
                hoursSpent: task.hoursSpent,
                price: task.price,
                completedAt: task.completedAt,
                completionNote: task.completionNote
            }))
        };

        // Generate and display HTML report
        this.displayHtmlReport(reportData);
    }

    displayHtmlReport(reportData) {
        // Create modal for displaying the HTML report
        const modal = document.createElement('div');
        modal.className = 'report-modal';
        modal.innerHTML = `
            <div class="report-modal-content">
                <div class="report-modal-header">
                    <h3 class="report-modal-title">Work Report</h3>
                    <button class="report-modal-close" onclick="this.closest('.report-modal').remove()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="report-modal-body">
                    <div class="report-actions">
                        <button class="btn btn-primary" onclick="window.secondBrain.completedTasks.copyReportToClipboard()">Copy HTML</button>
                        <button class="btn btn-secondary" onclick="window.secondBrain.completedTasks.downloadHtmlReport()">Download HTML</button>
                        <button class="btn btn-secondary" onclick="window.secondBrain.completedTasks.downloadPdfReport()">Export PDF</button>
                    </div>
                    <div class="report-preview">
                        <h4>Preview:</h4>
                        <div class="report-html-preview" id="reportHtmlPreview">
                            ${this.generateHtmlReport(reportData)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Store report data for copying/downloading
        this.currentReportData = reportData;

        // Add modal to page
        document.body.appendChild(modal);

        // Add modal styles if not already present
        if (!document.getElementById('reportModalStyles')) {
            const style = document.createElement('style');
            style.id = 'reportModalStyles';
            style.textContent = `
                .report-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    opacity: 0;
                    animation: fadeIn 0.3s ease forwards;
                }
                
                .report-modal-content {
                    background-color: var(--color-white);
                    border-radius: var(--border-radius);
                    max-width: 800px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    transform: scale(0.9);
                    animation: scaleIn 0.3s ease forwards;
                }
                
                .report-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--color-gray-200);
                }
                
                .report-modal-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--color-black);
                    margin: 0;
                }
                
                .report-modal-close {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    background: none;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    color: var(--color-gray-600);
                    transition: var(--transition);
                }
                
                .report-modal-close:hover {
                    background-color: var(--color-gray-100);
                    border-color: var(--color-gray-400);
                    color: var(--color-black);
                }
                
                .report-modal-body {
                    padding: 1.5rem;
                }
                
                .report-actions {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .report-preview h4 {
                    margin-bottom: 1rem;
                    color: var(--color-black);
                }
                
                .report-html-preview {
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--border-radius);
                    padding: 1rem;
                    background-color: var(--color-gray-50);
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                @keyframes fadeIn {
                    to { opacity: 1; }
                }
                
                @keyframes scaleIn {
                    to { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    generateHtmlReport(reportData) {
        const date = new Date(reportData.generatedAt).toLocaleDateString();
        
        let html = `
            <div style="font-family: Arial, sans-serif; color: black; background: white; padding: 20px; max-width: 1000px; margin: 0 auto;">
                <h1 style="text-align: center; margin-bottom: 30px; font-size: 24px; font-weight: bold;">WORK REPORT</h1>
                <p style="text-align: center; margin-bottom: 30px; font-size: 14px;">Generated on: ${date}</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background-color: #f5f5f5;">
                            <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Task Name</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Company</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Project</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Hours Spent</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Completion Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        reportData.tasks.forEach((task, index) => {
            const completedDate = new Date(task.completedAt).toLocaleDateString(); // Date only, no time
            html += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px;">${task.name}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${task.company}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${task.project}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${task.hoursSpent}h</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${completedDate}</td>
                </tr>
            `;
        });

        // Add total row
        html += `
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f0f0f0; font-weight: bold;">
                            <td style="border: 1px solid #000; padding: 8px; text-align: right;" colspan="3">TOTAL:</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: center;">${reportData.totalHours}h</td>
                            <td style="border: 1px solid #000; padding: 8px; text-align: center;">-</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        return html;
    }

    copyReportToClipboard() {
        if (!this.currentReportData) return;
        
        const htmlContent = this.generateHtmlReport(this.currentReportData);
        
        // Create a temporary textarea to copy the HTML
        const textarea = document.createElement('textarea');
        textarea.value = htmlContent;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        // Show success message
        alert('HTML report copied to clipboard!');
    }

    downloadHtmlReport() {
        if (!this.currentReportData) return;
        
        const htmlContent = this.generateHtmlReport(this.currentReportData);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `work-report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadPdfReport() {
        if (!this.currentReportData) return;
        
        try {
            // Check if jsPDF is available
            if (typeof window.jspdf === 'undefined') {
                alert('PDF library not loaded. Please refresh the page and try again.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation for better table fit
            
            // Set up fonts and colors
            doc.setFont('helvetica');
            doc.setFontSize(16);
            
            // Title
            doc.text('WORK REPORT', 105, 20, { align: 'center' });
            
            // Generation date
            const date = new Date(this.currentReportData.generatedAt).toLocaleDateString();
            doc.setFontSize(10);
            doc.text(`Generated on: ${date}`, 105, 30, { align: 'center' });
            
            // Table setup
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const tableWidth = pageWidth - (2 * margin);
            
            // Column widths (landscape mode)
            const colWidths = [50, 40, 40, 25, 30]; // Task, Company, Project, Hours, Date
            const colPositions = [margin];
            for (let i = 1; i < colWidths.length; i++) {
                colPositions.push(colPositions[i-1] + colWidths[i-1]);
            }
            
            // Table headers
            const headers = ['Task Name', 'Company', 'Project', 'Hours', 'Date'];
            let yPosition = 45;
            
            // Draw header row
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, yPosition - 5, tableWidth, 10, 'F');
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            headers.forEach((header, index) => {
                doc.text(header, colPositions[index] + 2, yPosition, { align: 'left' });
            });
            
            yPosition += 10;
            
            // Draw table rows
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            
            this.currentReportData.tasks.forEach((task, index) => {
                // Check if we need a new page
                if (yPosition > pageHeight - 30) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                const completedDate = new Date(task.completedAt).toLocaleDateString();
                const rowData = [
                    task.name,
                    task.company,
                    task.project,
                    `${task.hoursSpent}h`,
                    completedDate
                ];
                
                // Draw row background (alternating colors)
                if (index % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPosition - 4, tableWidth, 8, 'F');
                }
                
                // Draw cell borders and content
                rowData.forEach((cellData, colIndex) => {
                    // Truncate long text
                    let displayText = cellData;
                    if (colIndex === 0 && cellData.length > 25) {
                        displayText = cellData.substring(0, 22) + '...';
                    } else if (colIndex === 1 && cellData.length > 15) {
                        displayText = cellData.substring(0, 12) + '...';
                    } else if (colIndex === 2 && cellData.length > 15) {
                        displayText = cellData.substring(0, 12) + '...';
                    }
                    
                    doc.text(displayText, colPositions[colIndex] + 2, yPosition, { align: 'left' });
                });
                
                yPosition += 8;
            });
            
            // Draw total row
            yPosition += 5;
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPosition - 4, tableWidth, 8, 'F');
            
            doc.text('TOTAL:', colPositions[0] + 2, yPosition, { align: 'left' });
            doc.text(`${this.currentReportData.totalHours}h`, colPositions[3] + 2, yPosition, { align: 'left' });
            
            // Summary information
            yPosition += 20;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Total Tasks: ${this.currentReportData.totalTasks}`, margin, yPosition);
            doc.text(`Total Hours: ${this.currentReportData.totalHours}h`, margin, yPosition + 8);
            if (this.currentReportData.totalValue > 0) {
                doc.text(`Total Value: ₹${this.currentReportData.totalValue.toLocaleString()}`, margin, yPosition + 16);
            }
            
            // Save the PDF
            const fileName = `work-report-${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    // Edit Completion Date Methods
    openEditCompletionDateModal(taskId) {
        const task = this.completedTasks.find(t => t.id === taskId);
        if (!task) return;

        // Store the current task being edited
        this.currentEditingTask = task;

        // Set the task name in the modal
        const taskNameEl = document.getElementById('editCompletionTaskName');
        if (taskNameEl) {
            taskNameEl.textContent = task.name;
        }

        // Set current completion date and time
        const completionDate = new Date(task.completedAt);
        const dateInput = document.getElementById('editCompletionDate');
        const timeInput = document.getElementById('editCompletionTime');
        
        if (dateInput) {
            dateInput.value = completionDate.toISOString().split('T')[0];
        }
        
        if (timeInput) {
            timeInput.value = completionDate.toTimeString().slice(0, 5);
        }

        // Show the modal
        const modal = document.getElementById('editCompletionDateModal');
        if (modal) {
            modal.style.display = 'flex';
        }

        // Setup event listeners for the modal
        this.setupEditCompletionDateEventListeners();
    }

    setupEditCompletionDateEventListeners() {
        const modal = document.getElementById('editCompletionDateModal');
        const closeBtn = document.getElementById('editCompletionDateModalClose');
        const cancelBtn = document.getElementById('cancelEditCompletionDate');
        const saveBtn = document.getElementById('saveEditCompletionDate');

        // Close modal handlers
        const closeModal = () => {
            if (modal) modal.style.display = 'none';
            this.currentEditingTask = null;
        };

        if (closeBtn) closeBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;
        
        // Close on backdrop click
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) closeModal();
            };
        }

        // Save changes handler
        if (saveBtn) {
            saveBtn.onclick = () => this.saveCompletionDateChanges();
        }
    }

    async saveCompletionDateChanges() {
        if (!this.currentEditingTask) return;

        const dateInput = document.getElementById('editCompletionDate');
        const timeInput = document.getElementById('editCompletionTime');

        if (!dateInput || !timeInput || !dateInput.value || !timeInput.value) {
            alert('Please fill in both date and time fields.');
            return;
        }

        try {
            // Create new completion date
            const newCompletionDate = new Date(`${dateInput.value}T${timeInput.value}`);
            
            // Update the task in the original project
            await this.updateTaskCompletionDate(this.currentEditingTask, newCompletionDate);
            
            // Update the task in our local completed tasks array
            this.currentEditingTask.completedAt = newCompletionDate.toISOString();
            
            // Refresh the display
            this.renderCompletedTasks();
            this.updateStats();
            
            // Close modal
            const modal = document.getElementById('editCompletionDateModal');
            if (modal) modal.style.display = 'none';
            
            this.currentEditingTask = null;
            
            // Show success message
            if (window.secondBrain && window.secondBrain.showNotification) {
                window.secondBrain.showNotification('Completion date updated successfully!');
            }
            
        } catch (error) {
            console.error('Error updating completion date:', error);
            alert('Error updating completion date. Please try again.');
        }
    }

    async updateTaskCompletionDate(task, newCompletionDate) {
        // Find the original task in the CRM projects and update it
        if (window.secondBrain && window.secondBrain.crm && window.secondBrain.crm.projects) {
            for (const project of window.secondBrain.crm.projects) {
                const originalTask = this.findTaskInProject(project, task.id);
                if (originalTask) {
                    originalTask.completedAt = newCompletionDate.toISOString();
                    originalTask.updatedAt = new Date().toISOString();
                    
                    // Save the updated projects
                    await window.secondBrain.crm.saveProjects();
                    break;
                }
            }
        }
    }

    findTaskInProject(project, taskId) {
        // Search in main tasks
        for (const task of project.tasks) {
            if (task.id === taskId) return task;
            const found = this.findTaskInSubtasks(task, taskId);
            if (found) return found;
        }
        return null;
    }

    findTaskInSubtasks(task, taskId) {
        for (const subtask of task.subtasks) {
            if (subtask.id === taskId) return subtask;
            const found = this.findTaskInSubtasks(subtask, taskId);
            if (found) return found;
        }
        return null;
    }
}

// Notes Manager Class
class NotesManager {
    constructor(firebaseService) {
        this.firebase = firebaseService;
        this.notes = [];
        this.nextNoteId = 1;
    }

    // Note Management
    async addNote(title, content) {
        const note = {
            id: this.nextNoteId++,
            title: title.trim(),
            content: content.trim(),
            userId: this.firebase ? this.firebase.userId : 'anonymous_user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.push(note);
        await this.saveNotes();
        this.renderNotes();
        this.updateStats();
        return note;
    }

    async editNote(id, title, content) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.title = title.trim();
            note.content = content.trim();
            note.updatedAt = new Date().toISOString();
            
            await this.saveNotes();
            this.renderNotes();
            this.updateStats();
        }
    }

    async deleteNote(id) {
        try {
            // Delete from Firebase first
            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.deleteDocument('notes', id.toString());
                console.log('🗑️ Note deleted from Firebase:', id);
            }
            
            // Remove from local array
            this.notes = this.notes.filter(n => n.id !== id);
            
            // Save the updated notes list
            await this.saveNotes();
            this.renderNotes();
            this.updateStats();
            
            console.log('✅ Note deleted successfully:', id);
        } catch (error) {
            console.error('❌ Error deleting note:', error);
            // Still remove from local array even if Firebase delete fails
            this.notes = this.notes.filter(n => n.id !== id);
            await this.saveNotes();
            this.renderNotes();
            this.updateStats();
        }
    }

    // Data Persistence
    async saveNotes() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Save each note to Firebase
                for (const note of this.notes) {
                    note.userId = this.firebase.userId;
                    note.updatedAt = new Date().toISOString();
                    await this.firebase.setDocument('notes', note.id.toString(), note);
                }
                
                // Save counter
                await this.firebase.setDocument('notes_counters', 'counters', {
                    userId: this.firebase.userId,
                    nextNoteId: this.nextNoteId,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('📝 Notes saved to Firebase:', this.notes.length);
            } else {
                // Fallback to local storage
                localStorage.setItem('notes', JSON.stringify(this.notes));
                localStorage.setItem('notes_next_id', this.nextNoteId.toString());
                console.log('📝 Notes saved to local storage:', this.notes.length);
            }
            
            // Always save to local storage as backup
            localStorage.setItem('notes', JSON.stringify(this.notes));
            localStorage.setItem('notes_next_id', this.nextNoteId.toString());
        } catch (error) {
            console.error('Error saving notes:', error);
            // Fallback to local storage
            localStorage.setItem('notes', JSON.stringify(this.notes));
            localStorage.setItem('notes_next_id', this.nextNoteId.toString());
        }
    }

    async loadNotes() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Load notes from Firebase
                const firebaseNotes = await this.firebase.getCollection('notes');
                if (firebaseNotes && firebaseNotes.length > 0) {
                    // Filter notes by current user
                    this.notes = firebaseNotes.filter(note => note.userId === this.firebase.userId);
                    
                    // Load counter
                    const counter = await this.firebase.getDocument('notes_counters', 'counters');
                    if (counter && counter.userId === this.firebase.userId) {
                        this.nextNoteId = counter.nextNoteId || 1;
                    } else {
                        // Calculate next ID from existing notes
                        this.nextNoteId = Math.max(...this.notes.map(n => n.id), 0) + 1;
                    }
                    console.log('📝 Notes loaded from Firebase:', this.notes.length);
                } else {
                    // No Firebase data, try local storage
                    this.loadFromLocalStorage();
                }
            } else {
                // Firebase not initialized, use local storage
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            // Fallback to local storage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const savedNotes = localStorage.getItem('notes');
        const savedNextId = localStorage.getItem('notes_next_id');

        if (savedNotes) {
            this.notes = JSON.parse(savedNotes);
        }
        if (savedNextId) {
            this.nextNoteId = parseInt(savedNextId);
        }
        console.log('📝 Notes loaded from local storage:', this.notes.length);
    }

    // UI Methods
    renderNotes() {
        const notesList = document.getElementById('notesList');
        const emptyState = document.getElementById('notesEmptyState');
        
        if (!notesList) return;

        if (this.notes.length === 0) {
            notesList.innerHTML = '';
            if (emptyState) {
                notesList.appendChild(emptyState);
            }
            return;
        }

        // Sort notes by updated date (newest first)
        const sortedNotes = [...this.notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const notesHTML = sortedNotes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-header">
                    <h3 class="note-title">${note.title}</h3>
                    <div class="note-actions">
                        <button class="note-action-btn" onclick="window.secondBrain.notes.showEditNoteModal(${note.id})" title="Edit Note">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="note-action-btn" onclick="window.secondBrain.notes.deleteNote(${note.id}).catch(console.error)" title="Delete Note">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="note-content">${note.content}</div>
                <div class="note-meta">
                    <span class="note-date">${new Date(note.updatedAt).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');

        notesList.innerHTML = notesHTML;
    }

    updateStats() {
        const totalNotesEl = document.getElementById('totalNotes');
        const recentNotesEl = document.getElementById('recentNotes');

        if (totalNotesEl) {
            totalNotesEl.textContent = this.notes.length;
        }

        if (recentNotesEl) {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const recentCount = this.notes.filter(note => new Date(note.createdAt) > oneWeekAgo).length;
            recentNotesEl.textContent = recentCount;
        }
    }

    showAddNoteModal() {
        this.createModal('Add New Note', this.getAddNoteModalContent(), async (formData) => {
            await this.addNote(formData.title, formData.content);
        });
    }

    showEditNoteModal(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        this.createModal('Edit Note', this.getEditNoteModalContent(note), async (formData) => {
            await this.editNote(noteId, formData.title, formData.content);
        });
    }

    getAddNoteModalContent() {
        return `
            <form id="noteForm">
                <div class="form-group">
                    <label class="form-label" for="noteTitle">Title *</label>
                    <input type="text" id="noteTitle" name="title" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="noteContent">Content *</label>
                    <textarea id="noteContent" name="content" class="form-textarea" rows="6" required></textarea>
                </div>
            </form>
        `;
    }

    getEditNoteModalContent(note) {
        return `
            <form id="noteForm">
                <div class="form-group">
                    <label class="form-label" for="noteTitle">Title *</label>
                    <input type="text" id="noteTitle" name="title" class="form-input" value="${note.title}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="noteContent">Content *</label>
                    <textarea id="noteContent" name="content" class="form-textarea" rows="6" required>${note.content}</textarea>
                </div>
            </form>
        `;
    }

    createModal(title, content, onSubmit) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" id="submitNoteBtn">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const submitBtn = modal.querySelector('#submitNoteBtn');
        submitBtn.addEventListener('click', async () => {
            const form = modal.querySelector('#noteForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            if (data.title.trim() && data.content.trim()) {
                await onSubmit(data);
                modal.remove();
            }
        });

        // Focus on title input
        const titleInput = modal.querySelector('#noteTitle');
        if (titleInput) {
            titleInput.focus();
        }
    }
}

// Tasks Manager Class
class TasksManager {
    constructor(firebaseService) {
        this.firebase = firebaseService;
        this.tasks = [];
        this.nextTaskId = 1;
        this.currentFilter = 'all';
        this.searchTerm = '';
    }

    // Task Management
    async addTask(title, description, priority = 'medium', dueDate = null) {
        const task = {
            id: this.nextTaskId++,
            title: title.trim(),
            description: description.trim(),
            priority: priority,
            dueDate: dueDate,
            completed: false,
            userId: this.firebase ? this.firebase.userId : 'anonymous_user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.tasks.push(task);
        await this.saveTasks();
        this.renderTasks();
        this.updateStats();
        return task;
    }

    async editTask(id, title, description, priority, dueDate) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.title = title.trim();
            task.description = description.trim();
            task.priority = priority;
            task.dueDate = dueDate;
            task.updatedAt = new Date().toISOString();
            
            await this.saveTasks();
            this.renderTasks();
            this.updateStats();
        }
    }

    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.updatedAt = new Date().toISOString();
            
            await this.saveTasks();
            this.renderTasks();
            this.updateStats();
        }
    }

    async deleteTask(id) {
        try {
            // Delete from Firebase first
            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.deleteDocument('tasks', id.toString());
                console.log('🗑️ Task deleted from Firebase:', id);
            }
            
            // Remove from local array
            this.tasks = this.tasks.filter(t => t.id !== id);
            
            // Save the updated tasks list
            await this.saveTasks();
            this.renderTasks();
            this.updateStats();
            
            console.log('✅ Task deleted successfully:', id);
        } catch (error) {
            console.error('❌ Error deleting task:', error);
            // Still remove from local array even if Firebase delete fails
            this.tasks = this.tasks.filter(t => t.id !== id);
            await this.saveTasks();
            this.renderTasks();
            this.updateStats();
        }
    }

    // Data Persistence
    async saveTasks() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Save each task to Firebase
                for (const task of this.tasks) {
                    task.userId = this.firebase.userId;
                    task.updatedAt = new Date().toISOString();
                    await this.firebase.setDocument('tasks', task.id.toString(), task);
                }
                
                // Save counter
                await this.firebase.setDocument('tasks_counters', 'counters', {
                    userId: this.firebase.userId,
                    nextTaskId: this.nextTaskId,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('✅ Tasks saved to Firebase:', this.tasks.length);
            } else {
                // Fallback to local storage
                localStorage.setItem('tasks', JSON.stringify(this.tasks));
                localStorage.setItem('tasks_next_id', this.nextTaskId.toString());
                console.log('✅ Tasks saved to local storage:', this.tasks.length);
            }
            
            // Always save to local storage as backup
            localStorage.setItem('tasks', JSON.stringify(this.tasks));
            localStorage.setItem('tasks_next_id', this.nextTaskId.toString());
        } catch (error) {
            console.error('Error saving tasks:', error);
            // Fallback to local storage
            localStorage.setItem('tasks', JSON.stringify(this.tasks));
            localStorage.setItem('tasks_next_id', this.nextTaskId.toString());
        }
    }

    async loadTasks() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Load tasks from Firebase
                const firebaseTasks = await this.firebase.getCollection('tasks');
                if (firebaseTasks && firebaseTasks.length > 0) {
                    // Filter tasks by current user
                    this.tasks = firebaseTasks.filter(task => task.userId === this.firebase.userId);
                    
                    // Load counter
                    const counter = await this.firebase.getDocument('tasks_counters', 'counters');
                    if (counter && counter.userId === this.firebase.userId) {
                        this.nextTaskId = counter.nextTaskId || 1;
                    } else {
                        // Calculate next ID from existing tasks
                        this.nextTaskId = Math.max(...this.tasks.map(t => t.id), 0) + 1;
                    }
                    console.log('✅ Tasks loaded from Firebase:', this.tasks.length);
                } else {
                    // No Firebase data, try local storage
                    this.loadFromLocalStorage();
                }
            } else {
                // Firebase not initialized, use local storage
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            // Fallback to local storage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const savedTasks = localStorage.getItem('tasks');
        const savedNextId = localStorage.getItem('tasks_next_id');

        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        }
        if (savedNextId) {
            this.nextTaskId = parseInt(savedNextId);
        }
        console.log('✅ Tasks loaded from local storage:', this.tasks.length);
    }

    // UI Methods
    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        const emptyState = document.getElementById('tasksEmptyState');
        
        if (!tasksList) return;

        let filteredTasks = this.getFilteredTasks();

        if (filteredTasks.length === 0) {
            tasksList.innerHTML = '';
            if (emptyState) {
                tasksList.appendChild(emptyState);
            }
            return;
        }

        // Sort tasks: pending first, then by priority, then by due date
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            if (a.dueDate && b.dueDate) {
                return new Date(a.dueDate) - new Date(b.dueDate);
            }
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        const tasksHTML = filteredTasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-checkbox">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} 
                               onchange="window.secondBrain.tasks.toggleTask(${task.id}).catch(console.error)">
                    </div>
                    <div class="task-content">
                        <h3 class="task-title">${task.title}</h3>
                        <p class="task-description">${task.description}</p>
                    </div>
                    <div class="task-actions">
                        <span class="task-priority priority-${task.priority}">${task.priority}</span>
                        <button class="task-action-btn" onclick="window.secondBrain.tasks.showEditTaskModal(${task.id})" title="Edit Task">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="task-action-btn" onclick="window.secondBrain.tasks.deleteTask(${task.id}).catch(console.error)" title="Delete Task">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                ${task.dueDate ? `<div class="task-due-date">Due: ${new Date(task.dueDate).toLocaleDateString()}</div>` : ''}
            </div>
        `).join('');

        tasksList.innerHTML = tasksHTML;
    }

    getFilteredTasks() {
        let filtered = this.tasks;

        // Apply filter
        if (this.currentFilter === 'pending') {
            filtered = filtered.filter(task => !task.completed);
        } else if (this.currentFilter === 'completed') {
            filtered = filtered.filter(task => task.completed);
        }

        // Apply search
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(term) || 
                task.description.toLowerCase().includes(term)
            );
        }

        return filtered;
    }

    filterTasks() {
        const filterSelect = document.getElementById('taskFilter');
        if (filterSelect) {
            this.currentFilter = filterSelect.value;
            this.renderTasks();
        }
    }

    searchTasks() {
        const searchInput = document.getElementById('searchTasks');
        if (searchInput) {
            this.searchTerm = searchInput.value;
            this.renderTasks();
        }
    }

    updateStats() {
        const totalTasksEl = document.getElementById('totalTasks');
        const completedTasksEl = document.getElementById('completedTasks');
        const pendingTasksEl = document.getElementById('pendingTasks');

        if (totalTasksEl) {
            totalTasksEl.textContent = this.tasks.length;
        }

        if (completedTasksEl) {
            const completedCount = this.tasks.filter(task => task.completed).length;
            completedTasksEl.textContent = completedCount;
        }

        if (pendingTasksEl) {
            const pendingCount = this.tasks.filter(task => !task.completed).length;
            pendingTasksEl.textContent = pendingCount;
        }
    }

    showAddTaskModal() {
        this.createModal('Add New Task', this.getAddTaskModalContent(), async (formData) => {
            await this.addTask(formData.title, formData.description, formData.priority, formData.dueDate || null);
        });
    }

    showEditTaskModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.createModal('Edit Task', this.getEditTaskModalContent(task), async (formData) => {
            await this.editTask(taskId, formData.title, formData.description, formData.priority, formData.dueDate || null);
        });
    }

    getAddTaskModalContent() {
        return `
            <form id="taskForm">
                <div class="form-group">
                    <label class="form-label" for="taskTitle">Title *</label>
                    <input type="text" id="taskTitle" name="title" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskDescription">Description</label>
                    <textarea id="taskDescription" name="description" class="form-textarea" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskPriority">Priority</label>
                    <select id="taskPriority" name="priority" class="form-input">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskDueDate">Due Date</label>
                    <input type="date" id="taskDueDate" name="dueDate" class="form-input">
                </div>
            </form>
        `;
    }

    getEditTaskModalContent(task) {
        return `
            <form id="taskForm">
                <div class="form-group">
                    <label class="form-label" for="taskTitle">Title *</label>
                    <input type="text" id="taskTitle" name="title" class="form-input" value="${task.title}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskDescription">Description</label>
                    <textarea id="taskDescription" name="description" class="form-textarea" rows="3">${task.description}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskPriority">Priority</label>
                    <select id="taskPriority" name="priority" class="form-input">
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskDueDate">Due Date</label>
                    <input type="date" id="taskDueDate" name="dueDate" class="form-input" value="${task.dueDate || ''}">
                </div>
            </form>
        `;
    }

    createModal(title, content, onSubmit) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" id="submitTaskBtn">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const submitBtn = modal.querySelector('#submitTaskBtn');
        submitBtn.addEventListener('click', async () => {
            const form = modal.querySelector('#taskForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            if (data.title.trim()) {
                await onSubmit(data);
                modal.remove();
            }
        });

        // Focus on title input
        const titleInput = modal.querySelector('#taskTitle');
        if (titleInput) {
            titleInput.focus();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize with lazy loading for better performance
    window.secondBrain = new SecondBrain();
    
    // Add loading indicators for better UX
    const addLoadingIndicator = () => {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading...</p>
            </div>
        `;
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-family: var(--font-family);
        `;
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    };

    // Show loading indicator initially
    const loadingIndicator = addLoadingIndicator();
    
    // Hide loading indicator after a short delay to allow for smooth initialization
    setTimeout(() => {
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
    }, 1000);
});

// Simple Goals System
let goals = [];

// Old function-based goals system - now using GoalsManager class
// async function initializeGoals() {
//     console.log('🔄 Initializing Goals module...');
//     const addBtn = document.getElementById('addGoalBtn');
//     if (addBtn) {
//         addBtn.onclick = addGoal;
//     }
//     await loadGoals();
//     displayGoals();
//     console.log('✅ Goals module initialized successfully');
// }

async function loadGoals() {
    try {
        if (window.secondBrain && window.secondBrain.firebase && window.secondBrain.firebase.isInitialized) {
            // Load goals from Firebase
            const firebaseGoals = await window.secondBrain.firebase.getCollection('simple_goals');
            if (firebaseGoals && firebaseGoals.length > 0) {
                // Filter goals by current user
                goals = firebaseGoals.filter(goal => goal.userId === window.secondBrain.firebase.userId);
                console.log('🎯 Simple goals loaded from Firebase:', goals.length);
            } else {
                // No Firebase data, try local storage
                loadGoalsFromLocalStorage();
            }
        } else {
            // Firebase not initialized, use local storage
            loadGoalsFromLocalStorage();
        }
    } catch (error) {
        console.error('Error loading simple goals:', error);
        // Fallback to local storage
        loadGoalsFromLocalStorage();
    }
}

function loadGoalsFromLocalStorage() {
    const savedGoals = localStorage.getItem('goals');
    if (savedGoals) {
        goals = JSON.parse(savedGoals);
    }
    console.log('🎯 Simple goals loaded from local storage:', goals.length);
}

async function saveGoals() {
    try {
        if (window.secondBrain && window.secondBrain.firebase && window.secondBrain.firebase.isInitialized) {
            // Save each goal to Firebase
            for (const goal of goals) {
                goal.userId = window.secondBrain.firebase.userId;
                goal.updatedAt = new Date().toISOString();
                await window.secondBrain.firebase.setDocument('simple_goals', goal.id.toString(), goal);
            }
            console.log('🎯 Simple goals saved to Firebase:', goals.length);
        } else {
            // Fallback to local storage
            localStorage.setItem('goals', JSON.stringify(goals));
            console.log('🎯 Simple goals saved to local storage:', goals.length);
        }
        
        // Always save to local storage as backup
        localStorage.setItem('goals', JSON.stringify(goals));
    } catch (error) {
        console.error('Error saving simple goals:', error);
        // Fallback to local storage
        localStorage.setItem('goals', JSON.stringify(goals));
    }
}

// Old function-based addGoal - now using GoalsManager class
// async function addGoal() {
//     const name = prompt('Enter goal name:');
//     if (!name) return;
//     
//     const target = prompt('Enter target amount (₹):');
//     if (!target) return;
//     
//     const targetDate = prompt('Enter target date (YYYY-MM-DD):', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
//     if (!targetDate) return;
//     
//     const goal = {
//         id: Date.now(),
//         name: name,
//         target: parseFloat(target),
//         current: 0,
//         targetDate: targetDate,
//         image: null,
//         date: new Date().toLocaleDateString(),
//         userId: window.secondBrain && window.secondBrain.firebase ? window.secondBrain.firebase.userId : 'anonymous_user',
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString()
//     };
//     
//     goals.push(goal);
//     await saveGoals();
//     
//     // Log the activity
//     logActivity('Goals', 'Added', `Created new goal: "${name}" with target amount ₹${target}`);
//     
//     displayGoals();
// }

// Old function-based displayGoals - now using GoalsManager class
// function displayGoals() {
//     const list = document.getElementById('goalsList');
//     if (!list) return;
//     
//     if (goals.length === 0) {
//         list.innerHTML = '<p>No goals yet. Click "New Goal" to get started!</p>';
//         return;
//     }
//     
//     list.innerHTML = goals.map(goal => {
//         const progress = (goal.current / goal.target) * 100;
//         const countdown = getCountdown(goal.targetDate);
//         const imageHtml = goal.image ? `<img src="${goal.image}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px; margin: 10px 0;" onclick="showFullImage('${goal.image}')">` : '';
//         
//         return `
//             <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; display: flex; gap: 15px;">
//                 <div style="flex: 1;">
//                     ${imageHtml}
//                     <h3>${goal.name}</h3>
//                     <p><strong>Target:</strong> ₹${goal.target.toLocaleString('en-IN')}</p>
//                     <p><strong>Current:</strong> ₹${goal.current.toLocaleString('en-IN')}</p>
//                     <p><strong>Time Left:</strong> <span style="color: #000000">${countdown.text}</span></p>
//                     <div style="background: #f0f0f0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0;">
//                         <div style="background: #000000; height: 100%; width: ${Math.min(progress, 100)}%; transition: width 0.3s;"></div>
//                     </div>
//                     <p><strong>Progress:</strong> ${Math.round(progress)}%</p>
//                     <div style="margin-top: 10px;">
//                         <button onclick="updateGoal(${goal.id})" style="margin-right: 10px; padding: 5px 10px;">Update Amount</button>
//                         <button onclick="addImage(${goal.id})" style="margin-right: 10px; padding: 5px 10px; background: #000000; color: white;">Add Image</button>
//                         <button onclick="deleteGoal(${goal.id})" style="background: #000000; color: white; padding: 5px 10px;">Delete</button>
//                     </div>
//                 </div>
//             </div>
//         `;
//     }).join('');
// }

async function updateGoal(id) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    const amount = prompt(`Enter new amount for "${goal.name}" (₹):`, goal.current);
    if (amount === null) return;
    
    const oldAmount = goal.current;
    goal.current = parseFloat(amount) || 0;
    goal.updatedAt = new Date().toISOString();
    await saveGoals();
    
    // Log the activity
    logActivity('Goals', 'Updated', `Updated goal "${goal.name}": ₹${oldAmount} → ₹${goal.current}`);
    
    displayGoals();
}

async function deleteGoal(id) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    if (confirm('Are you sure you want to delete this goal?')) {
        try {
            // Delete from Firebase first
            if (window.secondBrain && window.secondBrain.firebase && window.secondBrain.firebase.isInitialized) {
                await window.secondBrain.firebase.deleteDocument('simple_goals', id.toString());
                console.log('🗑️ Goal deleted from Firebase:', id);
            }
            
            // Remove from local array
            goals = goals.filter(g => g.id !== id);
            
            // Save the updated goals list
            await saveGoals();
            
            // Log the activity
            logActivity('Goals', 'Deleted', `Deleted goal: "${goal.name}"`);
            
            displayGoals();
            console.log('✅ Goal deleted successfully:', id);
        } catch (error) {
            console.error('❌ Error deleting goal:', error);
            // Still remove from local array even if Firebase delete fails
            goals = goals.filter(g => g.id !== id);
            await saveGoals();
            displayGoals();
        }
    }
}

function getCountdown(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target - now;
    
    if (diff <= 0) {
        return { text: 'Time\'s up!', days: 0 };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return { text: `${days} days, ${hours} hours`, days: days };
    } else if (hours > 0) {
        return { text: `${hours} hours, ${minutes} minutes`, days: 0 };
    } else {
        return { text: `${minutes} minutes`, days: 0 };
    }
}

function addImage(id) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                goal.image = e.target.result;
                goal.updatedAt = new Date().toISOString();
                await saveGoals();
                
                // Log the activity
                logActivity('Goals', 'Updated', `Added image to goal: "${goal.name}"`);
                
                displayGoals();
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function showFullImage(imageSrc) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 10000; cursor: pointer;
    `;
    modal.innerHTML = `
        <img src="${imageSrc}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
    `;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

// Settings System
let settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
let currentTheme = settings.theme || 'light';

// Default settings
const defaultSettings = {
    theme: 'light',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    firstDayOfWeek: 'monday',
    autoSaveInterval: 'immediate',
    confirmDialogs: true,
    soundNotifications: false
};

function initializeSettings() {
    loadSettings();
    setupSettingsEventListeners();
    updateDataStats();
    applyTheme(currentTheme);
}

function loadSettings() {
    // Merge with defaults
    settings = { ...defaultSettings, ...settings };
    
    // Load settings into UI
    document.getElementById('themeSelect').value = settings.theme;
    document.getElementById('currencySelect').value = settings.currency;
    document.getElementById('dateFormat').value = settings.dateFormat;
    document.getElementById('firstDayOfWeek').value = settings.firstDayOfWeek;
    document.getElementById('autoSaveInterval').value = settings.autoSaveInterval;
    document.getElementById('confirmDialogs').checked = settings.confirmDialogs;
    document.getElementById('soundNotifications').checked = settings.soundNotifications;
}

function setupSettingsEventListeners() {
    // Theme management
    document.getElementById('themeSelect').addEventListener('change', (e) => {
        currentTheme = e.target.value;
        applyTheme(currentTheme);
    });
    
    document.getElementById('previewTheme').addEventListener('click', () => {
        const current = currentTheme;
        currentTheme = current === 'light' ? 'dark' : 'light';
        applyTheme(currentTheme);
        setTimeout(() => {
            currentTheme = current;
            applyTheme(current);
        }, 2000);
    });

    // Data management
    document.getElementById('exportData').addEventListener('click', exportAllData);
    document.getElementById('importData').addEventListener('click', importData);
    document.getElementById('backupData').addEventListener('click', createBackup);
    document.getElementById('clearAllData').addEventListener('click', clearAllData);
    
    // Settings actions
    document.getElementById('saveSettings').addEventListener('click', saveAllSettings);
    document.getElementById('resetSettings').addEventListener('click', resetToDefaults);
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.style.setProperty('--color-bg-primary', '#000000');
        root.style.setProperty('--color-bg-secondary', '#1a1a1a');
        root.style.setProperty('--color-text-primary', '#ffffff');
        root.style.setProperty('--color-text-secondary', '#cccccc');
        root.style.setProperty('--color-border', '#333333');
    } else {
        root.style.setProperty('--color-bg-primary', '#ffffff');
        root.style.setProperty('--color-bg-secondary', '#f8f9fa');
        root.style.setProperty('--color-text-primary', '#000000');
        root.style.setProperty('--color-text-secondary', '#666666');
        root.style.setProperty('--color-border', '#e0e0e0');
    }
    currentTheme = theme;
}

function saveAllSettings() {
    const oldSettings = { ...settings };
    settings = {
        theme: document.getElementById('themeSelect').value,
        currency: document.getElementById('currencySelect').value,
        dateFormat: document.getElementById('dateFormat').value,
        firstDayOfWeek: document.getElementById('firstDayOfWeek').value,
        autoSaveInterval: document.getElementById('autoSaveInterval').value,
        confirmDialogs: document.getElementById('confirmDialogs').checked,
        soundNotifications: document.getElementById('soundNotifications').checked
    };
    
    localStorage.setItem('appSettings', JSON.stringify(settings));
    
    // Log the activity
    const changes = [];
    if (oldSettings.theme !== settings.theme) changes.push(`Theme: ${oldSettings.theme} → ${settings.theme}`);
    if (oldSettings.currency !== settings.currency) changes.push(`Currency: ${oldSettings.currency} → ${settings.currency}`);
    if (oldSettings.dateFormat !== settings.dateFormat) changes.push(`Date Format: ${oldSettings.dateFormat} → ${settings.dateFormat}`);
    if (oldSettings.firstDayOfWeek !== settings.firstDayOfWeek) changes.push(`First Day: ${oldSettings.firstDayOfWeek} → ${settings.firstDayOfWeek}`);
    if (oldSettings.autoSaveInterval !== settings.autoSaveInterval) changes.push(`Auto-save: ${oldSettings.autoSaveInterval} → ${settings.autoSaveInterval}`);
    if (oldSettings.confirmDialogs !== settings.confirmDialogs) changes.push(`Confirm Dialogs: ${oldSettings.confirmDialogs} → ${settings.confirmDialogs}`);
    if (oldSettings.soundNotifications !== settings.soundNotifications) changes.push(`Sound Notifications: ${oldSettings.soundNotifications} → ${settings.soundNotifications}`);
    
    if (changes.length > 0) {
        logActivity('Settings', 'Updated', `Changed settings: ${changes.join(', ')}`);
    }
    
    showNotification('Settings saved successfully!');
}

function resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
        settings = { ...defaultSettings };
        localStorage.setItem('appSettings', JSON.stringify(settings));
        loadSettings();
        applyTheme(settings.theme);
        showNotification('Settings reset to defaults!');
    }
}

function exportAllData() {
    const data = {
        settings: settings,
        goals: JSON.parse(localStorage.getItem('goals') || '[]'),
        habits: JSON.parse(localStorage.getItem('habits_data') || '[]'),
        wallet: JSON.parse(localStorage.getItem('wallet_data') || '[]'),
        crm: JSON.parse(localStorage.getItem('crm_data') || '[]'),
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `second-brain-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Log the activity
    logActivity('Settings', 'Completed', 'Exported all app data as backup');
    
    showNotification('Data exported successfully!');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.settings) {
                        localStorage.setItem('appSettings', JSON.stringify(data.settings));
                        settings = data.settings;
                    }
                    if (data.goals) localStorage.setItem('goals', JSON.stringify(data.goals));
                    if (data.habits) localStorage.setItem('habits_data', JSON.stringify(data.habits));
                    if (data.wallet) localStorage.setItem('wallet_data', JSON.stringify(data.wallet));
                    if (data.crm) localStorage.setItem('crm_data', JSON.stringify(data.crm));
                    
                    // Log the activity
                    logActivity('Settings', 'Completed', 'Imported data from backup file');
                    
                    showNotification('Data imported successfully! Please refresh the page.');
                } catch (error) {
                    showNotification('Error importing data: Invalid file format', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const data = {
        settings: settings,
        goals: JSON.parse(localStorage.getItem('goals') || '[]'),
        habits: JSON.parse(localStorage.getItem('habits_data') || '[]'),
        wallet: JSON.parse(localStorage.getItem('wallet_data') || '[]'),
        crm: JSON.parse(localStorage.getItem('crm_data') || '[]'),
        backupDate: new Date().toISOString(),
        version: '1.0.0'
    };
    
    localStorage.setItem(`backup_${timestamp}`, JSON.stringify(data));
    
    // Log the activity
    logActivity('Settings', 'Completed', 'Created local backup with timestamp');
    
    showNotification('Backup created successfully!');
}

function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
        if (confirm('This will delete everything. Are you absolutely sure?')) {
            // Log the activity before clearing
            logActivity('Settings', 'Completed', 'Cleared all app data - complete reset');
            
            localStorage.clear();
            showNotification('All data cleared. Page will refresh.', 'warning');
            setTimeout(() => location.reload(), 2000);
        }
    }
}

function updateDataStats() {
    const stats = {
        goals: JSON.parse(localStorage.getItem('goals') || '[]').length,
        habits: JSON.parse(localStorage.getItem('habits_data') || '[]').length,
        wallet: JSON.parse(localStorage.getItem('wallet_data') || '[]').length,
        crm: JSON.parse(localStorage.getItem('crm_data') || '[]').length
    };
    
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = `
        <div class="stat-item">Goals: ${stats.goals}</div>
        <div class="stat-item">Habits: ${stats.habits}</div>
        <div class="stat-item">Wallet Transactions: ${stats.wallet}</div>
        <div class="stat-item">CRM Projects: ${stats.crm}</div>
    `;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        padding: 15px 20px; border-radius: 5px; color: white;
        background: #000000;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Activity Log System
let activityLogs = JSON.parse(localStorage.getItem('activityLogs') || '[]');

// Add sample logs if none exist
if (activityLogs.length === 0) {
    const sampleLogs = [
        {
            id: Date.now() - 1000,
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            module: 'Goals',
            action: 'Added',
            details: 'Created new goal: "Save for Vacation" with target amount ₹50000'
        },
        {
            id: Date.now() - 2000,
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            module: 'Settings',
            action: 'Updated',
            details: 'Changed settings: Theme: light → dark'
        },
        {
            id: Date.now() - 3000,
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            module: 'Goals',
            action: 'Updated',
            details: 'Updated goal "Save for Vacation": ₹0 → ₹5000'
        }
    ];
    activityLogs = sampleLogs;
    localStorage.setItem('activityLogs', JSON.stringify(activityLogs));
}

function logActivity(module, action, details) {
    const logEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        module: module,
        action: action,
        details: details
    };
    
    activityLogs.unshift(logEntry); // Add to beginning (newest first)
    
    // Keep only last 1000 entries to prevent storage bloat
    if (activityLogs.length > 1000) {
        activityLogs = activityLogs.slice(0, 1000);
    }
    
    localStorage.setItem('activityLogs', JSON.stringify(activityLogs));
}

function initializeLogs() {
    setupLogsEventListeners();
    displayLogs();
    updateLogStats();
}

function setupLogsEventListeners() {
    // Filter controls
    document.getElementById('applyFilters').addEventListener('click', applyLogFilters);
    document.getElementById('clearFilters').addEventListener('click', clearLogFilters);
    
    // Action buttons
    document.getElementById('exportLogs').addEventListener('click', exportLogs);
    document.getElementById('clearLogs').addEventListener('click', clearLogs);
}

function displayLogs(filteredLogs = null) {
    const logsList = document.getElementById('logsList');
    const logs = filteredLogs || activityLogs;
    
    if (logs.length === 0) {
        logsList.innerHTML = '<div class="no-logs">No activities found. Start using the app to see your activity log!</div>';
        return;
    }
    
    const logsHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const formattedDate = date.toLocaleDateString('en-CA') + ' ' + date.toLocaleTimeString('en-GB', { hour12: false });
        
        return `
            <div class="log-entry">
                <div class="log-timestamp">${formattedDate}</div>
                <div class="log-module">${log.module}</div>
                <div class="log-action">${log.action}</div>
                <div class="log-details">${log.details}</div>
            </div>
        `;
    }).join('');
    
    logsList.innerHTML = logsHTML;
}

function applyLogFilters() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const moduleFilter = document.getElementById('moduleFilter').value;
    const actionFilter = document.getElementById('actionFilter').value;
    
    let filteredLogs = activityLogs;
    
    // Date filter
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= fromDate);
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo + 'T23:59:59');
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= toDate);
    }
    
    // Module filter
    if (moduleFilter) {
        filteredLogs = filteredLogs.filter(log => log.module === moduleFilter);
    }
    
    // Action filter
    if (actionFilter) {
        filteredLogs = filteredLogs.filter(log => log.action === actionFilter);
    }
    
    displayLogs(filteredLogs);
}

function clearLogFilters() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('moduleFilter').value = '';
    document.getElementById('actionFilter').value = '';
    displayLogs();
}

function updateLogStats() {
    const total = activityLogs.length;
    const today = new Date().toDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const todayCount = activityLogs.filter(log => new Date(log.timestamp).toDateString() === today).length;
    const weekCount = activityLogs.filter(log => new Date(log.timestamp) >= weekAgo).length;
    
    document.getElementById('totalActivities').textContent = total;
    document.getElementById('todayActivities').textContent = todayCount;
    document.getElementById('weekActivities').textContent = weekCount;
}

function exportLogs() {
    const csvContent = [
        'Timestamp,Module,Action,Details',
        ...activityLogs.map(log => 
            `"${log.timestamp}","${log.module}","${log.action}","${log.details.replace(/"/g, '""')}"`
        )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Activity log exported successfully!');
}

function clearLogs() {
    const keepDays = prompt('How many days of logs to keep? (Enter 30, 90, or 0 for all):');
    if (keepDays === null) return;
    
    const days = parseInt(keepDays);
    if (isNaN(days) || days < 0) {
        showNotification('Invalid number of days', 'error');
        return;
    }
    
    if (days === 0) {
        if (confirm('Are you sure you want to delete ALL activity logs?')) {
            activityLogs = [];
            localStorage.setItem('activityLogs', JSON.stringify(activityLogs));
            displayLogs();
            updateLogStats();
            showNotification('All activity logs cleared!');
        }
    } else {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const beforeCount = activityLogs.length;
        activityLogs = activityLogs.filter(log => new Date(log.timestamp) >= cutoffDate);
        const afterCount = activityLogs.length;
        
        localStorage.setItem('activityLogs', JSON.stringify(activityLogs));
        displayLogs();
        updateLogStats();
        showNotification(`Cleared ${beforeCount - afterCount} old log entries. Kept ${afterCount} recent entries.`);
    }
}

// Calendar Class
class Calendar {
    constructor(initialDate = new Date(), firebaseService = null) {
        this.currentDate = new Date(initialDate);
        this.selectedDate = new Date();
        this.today = new Date();
        this.habitTracker = null;
        this.firebase = firebaseService;
        this.events = [];
        this.monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
    }

    setHabitTracker(habitTracker) {
        this.habitTracker = habitTracker;
    }

    async loadEvents() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const events = await this.firebase.getCalendarEvents();
                this.events = events.filter(event => event.userId === this.firebase.userId);
                console.log('📅 Calendar events loaded from Firebase:', this.events.length);
            } else {
                // Fallback to local storage
                const stored = localStorage.getItem('calendar_events');
                this.events = stored ? JSON.parse(stored) : [];
                console.log('📅 Calendar events loaded from local storage:', this.events.length);
            }
            this.render();
        } catch (error) {
            console.error('Error loading calendar events:', error);
            this.events = [];
        }
    }

    async saveEvent(event) {
        try {
            if (!event.id) {
                event.id = Date.now().toString();
            }
            event.userId = this.firebase ? this.firebase.userId : 'anonymous_user';
            event.createdAt = event.createdAt || new Date().toISOString();
            event.updatedAt = new Date().toISOString();

            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.saveCalendarEvent(event);
                console.log('📅 Event saved to Firebase:', event.title);
            } else {
                // Fallback to local storage
                const existingIndex = this.events.findIndex(e => e.id === event.id);
                if (existingIndex >= 0) {
                    this.events[existingIndex] = event;
                } else {
                    this.events.push(event);
                }
                localStorage.setItem('calendar_events', JSON.stringify(this.events));
                console.log('📅 Event saved to local storage:', event.title);
            }
            this.render();
        } catch (error) {
            console.error('Error saving calendar event:', error);
        }
    }

    async deleteEvent(eventId) {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.deleteCalendarEvent(eventId);
                console.log('📅 Event deleted from Firebase:', eventId);
            } else {
                // Fallback to local storage
                this.events = this.events.filter(event => event.id !== eventId);
                localStorage.setItem('calendar_events', JSON.stringify(this.events));
                console.log('📅 Event deleted from local storage:', eventId);
            }
            this.render();
        } catch (error) {
            console.error('Error deleting calendar event:', error);
        }
    }

    render() {
        this.updateMonthYear();
        this.renderDays();
    }

    updateMonthYear() {
        const monthYearElement = document.getElementById('calendarMonthYear');
        if (monthYearElement) {
            const month = this.monthNames[this.currentDate.getMonth()];
            const year = this.currentDate.getFullYear();
            monthYearElement.textContent = `${month} ${year}`;
        }
    }

    renderDays() {
        const daysContainer = document.getElementById('calendarDays');
        if (!daysContainer) return;

        // Clear existing days
        daysContainer.innerHTML = '';

        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            const prevMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 0);
            const dayNumber = prevMonth.getDate() - startingDayOfWeek + i + 1;
            const dayElement = this.createDayElement(dayNumber, true);
            daysContainer.appendChild(dayElement);
        }

        // Add days of the current month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = this.createDayElement(day, false);
            daysContainer.appendChild(dayElement);
        }

        // Add empty cells for days after the last day of the month
        const totalCells = daysContainer.children.length;
        const remainingCells = 42 - totalCells; // 6 weeks * 7 days = 42 cells
        for (let i = 1; i <= remainingCells; i++) {
            const dayElement = this.createDayElement(i, true);
            daysContainer.appendChild(dayElement);
        }
    }

    createDayElement(dayNumber, isOtherMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = dayNumber;

        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        } else {
            const dayDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), dayNumber);
            
            // Check if this is today
            if (this.isSameDay(dayDate, this.today)) {
                dayElement.classList.add('today');
            }

            // Check if this is the selected date
            if (this.isSameDay(dayDate, this.selectedDate)) {
                dayElement.classList.add('selected');
            }

            // Add habit progress visualization
            this.addHabitProgressToDay(dayElement, dayDate);

            // Add click event
            dayElement.addEventListener('click', () => {
                console.log('📅 Calendar: Day clicked:', dayDate);
                this.selectDate(dayDate);
                this.showHabitsForDate(dayDate);
            });
        }

        return dayElement;
    }

    addHabitProgressToDay(dayElement, dayDate) {
        if (!this.habitTracker) return;

        const progress = this.habitTracker.getDailyProgress(dayDate);
        this.applyProgressColor(dayElement, progress);
    }

    applyProgressColor(dayElement, progress) {
        // Remove existing progress classes
        dayElement.classList.remove('progress-0', 'progress-25', 'progress-50', 'progress-75', 'progress-100');
        
        // Add dynamic progress class
        dayElement.classList.add('progress-dynamic');
        
        // Calculate grayscale color based on progress percentage
        // 0% = black (#000000), 100% = white (#ffffff)
        const grayValue = Math.round((progress / 100) * 255);
        const backgroundColor = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        
        // Determine text color based on background brightness
        // Use white text for dark backgrounds (0-50%), black text for light backgrounds (51-100%)
        const textColor = grayValue <= 127 ? '#ffffff' : '#000000';
        
        // Apply colors
        dayElement.style.backgroundColor = backgroundColor;
        dayElement.style.color = textColor;
        
        // Add border for 100% completion to make it stand out
        if (progress === 100) {
            dayElement.style.border = '2px solid #000000';
        } else {
            dayElement.style.border = '1px solid var(--color-gray-200)';
        }
    }

    showHabitsForDate(date) {
        console.log('📅 Calendar: showHabitsForDate called for date:', date);
        
        if (!this.habitTracker) {
            console.error('❌ Calendar: No habit tracker available');
            return;
        }
        
        const modal = document.getElementById('habitModal');
        if (!modal) {
            console.log('📅 Calendar: Creating habit modal...');
            this.createHabitModal();
        }
        
        console.log('📅 Calendar: Calling habitTracker.showHabitsForDate...');
        this.habitTracker.showHabitsForDate(date);
    }

    createHabitModal() {
        const modalHTML = `
            <div class="habit-modal" id="habitModal">
                <div class="habit-modal-content">
                    <div class="habit-modal-header">
                        <h3 class="habit-modal-title">Habits for Selected Date</h3>
                        <button class="habit-modal-close" id="habitModalClose">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="habit-modal-body">
                        <div class="habit-modal-date" id="habitModalDate"></div>
                        <div class="habit-modal-progress">
                            <div class="habit-modal-progress-bar">
                                <div class="habit-modal-progress-fill" id="habitModalProgressFill"></div>
                            </div>
                            <span class="habit-modal-progress-text" id="habitModalProgressText">0%</span>
                        </div>
                        <div class="habit-modal-list" id="habitModalList"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habitModal');
        const closeBtn = document.getElementById('habitModalClose');
        
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('open');
            }
        });
    }

    updateHabitProgress() {
        if (!this.habitTracker) return;
        
        const dayElements = document.querySelectorAll('.calendar-day:not(.other-month)');
        dayElements.forEach(dayElement => {
            const dayNumber = parseInt(dayElement.textContent);
            const dayDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), dayNumber);
            this.addHabitProgressToDay(dayElement, dayDate);
        });
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    selectDate(date) {
        this.selectedDate = new Date(date);
        this.renderDays(); // Re-render to update selected state
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    }

    goToToday() {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.render();
    }

    getSelectedDate() {
        return this.selectedDate;
    }

    getCurrentDate() {
        return this.currentDate;
    }
}

// Habit Tracker Class
class HabitTracker {
    constructor(firebaseService = null) {
        this.habits = [];
        this.storageKey = 'secondBrainHabits';
        this.today = new Date().toDateString();
        this.calendar = null;
        this.firebase = firebaseService;
    }

    setCalendar(calendar) {
        this.calendar = calendar;
    }

    async loadHabits() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const habits = await this.firebase.getHabits();
                this.habits = habits.filter(habit => habit.userId === this.firebase.userId);
                console.log('🎯 Habits loaded from Firebase:', this.habits.length);
            } else {
                // Fallback to local storage
                const stored = localStorage.getItem(this.storageKey);
                this.habits = stored ? JSON.parse(stored) : [];
                console.log('🎯 Habits loaded from local storage:', this.habits.length);
            }
            this.renderHabits();
            this.updateStats();
        } catch (error) {
            console.error('Error loading habits:', error);
            this.habits = [];
        }
    }

    async saveHabits() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Save each habit to Firebase
                for (const habit of this.habits) {
                    habit.userId = this.firebase.userId;
                    habit.updatedAt = new Date().toISOString();
                    await this.firebase.saveHabit(habit);
                }
                console.log('🎯 Habits saved to Firebase:', this.habits.length);
            } else {
                // Fallback to local storage
                localStorage.setItem(this.storageKey, JSON.stringify(this.habits));
                console.log('🎯 Habits saved to local storage:', this.habits.length);
            }
            
            // Refresh dashboard widgets that depend on habits data
            if (window.refreshDashboardWidgets) {
                window.refreshDashboardWidgets('habits-streak');
            }
        } catch (error) {
            console.error('Error saving habits:', error);
        }
    }

    async addHabit(name, isQuantityEnabled = false, target = 1) {
        const habit = {
            id: Date.now().toString(),
            name: name,
            completedDates: [],
            createdAt: new Date().toISOString(),
            streak: 0,
            isQuantityEnabled: isQuantityEnabled,
            target: target,
            dailyQuantities: {} // Store daily quantities: { "2024-01-15": 3, "2024-01-16": 7 }
        };
        
        this.habits.push(habit);
        await this.saveHabits();
        this.renderHabits();
        this.updateStats();
        
        // Update calendar progress
        if (this.calendar) {
            this.calendar.updateHabitProgress();
        }
    }

    async removeHabit(id) {
        this.habits = this.habits.filter(habit => habit.id !== id);
        await this.saveHabits();
        this.renderHabits();
        this.updateStats();
        
        // Update calendar progress
        if (this.calendar) {
            this.calendar.updateHabitProgress();
        }
    }

    toggleHabit(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        if (habit.isQuantityEnabled) {
            this.incrementHabitQuantity(id);
        } else {
            const today = new Date().toDateString();
            const isCompleted = habit.completedDates.includes(today);

            if (isCompleted) {
                habit.completedDates = habit.completedDates.filter(date => date !== today);
            } else {
                habit.completedDates.push(today);
                // Trigger celebration when marking as complete
                this.triggerCelebration(id);
            }

            this.updateStreak(habit);
            this.saveHabits();
            this.renderHabits();
            this.updateStats();
            
            // Update calendar progress
            if (this.calendar) {
                this.calendar.updateHabitProgress();
            }
        }
    }

    incrementHabitQuantity(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit || !habit.isQuantityEnabled) return;

        const today = new Date().toDateString();
        const currentQuantity = habit.dailyQuantities[today] || 0;
        const newQuantity = currentQuantity + 1;

        habit.dailyQuantities[today] = newQuantity;

        // Check if target is reached
        if (newQuantity >= habit.target) {
            if (!habit.completedDates.includes(today)) {
                habit.completedDates.push(today);
                this.triggerCelebration(id);
            }
        } else if (habit.completedDates.includes(today)) {
            // Remove from completed if quantity drops below target
            habit.completedDates = habit.completedDates.filter(date => date !== today);
        }

        this.updateStreak(habit);
        this.saveHabits();
        this.renderHabits();
        this.updateStats();
        
        // Update calendar progress
        if (this.calendar) {
            this.calendar.updateHabitProgress();
        }
    }

    decrementHabitQuantity(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit || !habit.isQuantityEnabled) return;

        const today = new Date().toDateString();
        const currentQuantity = habit.dailyQuantities[today] || 0;
        
        if (currentQuantity > 0) {
            const newQuantity = currentQuantity - 1;
            habit.dailyQuantities[today] = newQuantity;

            // Check if target is no longer reached
            if (newQuantity < habit.target && habit.completedDates.includes(today)) {
                habit.completedDates = habit.completedDates.filter(date => date !== today);
            }

            this.updateStreak(habit);
            this.saveHabits();
            this.renderHabits();
            this.updateStats();
            
            // Update calendar progress
            if (this.calendar) {
                this.calendar.updateHabitProgress();
            }
        }
    }

    updateStreak(habit) {
        const sortedDates = habit.completedDates
            .map(date => new Date(date))
            .sort((a, b) => b - a);

        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < sortedDates.length; i++) {
            const habitDate = new Date(sortedDates[i]);
            habitDate.setHours(0, 0, 0, 0);

            if (habitDate.getTime() === currentDate.getTime()) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (habitDate.getTime() === currentDate.getTime()) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        habit.streak = streak;
    }

    getProgressPercentage(habit) {
        const today = new Date().toDateString();
        
        if (habit.isQuantityEnabled) {
            const currentQuantity = habit.dailyQuantities[today] || 0;
            return Math.min(Math.round((currentQuantity / habit.target) * 100), 100);
        } else {
            const isCompleted = habit.completedDates.includes(today);
            return isCompleted ? 100 : 0;
        }
    }

    getDailyProgress(date) {
        if (this.habits.length === 0) return 0;
        
        const dateString = date.toDateString();
        const completedHabits = this.habits.filter(habit => 
            habit.completedDates.includes(dateString)
        ).length;
        
        return Math.round((completedHabits / this.habits.length) * 100);
    }

    getHabitsForDate(date) {
        const dateString = date.toDateString();
        return this.habits.map(habit => ({
            ...habit,
            isCompleted: habit.completedDates.includes(dateString),
            currentQuantity: habit.isQuantityEnabled ? (habit.dailyQuantities[dateString] || 0) : 0
        }));
    }

    showHabitsForDate(date) {
        console.log('🎯 HabitTracker: showHabitsForDate called for date:', date);
        
        const modal = document.getElementById('habitModal');
        const modalDate = document.getElementById('habitModalDate');
        const modalProgressFill = document.getElementById('habitModalProgressFill');
        const modalProgressText = document.getElementById('habitModalProgressText');
        const modalList = document.getElementById('habitModalList');
        
        if (!modal) {
            console.error('❌ HabitTracker: Modal not found');
            return;
        }
        
        console.log('🎯 HabitTracker: Modal found, showing habits...');

        if (!modalDate || !modalProgressFill || !modalProgressText || !modalList) {
            console.error('❌ HabitTracker: Modal elements not found');
            return;
        }

        // Update modal date
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        modalDate.textContent = date.toLocaleDateString('en-US', dateOptions);

        // Calculate and display progress
        const progress = this.getDailyProgress(date);
        modalProgressFill.style.width = `${progress}%`;
        modalProgressText.textContent = `${progress}%`;

        // Display habits for the date
        const habitsForDate = this.getHabitsForDate(date);
        
        if (habitsForDate.length === 0) {
            modalList.innerHTML = `
                <div class="habit-modal-empty">
                    <div class="habit-modal-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
                        </svg>
                    </div>
                    <h3>No habits yet</h3>
                    <p>Add habits to start tracking your progress</p>
                </div>
            `;
        } else {
            const habitsHTML = habitsForDate.map(habit => {
                if (habit.isQuantityEnabled) {
                    return `
                        <div class="habit-modal-item ${habit.isCompleted ? 'completed' : ''}" data-habit-id="${habit.id}">
                            <div class="habit-modal-checkbox ${habit.isCompleted ? 'checked' : ''}"></div>
                            <div class="habit-modal-content">
                                <h4 class="habit-modal-name">${habit.name}</h4>
                                <div class="habit-modal-quantity">
                                    <div class="quantity-display">
                                        <span>${habit.currentQuantity}</span>
                                        <span class="habit-target">/ ${habit.target}</span>
                                    </div>
                                    <div class="quantity-buttons">
                                        <button class="quantity-btn" onclick="window.secondBrain.habitTracker.decrementHabitQuantityForDate('${habit.id}', '${date.toDateString()}')" ${habit.currentQuantity <= 0 ? 'disabled' : ''}>-</button>
                                        <button class="quantity-btn" onclick="window.secondBrain.habitTracker.incrementHabitQuantityForDate('${habit.id}', '${date.toDateString()}')">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="habit-modal-item ${habit.isCompleted ? 'completed' : ''}" data-habit-id="${habit.id}" 
                             onclick="window.secondBrain.habitTracker.toggleHabitForDate('${habit.id}', '${date.toDateString()}')">
                            <div class="habit-modal-checkbox ${habit.isCompleted ? 'checked' : ''}"></div>
                            <h4 class="habit-modal-name">${habit.name}</h4>
                        </div>
                    `;
                }
            }).join('');
            
            modalList.innerHTML = habitsHTML;
        }

        // Show modal
        modal.classList.add('open');
    }

    toggleHabitForDate(habitId, dateString) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        const isCompleted = habit.completedDates.includes(dateString);

        if (isCompleted) {
            habit.completedDates = habit.completedDates.filter(date => date !== dateString);
        } else {
            habit.completedDates.push(dateString);
            // Trigger celebration when marking as complete
            this.triggerModalCelebration(habitId);
        }

        this.updateStreak(habit);
        this.saveHabits();
        
        // Update the modal if it's open
        const modal = document.getElementById('habitModal');
        if (modal && modal.classList.contains('open')) {
            const date = new Date(dateString);
            this.showHabitsForDate(date);
        }
        
        // Update calendar progress
        if (this.calendar) {
            this.calendar.updateHabitProgress();
        }
        
        // Update main habits view
        this.renderHabits();
        this.updateStats();
    }

    renderHabits() {
        const habitsList = document.getElementById('habitsList');
        const emptyState = document.getElementById('emptyState');
        
        if (!habitsList) return;

        if (this.habits.length === 0) {
            habitsList.innerHTML = `
                <div class="empty-state" id="emptyState">
                    <div class="empty-state-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
                        </svg>
                    </div>
                    <h3>No habits yet</h3>
                    <p>Add your first habit to start tracking your progress</p>
                </div>
            `;
            return;
        }

        const habitsHTML = this.habits.map(habit => {
            const today = new Date().toDateString();
            const isCompleted = habit.completedDates.includes(today);
            const progress = this.getProgressPercentage(habit);
            const currentQuantity = habit.isQuantityEnabled ? (habit.dailyQuantities[today] || 0) : 0;
            
            return `
                <div class="habit-item ${isCompleted ? 'completed' : ''}" data-habit-id="${habit.id}" onclick="window.secondBrain.habitTracker.toggleHabit('${habit.id}')">
                    <div class="habit-checkbox ${isCompleted ? 'checked' : ''}"></div>
                    
                    <div class="habit-content">
                        <h3 class="habit-name">${habit.name}</h3>
                        ${habit.isQuantityEnabled ? `
                            <div class="habit-quantity">
                                <div class="quantity-display">
                                    <span>${currentQuantity}</span>
                                    <span class="habit-target">/ ${habit.target}</span>
                                </div>
                                <div class="quantity-buttons" onclick="event.stopPropagation()">
                                    <button class="quantity-btn" onclick="window.secondBrain.habitTracker.decrementHabitQuantity('${habit.id}')" ${currentQuantity <= 0 ? 'disabled' : ''}>-</button>
                                    <button class="quantity-btn" onclick="window.secondBrain.habitTracker.incrementHabitQuantity('${habit.id}')">+</button>
                                </div>
                            </div>
                            <div class="habit-progress-quantity">
                                <div class="progress-bar-quantity">
                                    <div class="progress-fill-quantity" style="width: ${progress}%"></div>
                                </div>
                                <span class="progress-text-quantity">${progress}%</span>
                            </div>
                        ` : `
                            <div class="habit-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progress}%"></div>
                                </div>
                                <span class="progress-text">${progress}%</span>
                            </div>
                        `}
                    </div>
                    
                    <div class="habit-actions" onclick="event.stopPropagation()">
                        <button class="habit-edit-btn" onclick="window.secondBrain.habitTracker.editHabit('${habit.id}')" title="Edit habit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="habit-delete-btn" onclick="window.secondBrain.habitTracker.removeHabit('${habit.id}')" title="Delete habit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        habitsList.innerHTML = habitsHTML;
    }

    updateStats() {
        const totalHabits = document.getElementById('totalHabits');
        const completedToday = document.getElementById('completedToday');
        const streakDays = document.getElementById('streakDays');

        if (totalHabits) {
            totalHabits.textContent = this.habits.length;
        }

        if (completedToday) {
            const today = new Date().toDateString();
            const completed = this.habits.filter(habit => 
                habit.completedDates.includes(today)
            ).length;
            completedToday.textContent = completed;
        }

        if (streakDays) {
            const maxStreak = this.habits.length > 0 ? 
                Math.max(...this.habits.map(habit => habit.streak)) : 0;
            streakDays.textContent = maxStreak;
        }
    }

    editHabit(id) {
        const habit = this.habits.find(h => h.id === id);
        if (!habit) return;

        const newName = prompt('Edit habit name:', habit.name);
        if (newName && newName.trim() && newName.trim() !== habit.name) {
            habit.name = newName.trim();
            this.saveHabits();
            this.renderHabits();
        }
    }

    triggerCelebration(habitId) {
        // Find the habit element
        const habitElement = document.querySelector(`[data-habit-id="${habitId}"]`);
        if (!habitElement) return;

        // Add bounce animation to the habit item
        habitElement.classList.add('habit-completion-bounce');
        setTimeout(() => {
            habitElement.classList.remove('habit-completion-bounce');
        }, 600);

        // Add pop animation to the checkbox
        const checkbox = habitElement.querySelector('.habit-checkbox');
        if (checkbox) {
            checkbox.classList.add('checkbox-celebration');
            setTimeout(() => {
                checkbox.classList.remove('checkbox-celebration');
            }, 400);
        }

        // Add shine animation to progress bar
        const progressBar = habitElement.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.classList.add('progress-celebration');
            setTimeout(() => {
                progressBar.classList.remove('progress-celebration');
            }, 800);
        }

        // Create confetti celebration
        this.createConfetti(habitElement);

        // Show celebration emoji
        this.showCelebrationEmoji(habitElement);

        // Check if all habits are completed for today
        this.checkAllHabitsCompleted();
    }

    createConfetti(habitElement) {
        const rect = habitElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Create confetti container
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'celebration-container';
        document.body.appendChild(confettiContainer);

        // Create confetti pieces
        for (let i = 0; i < 15; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            // Random position around the habit element
            const angle = (i / 15) * Math.PI * 2;
            const distance = 50 + Math.random() * 30;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            confetti.style.left = x + 'px';
            confetti.style.top = y + 'px';
            
            // Random rotation
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            
            confettiContainer.appendChild(confetti);
        }

        // Remove confetti container after animation
        setTimeout(() => {
            document.body.removeChild(confettiContainer);
        }, 2000);
    }

    showCelebrationEmoji(habitElement) {
        const rect = habitElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const emojis = ['🎉', '✨', '🌟', '💫', '🎊'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        const emojiElement = document.createElement('div');
        emojiElement.className = 'celebration-emoji';
        emojiElement.textContent = randomEmoji;
        emojiElement.style.left = centerX + 'px';
        emojiElement.style.top = centerY + 'px';

        document.body.appendChild(emojiElement);

        // Remove emoji after animation
        setTimeout(() => {
            document.body.removeChild(emojiElement);
        }, 1500);
    }

    checkAllHabitsCompleted() {
        const today = new Date().toDateString();
        const completedToday = this.habits.filter(habit => 
            habit.completedDates.includes(today)
        ).length;

        if (completedToday === this.habits.length && this.habits.length > 0) {
            // All habits completed! Show special celebration
            setTimeout(() => {
                this.showAllHabitsCompletedCelebration();
            }, 500);
        }
    }

    showAllHabitsCompletedCelebration() {
        // Create a bigger celebration for completing all habits
        const celebrationContainer = document.createElement('div');
        celebrationContainer.className = 'celebration-container';
        document.body.appendChild(celebrationContainer);

        // Create more confetti for the big celebration
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            const x = Math.random() * window.innerWidth;
            const y = -10;
            
            confetti.style.left = x + 'px';
            confetti.style.top = y + 'px';
            
            celebrationContainer.appendChild(confetti);
        }

        // Show multiple celebration emojis
        const bigEmojis = ['🎉', '🎊', '✨', '🌟', '💫', '🎈'];
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const emoji = document.createElement('div');
                emoji.className = 'celebration-emoji';
                emoji.textContent = bigEmojis[Math.floor(Math.random() * bigEmojis.length)];
                emoji.style.left = (Math.random() * window.innerWidth) + 'px';
                emoji.style.top = (Math.random() * window.innerHeight) + 'px';
                emoji.style.fontSize = '3rem';

                document.body.appendChild(emoji);

                setTimeout(() => {
                    document.body.removeChild(emoji);
                }, 1500);
            }, i * 200);
        }

        // Remove confetti container after animation
        setTimeout(() => {
            document.body.removeChild(celebrationContainer);
        }, 3000);
    }

    triggerModalCelebration(habitId) {
        // Find the modal habit element
        const habitElement = document.querySelector(`[data-habit-id="${habitId}"]`);
        if (!habitElement) return;

        // Add bounce animation to the modal habit item
        habitElement.classList.add('habit-completion-bounce');
        setTimeout(() => {
            habitElement.classList.remove('habit-completion-bounce');
        }, 600);

        // Add pop animation to the modal checkbox
        const checkbox = habitElement.querySelector('.habit-modal-checkbox');
        if (checkbox) {
            checkbox.classList.add('checkbox-celebration');
            setTimeout(() => {
                checkbox.classList.remove('checkbox-celebration');
            }, 400);
        }

        // Create confetti celebration for modal
        this.createConfetti(habitElement);

        // Show celebration emoji for modal
        this.showCelebrationEmoji(habitElement);
    }

    incrementHabitQuantityForDate(habitId, dateString) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit || !habit.isQuantityEnabled) return;

        const currentQuantity = habit.dailyQuantities[dateString] || 0;
        const newQuantity = currentQuantity + 1;

        habit.dailyQuantities[dateString] = newQuantity;

        // Check if target is reached
        if (newQuantity >= habit.target) {
            if (!habit.completedDates.includes(dateString)) {
                habit.completedDates.push(dateString);
                this.triggerModalCelebration(habitId);
            }
        } else if (habit.completedDates.includes(dateString)) {
            // Remove from completed if quantity drops below target
            habit.completedDates = habit.completedDates.filter(date => date !== dateString);
        }

        this.updateStreak(habit);
        this.saveHabits();
        
        // Update the modal if it's open
        const modal = document.getElementById('habitModal');
        if (modal && modal.classList.contains('open')) {
            const date = new Date(dateString);
            this.showHabitsForDate(date);
        }
        
        // Update calendar progress
        if (this.calendar) {
            this.calendar.updateHabitProgress();
        }
        
        // Update main habits view
        this.renderHabits();
        this.updateStats();
    }

    decrementHabitQuantityForDate(habitId, dateString) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit || !habit.isQuantityEnabled) return;

        const currentQuantity = habit.dailyQuantities[dateString] || 0;
        
        if (currentQuantity > 0) {
            const newQuantity = currentQuantity - 1;
            habit.dailyQuantities[dateString] = newQuantity;

            // Check if target is no longer reached
            if (newQuantity < habit.target && habit.completedDates.includes(dateString)) {
                habit.completedDates = habit.completedDates.filter(date => date !== dateString);
            }

            this.updateStreak(habit);
            this.saveHabits();
            
            // Update the modal if it's open
            const modal = document.getElementById('habitModal');
            if (modal && modal.classList.contains('open')) {
                const date = new Date(dateString);
                this.showHabitsForDate(date);
            }
            
            // Update calendar progress
            if (this.calendar) {
                this.calendar.updateHabitProgress();
            }
            
            // Update main habits view
            this.renderHabits();
            this.updateStats();
        }
    }
}

// CRM Manager Class
class CrmManager {
    constructor(firebaseService) {
        this.firebase = firebaseService;
        this.projects = [];
        this.nextProjectId = 1;
        this.nextTaskId = 1;
        this.cache = {
            projects: null,
            lastUpdated: null,
            cacheTimeout: 30000 // 30 seconds cache
        };
        this.isRendering = false;
        // Note: loadProjects() will be called by initializeCrm() after DOM is ready
    }

    // Cache management
    invalidateCache() {
        this.cache.projects = null;
        this.cache.lastUpdated = null;
        console.log('🗑️ CRM cache invalidated');
    }

    // Project Management
    async addProject(name, description, deadline, companyName, companyEmail, fundingStatus = 'not_funded', receivedAmount = 0) {
        const project = {
            id: this.nextProjectId++,
            name: name.trim(),
            description: description.trim(),
            deadline: deadline,
            client: {
                name: companyName.trim(),
                email: companyEmail.trim()
            },
            tasks: [],
            funding: {
                status: fundingStatus, // 'funded', 'not_funded', 'partially_funded'
                receivedAmount: parseFloat(receivedAmount) || 0
            },
            userId: this.firebase ? this.firebase.userId : 'anonymous_user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completed: false
        };

        this.projects.push(project);
        await this.saveProjects();
        this.renderProjects();
        this.updateStats();
        return project;
    }

    async editProject(id, name, description, deadline, companyName, companyEmail, fundingStatus, receivedAmount) {
        const project = this.projects.find(p => p.id === id);
        if (project) {
            project.name = name.trim();
            project.description = description.trim();
            project.deadline = deadline;
            project.client.name = companyName.trim();
            project.client.email = companyEmail.trim();
            
            // Initialize funding object if it doesn't exist (for backward compatibility)
            if (!project.funding) {
                project.funding = { status: 'not_funded', receivedAmount: 0 };
            }
            
            project.funding.status = fundingStatus;
            project.funding.receivedAmount = parseFloat(receivedAmount) || 0;
            
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
        }
    }

    async deleteProject(id) {
        try {
            // Delete from Firebase first
            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.deleteProject(id);
                console.log('🗑️ Project deleted from Firebase:', id);
            }
            
            // Remove from local array
            this.projects = this.projects.filter(p => p.id !== id);
            
            // Save the updated projects list (this will update Firebase with the remaining projects)
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
            
            console.log('✅ Project deleted successfully:', id);
        } catch (error) {
            console.error('❌ Error deleting project:', error);
            // Still remove from local array even if Firebase delete fails
            this.projects = this.projects.filter(p => p.id !== id);
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
        }
    }

    // Task Management
    async addTask(projectId, name, description, price, parentTaskId = null) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return null;

        const task = {
            id: this.nextTaskId++,
            name: name.trim(),
            description: description.trim(),
            price: parseFloat(price) || 0,
            completed: false,
            parentTaskId: parentTaskId,
            subtasks: [],
            userId: this.firebase ? this.firebase.userId : 'anonymous_user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hoursSpent: null,
            completionNote: null,
            completedAt: null
        };

        if (parentTaskId) {
            const parentTask = this.findTaskById(project, parentTaskId);
            if (parentTask) {
                parentTask.subtasks.push(task);
            }
        } else {
            project.tasks.push(task);
        }

        await this.saveProjects();
        this.renderProjects();
        this.updateStats();
        return task;
    }

    async editTask(projectId, taskId, name, description, price) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        const task = this.findTaskById(project, taskId);
        if (task) {
            task.name = name.trim();
            task.description = description.trim();
            task.price = parseFloat(price) || 0;
            
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
        }
    }

    async deleteTask(projectId, taskId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        try {
            // Remove task from local project
            this.removeTaskFromProject(project, taskId);
            
            // Update the project in Firebase (this will save the project with the task removed)
            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.saveProject(project);
                console.log('🗑️ Task deleted from Firebase project:', projectId, taskId);
            }
            
            // Save all projects (this ensures local storage is also updated)
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
            
            console.log('✅ Task deleted successfully:', taskId);
        } catch (error) {
            console.error('❌ Error deleting task:', error);
            // Still update local data even if Firebase update fails
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
        }
    }

    async toggleTask(projectId, taskId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        const task = this.findTaskById(project, taskId);
        if (task) {
            // If marking as incomplete, just toggle without modal
            if (task.completed) {
                task.completed = false;
                task.hoursSpent = null;
                task.completionNote = null;
                task.completedAt = null;
                
                await this.saveProjects();
                this.renderProjects();
                this.updateStats();
            } else {
                // If marking as completed, show modal to capture details
                this.showTaskCompletionModal(projectId, taskId);
            }
        }
    }

    // Task Completion Modal
    showTaskCompletionModal(projectId, taskId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        const task = this.findTaskById(project, taskId);
        if (!task) return;

        // Store current task info for modal
        this.currentTaskCompletion = { projectId, taskId };

        // Update modal content
        document.getElementById('completedTaskName').textContent = task.name;
        document.getElementById('hoursSpent').value = '';
        document.getElementById('completionNote').value = '';

        // Show modal
        const modal = document.getElementById('taskCompletionModal');
        modal.classList.add('open');

        // Focus on hours input
        setTimeout(() => {
            document.getElementById('hoursSpent').focus();
        }, 100);
    }

    hideTaskCompletionModal() {
        const modal = document.getElementById('taskCompletionModal');
        modal.classList.remove('open');
        this.currentTaskCompletion = null;
    }

    async confirmTaskCompletion() {
        const hoursSpent = parseFloat(document.getElementById('hoursSpent').value);
        const completionNote = document.getElementById('completionNote').value.trim();

        // Validate hours spent
        if (!hoursSpent || hoursSpent <= 0) {
            alert('Please enter a valid number of hours spent.');
            document.getElementById('hoursSpent').focus();
            return;
        }

        if (!this.currentTaskCompletion) return;

        const { projectId, taskId } = this.currentTaskCompletion;
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        const task = this.findTaskById(project, taskId);
        if (task) {
            // Mark task as completed with details
            task.completed = true;
            task.hoursSpent = hoursSpent;
            task.completionNote = completionNote || null;
            task.completedAt = new Date().toISOString();
            
            // Mark all subtasks as completed
            this.markSubtasksCompleted(task);
            
            // Auto-update funding status if project is fully completed
            this.updateProjectFundingStatus(project);
            
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
            
            // Update completed tasks and productivity calendar
            if (window.secondBrain && window.secondBrain.completedTasks) {
                window.secondBrain.completedTasks.invalidateCache();
                window.secondBrain.completedTasks.loadCompletedTasks(true); // Force reload
            }
        }

        this.hideTaskCompletionModal();
    }

    // Helper Methods
    findTaskById(project, taskId) {
        // Search in main tasks
        for (const task of project.tasks) {
            if (task.id === taskId) return task;
            const found = this.findTaskInSubtasks(task, taskId);
            if (found) return found;
        }
        return null;
    }

    findTaskInSubtasks(task, taskId) {
        for (const subtask of task.subtasks) {
            if (subtask.id === taskId) return subtask;
            const found = this.findTaskInSubtasks(subtask, taskId);
            if (found) return found;
        }
        return null;
    }

    removeTaskFromProject(project, taskId) {
        // Remove from main tasks
        project.tasks = project.tasks.filter(task => {
            if (task.id === taskId) return false;
            this.removeTaskFromSubtasks(task, taskId);
            return true;
        });
    }

    removeTaskFromSubtasks(task, taskId) {
        task.subtasks = task.subtasks.filter(subtask => {
            if (subtask.id === taskId) return false;
            this.removeTaskFromSubtasks(subtask, taskId);
            return true;
        });
    }

    markSubtasksCompleted(task) {
        for (const subtask of task.subtasks) {
            subtask.completed = true;
            // Set default completion details for subtasks
            if (!subtask.hoursSpent) {
                subtask.hoursSpent = 0;
                subtask.completionNote = 'Completed as part of parent task';
                subtask.completedAt = new Date().toISOString();
            }
            this.markSubtasksCompleted(subtask);
        }
    }

    updateProjectFundingStatus(project) {
        // Initialize funding object if it doesn't exist
        if (!project.funding) {
            project.funding = { status: 'not_funded', receivedAmount: 0 };
        }
        
        const allTasks = this.getAllTasks(project);
        const totalValue = allTasks.reduce((sum, task) => sum + task.price, 0);
        const receivedAmount = project.funding.receivedAmount || 0;
        
        // Auto-update funding status based on received amount vs total value
        if (totalValue === 0) {
            project.funding.status = 'not_funded';
        } else if (receivedAmount >= totalValue) {
            project.funding.status = 'funded';
        } else if (receivedAmount > 0) {
            project.funding.status = 'partially_funded';
        } else {
            project.funding.status = 'not_funded';
        }
    }

    // Progress Calculation
    calculateProjectProgress(project) {
        const allTasks = this.getAllTasks(project);
        if (allTasks.length === 0) return 0;
        
        const completedTasks = allTasks.filter(task => task.completed).length;
        return Math.round((completedTasks / allTasks.length) * 100);
    }

    getAllTasks(project) {
        const allTasks = [];
        
        const collectTasks = (tasks) => {
            for (const task of tasks) {
                allTasks.push(task);
                if (task.subtasks.length > 0) {
                    collectTasks(task.subtasks);
                }
            }
        };
        
        collectTasks(project.tasks);
        return allTasks;
    }

    // Statistics
    updateStats() {
        const totalProjects = this.projects.length;
        const allTasks = this.projects.flatMap(project => this.getAllTasks(project));
        const completedTasks = allTasks.filter(task => task.completed).length;
        const totalValue = allTasks.reduce((sum, task) => sum + task.price, 0);
        
        // Calculate funding statistics
        const receivedMoney = this.projects.reduce((sum, project) => {
            const projectFunding = project.funding || { receivedAmount: 0 };
            return sum + (projectFunding.receivedAmount || 0);
        }, 0);
        
        const pendingMoney = totalValue - receivedMoney;

        const totalProjectsEl = document.getElementById('totalProjects');
        const totalTasksEl = document.getElementById('totalTasks');
        const completedTasksEl = document.getElementById('completedTasks');
        const totalValueEl = document.getElementById('totalValue');
        const receivedMoneyEl = document.getElementById('receivedMoney');
        const pendingMoneyEl = document.getElementById('pendingMoney');

        if (totalProjectsEl) totalProjectsEl.textContent = totalProjects;
        if (totalTasksEl) totalTasksEl.textContent = allTasks.length;
        if (completedTasksEl) completedTasksEl.textContent = completedTasks;
        if (totalValueEl) totalValueEl.textContent = `₹${totalValue.toLocaleString()}`;
        if (receivedMoneyEl) receivedMoneyEl.textContent = `₹${receivedMoney.toLocaleString()}`;
        if (pendingMoneyEl) pendingMoneyEl.textContent = `₹${pendingMoney.toLocaleString()}`;
    }

    // Rendering
    renderProjects() {
        const projectsList = document.getElementById('projectsList');
        const emptyState = document.getElementById('crmEmptyState');

        if (!projectsList) return;

        // Prevent multiple simultaneous renders
        if (this.isRendering) {
            console.log('⏳ Render already in progress, skipping...');
            return;
        }
        this.isRendering = true;

        try {
            if (this.projects.length === 0) {
                projectsList.innerHTML = '';
                if (emptyState) {
                    projectsList.appendChild(emptyState);
                }
                return;
            }

            // Use DocumentFragment for better performance
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');
            
            const projectsHTML = this.projects.map(project => this.renderProject(project)).join('');
            tempDiv.innerHTML = projectsHTML;
            
            // Move all child nodes to fragment
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            
            // Clear and append in one operation
            projectsList.innerHTML = '';
            projectsList.appendChild(fragment);

            // Attach event listeners
            this.attachProjectEventListeners();
            
            // Initialize mobile view if on mobile
            this.initializeMobileView();
        } finally {
            this.isRendering = false;
        }
    }

    renderProject(project) {
        const progress = this.calculateProjectProgress(project);
        const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline';
        const funding = project.funding || { status: 'not_funded', receivedAmount: 0 };
        
        // Calculate project total value
        const allTasks = this.getAllTasks(project);
        const totalValue = allTasks.reduce((sum, task) => sum + task.price, 0);
        const pendingAmount = totalValue - funding.receivedAmount;
        
        // Get funding status tag
        const getFundingTag = (status, receivedAmount, totalValue) => {
            if (status === 'funded' || (totalValue > 0 && receivedAmount >= totalValue)) {
                return '<span class="funding-tag funded">💰 Fully Funded</span>';
            } else if (status === 'partially_funded' || receivedAmount > 0) {
                return '<span class="funding-tag partially-funded">💳 Partially Funded</span>';
            } else {
                return '<span class="funding-tag not-funded">⏳ Not Funded</span>';
            }
        };
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div class="project-info">
                        <div class="project-title-row">
                            <h3 class="project-title">${project.name}</h3>
                            ${getFundingTag(funding.status, funding.receivedAmount, totalValue)}
                        </div>
                        <div class="project-meta">
                            <span>Company: ${project.client.name}</span>
                            <span>Deadline: ${deadline}</span>
                            <span>Total Value: ₹${totalValue.toLocaleString()}</span>
                            <span>Received: ₹${funding.receivedAmount.toLocaleString()}</span>
                            <span>Pending: ₹${pendingAmount.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="project-progress">
                        <div class="progress-bar-large">
                            <div class="progress-fill-large" style="width: ${progress}%"></div>
                        </div>
                        <span class="progress-text-large">${progress}%</span>
                    </div>
                    <div class="project-actions">
                        <button class="project-action-btn" onclick="window.secondBrain.crm.showAddTaskModal(${project.id})" title="Add Task">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button class="project-action-btn" onclick="window.secondBrain.crm.showEditProjectModal(${project.id})" title="Edit Project">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="project-action-btn" onclick="window.secondBrain.crm.deleteProject(${project.id}).catch(console.error)" title="Delete Project">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="project-content">
                    <p class="project-description">${project.description}</p>
                    <div class="tasks-section">
                        <div class="tasks-header">
                            <h4 class="tasks-title">Tasks</h4>
                            <button class="add-task-btn" onclick="window.secondBrain.crm.showAddTaskModal(${project.id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Add Task
                            </button>
                        </div>
                        <div class="tasks-list">
                            ${this.renderTasks(project.tasks, project.id, 1)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderTasks(tasks, projectId, level) {
        if (tasks.length === 0) {
            return '<p style="color: var(--color-gray-500); font-style: italic; padding: 1rem; text-align: center;">No tasks yet</p>';
        }

        return tasks.map(task => this.renderTask(task, projectId, level)).join('');
    }

    renderTask(task, projectId, level) {
        const hasSubtasks = task.subtasks.length > 0;
        const subtasksHTML = hasSubtasks ? `
            <div class="subtasks-container" style="display: none;">
                ${this.renderTasks(task.subtasks, projectId, level + 1)}
            </div>
        ` : '';

        // Generate completion details HTML if task is completed
        const completionDetailsHTML = task.completed && (task.hoursSpent || task.completionNote) ? `
            <div class="task-completion-details">
                <div class="task-completion-details-title">Completion Details</div>
                <div class="task-completion-details-content">
                    ${task.hoursSpent ? `
                        <div class="task-completion-detail">
                            <svg class="task-completion-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12,6 12,12 16,14"></polyline>
                            </svg>
                            <span class="task-completion-detail-label">Hours:</span>
                            <span class="task-completion-detail-value">${task.hoursSpent}h</span>
                        </div>
                    ` : ''}
                    ${task.completionNote ? `
                        <div class="task-completion-detail">
                            <svg class="task-completion-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            <span class="task-completion-detail-label">Note:</span>
                            <span class="task-completion-detail-value">${task.completionNote}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : '';

        // Mobile level indicator
        const levelIndicator = `<span class="task-level-indicator">L${level}</span>`;

        return `
            <div class="task-item level-${level} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="window.secondBrain.crm.toggleTask(${projectId}, ${task.id}).catch(console.error)"></div>
                <div class="task-content">
                    <div class="task-header">
                        ${levelIndicator}
                        <h5 class="task-name">${task.name}</h5>
                        <div class="task-actions">
                            ${hasSubtasks ? `
                                <button class="expand-btn" onclick="window.secondBrain.crm.toggleSubtasks(${task.id})">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="9,18 15,12 9,6"></polyline>
                                    </svg>
                                </button>
                            ` : ''}
                            <button class="task-action-btn" onclick="window.secondBrain.crm.showAddTaskModal(${projectId}, ${task.id})" title="Add Subtask">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                            <button class="task-action-btn" onclick="window.secondBrain.crm.showEditTaskModal(${projectId}, ${task.id})" title="Edit Task">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="task-action-btn" onclick="window.secondBrain.crm.deleteTask(${projectId}, ${task.id}).catch(console.error)" title="Delete Task">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <p class="task-description">${task.description}</p>
                    ${task.price > 0 ? `<div class="task-price">₹${task.price.toLocaleString()}</div>` : ''}
                    ${completionDetailsHTML}
                </div>
                ${subtasksHTML}
            </div>
        `;
    }

    toggleSubtasks(taskId) {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const subtasksContainer = taskElement.querySelector('.subtasks-container');
        const expandBtn = taskElement.querySelector('.expand-btn');
        
        if (subtasksContainer && expandBtn) {
            const isVisible = subtasksContainer.style.display !== 'none';
            subtasksContainer.style.display = isVisible ? 'none' : 'block';
            expandBtn.classList.toggle('expanded', !isVisible);
        }
    }

    attachProjectEventListeners() {
        // Event listeners are attached via onclick attributes in the HTML
        // This method can be used for additional event listeners if needed
    }

    // Mobile View Methods
    initializeMobileView() {
        if (window.innerWidth <= 768) {
            this.setupMobileView();
        }
        
        // Add resize listener for mobile view
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                this.setupMobileView();
            } else {
                // Remove mobile controls on desktop
                const mobileControls = document.querySelectorAll('.mobile-controls');
                mobileControls.forEach(control => control.remove());
                
                // Remove mobile view classes
                const tasksLists = document.querySelectorAll('.tasks-list');
                tasksLists.forEach(list => {
                    list.classList.remove('mobile-tree-view', 'mobile-flat-view');
                });
            }
        });
    }

    setupMobileView() {
        // Add mobile view toggle to each project
        const projects = document.querySelectorAll('.project-card');
        projects.forEach(project => {
            const tasksList = project.querySelector('.tasks-list');
            if (tasksList && !tasksList.querySelector('.mobile-view-toggle')) {
                const mobileControls = this.createMobileControls();
                tasksList.insertBefore(mobileControls, tasksList.firstChild);
            }
        });
    }

    createMobileControls() {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'mobile-controls';
        controlsDiv.innerHTML = `
            <div class="mobile-view-toggle">
                <button class="mobile-view-btn active" data-view="tree" onclick="window.secondBrain.crm.switchMobileView('tree', this)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                    Tree View
                </button>
                <button class="mobile-view-btn" data-view="flat" onclick="window.secondBrain.crm.switchMobileView('flat', this)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                    Flat View
                </button>
            </div>
            <div class="mobile-task-filter">
                <button class="mobile-filter-btn active" data-filter="all" onclick="window.secondBrain.crm.filterMobileTasks('all', this)">All</button>
                <button class="mobile-filter-btn" data-filter="pending" onclick="window.secondBrain.crm.filterMobileTasks('pending', this)">Pending</button>
                <button class="mobile-filter-btn" data-filter="completed" onclick="window.secondBrain.crm.filterMobileTasks('completed', this)">Completed</button>
            </div>
        `;
        return controlsDiv;
    }

    switchMobileView(viewType, button) {
        // Update button states
        const buttons = button.parentElement.querySelectorAll('.mobile-view-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Find the tasks list container
        const tasksList = button.closest('.project-card').querySelector('.tasks-list');
        if (!tasksList) return;

        // Remove existing view classes
        tasksList.classList.remove('mobile-tree-view', 'mobile-flat-view');
        
        if (viewType === 'tree') {
            tasksList.classList.add('mobile-tree-view');
            this.renderMobileTreeView(tasksList);
        } else {
            tasksList.classList.add('mobile-flat-view');
            this.renderMobileFlatView(tasksList);
        }
    }

    renderMobileTreeView(tasksList) {
        // Tree view is the default, just ensure proper classes
        const taskItems = tasksList.querySelectorAll('.task-item');
        taskItems.forEach(item => {
            item.style.display = '';
        });
    }

    renderMobileFlatView(tasksList) {
        // Collect all tasks from all levels
        const allTasks = [];
        const taskItems = tasksList.querySelectorAll('.task-item');
        
        taskItems.forEach(item => {
            const level = parseInt(item.className.match(/level-(\d+)/)?.[1] || '1');
            const taskId = item.dataset.taskId;
            const taskName = item.querySelector('.task-name').textContent;
            const taskDescription = item.querySelector('.task-description').textContent;
            const taskPrice = item.querySelector('.task-price')?.textContent || '';
            const isCompleted = item.classList.contains('completed');
            
            allTasks.push({
                id: taskId,
                level: level,
                name: taskName,
                description: taskDescription,
                price: taskPrice,
                completed: isCompleted,
                element: item
            });
        });

        // Sort by level, then by original order
        allTasks.sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            return Array.from(taskItems).indexOf(a.element) - Array.from(taskItems).indexOf(b.element);
        });

        // Hide all original task items
        taskItems.forEach(item => {
            item.style.display = 'none';
        });

        // Create flat view container if it doesn't exist
        let flatContainer = tasksList.querySelector('.mobile-flat-view');
        if (!flatContainer) {
            flatContainer = document.createElement('div');
            flatContainer.className = 'mobile-flat-view show';
            tasksList.appendChild(flatContainer);
        } else {
            flatContainer.innerHTML = '';
        }

        // Render tasks in flat view
        allTasks.forEach(task => {
            const taskElement = this.createFlatTaskElement(task);
            flatContainer.appendChild(taskElement);
        });
    }

    createFlatTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-item level-${task.level} ${task.completed ? 'completed' : ''}`;
        div.dataset.taskId = task.id;
        
        div.innerHTML = `
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                 onclick="window.secondBrain.crm.toggleTask(${this.getProjectIdFromTask(task.id)}, ${task.id}).catch(console.error)"></div>
            <div class="task-content">
                <div class="task-header">
                    <span class="task-level-indicator">L${task.level}</span>
                    <h5 class="task-name">${task.name}</h5>
                    <div class="task-actions">
                        <button class="task-action-btn" onclick="window.secondBrain.crm.showEditTaskModal(${this.getProjectIdFromTask(task.id)}, ${task.id})" title="Edit Task">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="task-action-btn" onclick="window.secondBrain.crm.deleteTask(${this.getProjectIdFromTask(task.id)}, ${task.id}).catch(console.error)" title="Delete Task">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <p class="task-description">${task.description}</p>
                ${task.price ? `<div class="task-price">${task.price}</div>` : ''}
            </div>
        `;
        
        return div;
    }

    getProjectIdFromTask(taskId) {
        // Find which project this task belongs to
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            const projectCard = taskElement.closest('.project-card');
            if (projectCard) {
                return projectCard.dataset.projectId;
            }
        }
        return null;
    }

    filterMobileTasks(filter, button) {
        // Update button states
        const buttons = button.parentElement.querySelectorAll('.mobile-filter-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Find the tasks container
        const tasksContainer = button.closest('.project-card').querySelector('.tasks-list');
        if (!tasksContainer) return;

        const taskItems = tasksContainer.querySelectorAll('.task-item');
        
        taskItems.forEach(item => {
            const isCompleted = item.classList.contains('completed');
            let shouldShow = true;
            
            switch (filter) {
                case 'pending':
                    shouldShow = !isCompleted;
                    break;
                case 'completed':
                    shouldShow = isCompleted;
                    break;
                case 'all':
                default:
                    shouldShow = true;
                    break;
            }
            
            item.style.display = shouldShow ? '' : 'none';
        });
    }

    // Modal Management
    showAddProjectModal() {
        this.createModal('Add Project', this.getAddProjectModalContent(), async (formData) => {
            await this.addProject(
                formData.name,
                formData.description,
                formData.deadline,
                formData.companyName,
                formData.companyEmail,
                formData.fundingStatus,
                formData.receivedAmount
            );
        });
    }

    showEditProjectModal(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        this.createModal('Edit Project', this.getEditProjectModalContent(project), async (formData) => {
            await this.editProject(
                projectId,
                formData.name,
                formData.description,
                formData.deadline,
                formData.companyName,
                formData.companyEmail,
                formData.fundingStatus,
                formData.receivedAmount
            );
        });
    }

    showAddTaskModal(projectId, parentTaskId = null) {
        this.createModal('Add Task', this.getAddTaskModalContent(), async (formData) => {
            await this.addTask(
                projectId,
                formData.name,
                formData.description,
                formData.price,
                parentTaskId
            );
        });
    }

    showEditTaskModal(projectId, taskId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        const task = this.findTaskById(project, taskId);
        if (!task) return;

        this.createModal('Edit Task', this.getEditTaskModalContent(task), async (formData) => {
            await this.editTask(projectId, taskId, formData.name, formData.description, formData.price);
        });
    }

    createModal(title, content, onSubmit) {
        // Remove existing modal
        const existingModal = document.querySelector('.crm-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'crm-modal';
        modal.innerHTML = `
            <div class="crm-modal-content">
                <div class="crm-modal-header">
                    <h3 class="crm-modal-title">${title}</h3>
                    <button class="crm-modal-close" onclick="this.closest('.crm-modal').remove()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="crm-modal-body">
                    ${content}
                </div>
                <div class="crm-modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.crm-modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.secondBrain.crm.handleModalSubmit(this.closest('.crm-modal'), arguments[0])">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Store the submit handler
        modal._submitHandler = onSubmit;
        
        // Show modal
        setTimeout(() => modal.classList.add('open'), 10);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    handleModalSubmit(modal, event) {
        const form = modal.querySelector('form');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        if (modal._submitHandler) {
            modal._submitHandler(data);
        }
        
        modal.remove();
    }

    getAddProjectModalContent() {
        return `
            <form>
                <div class="form-group">
                    <label class="form-label" for="projectName">Project Name</label>
                    <input type="text" id="projectName" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="projectDescription">Description</label>
                    <textarea id="projectDescription" name="description" class="form-textarea" rows="3"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="projectDeadline">Deadline</label>
                        <input type="date" id="projectDeadline" name="deadline" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="companyName">Company Name</label>
                        <input type="text" id="companyName" name="companyName" class="form-input">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="companyEmail">Company Email</label>
                    <input type="email" id="companyEmail" name="companyEmail" class="form-input">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="fundingStatus">Funding Status</label>
                        <select id="fundingStatus" name="fundingStatus" class="form-input" required>
                            <option value="not_funded">Not Funded</option>
                            <option value="partially_funded">Partially Funded</option>
                            <option value="funded">Fully Funded</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="receivedAmount">Received Amount (₹)</label>
                        <input type="number" id="receivedAmount" name="receivedAmount" class="form-input" min="0" step="0.01" value="0">
                    </div>
                </div>
            </form>
        `;
    }

    getEditProjectModalContent(project) {
        const funding = project.funding || { status: 'not_funded', receivedAmount: 0 };
        return `
            <form>
                <div class="form-group">
                    <label class="form-label" for="projectName">Project Name</label>
                    <input type="text" id="projectName" name="name" class="form-input" value="${project.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="projectDescription">Description</label>
                    <textarea id="projectDescription" name="description" class="form-textarea" rows="3">${project.description}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="projectDeadline">Deadline</label>
                        <input type="date" id="projectDeadline" name="deadline" class="form-input" value="${project.deadline || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="companyName">Company Name</label>
                        <input type="text" id="companyName" name="companyName" class="form-input" value="${project.client.name}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="companyEmail">Company Email</label>
                    <input type="email" id="companyEmail" name="companyEmail" class="form-input" value="${project.client.email}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="fundingStatus">Funding Status</label>
                        <select id="fundingStatus" name="fundingStatus" class="form-input" required>
                            <option value="not_funded" ${funding.status === 'not_funded' ? 'selected' : ''}>Not Funded</option>
                            <option value="partially_funded" ${funding.status === 'partially_funded' ? 'selected' : ''}>Partially Funded</option>
                            <option value="funded" ${funding.status === 'funded' ? 'selected' : ''}>Fully Funded</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="receivedAmount">Received Amount (₹)</label>
                        <input type="number" id="receivedAmount" name="receivedAmount" class="form-input" min="0" step="0.01" value="${funding.receivedAmount || 0}">
                    </div>
                </div>
            </form>
        `;
    }

    getAddTaskModalContent() {
        return `
            <form>
                <div class="form-group">
                    <label class="form-label" for="taskName">Task Name</label>
                    <input type="text" id="taskName" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskDescription">Description</label>
                    <textarea id="taskDescription" name="description" class="form-textarea" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskPrice">Price/Cost (₹)</label>
                    <input type="number" id="taskPrice" name="price" class="form-input" min="0" step="0.01" value="0">
                </div>
            </form>
        `;
    }

    getEditTaskModalContent(task) {
        return `
            <form>
                <div class="form-group">
                    <label class="form-label" for="taskName">Task Name</label>
                    <input type="text" id="taskName" name="name" class="form-input" value="${task.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskDescription">Description</label>
                    <textarea id="taskDescription" name="description" class="form-textarea" rows="3">${task.description}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="taskPrice">Price/Cost (₹)</label>
                    <input type="number" id="taskPrice" name="price" class="form-input" min="0" step="0.01" value="${task.price}">
                </div>
            </form>
        `;
    }

    // Data Persistence
    async saveProjects() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
            // Save each project to Firebase
            for (const project of this.projects) {
                    project.userId = this.firebase.userId;
                    project.updatedAt = new Date().toISOString();
                await this.firebase.saveProject(project);
            }
            
            // Save counters
            await this.firebase.setDocument('crm_counters', 'counters', {
                    userId: this.firebase.userId,
                nextProjectId: this.nextProjectId,
                    nextTaskId: this.nextTaskId,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('📊 CRM projects saved to Firebase:', this.projects.length);
            } else {
                // Fallback to local storage
                localStorage.setItem('crm_projects', JSON.stringify(this.projects));
                localStorage.setItem('crm_next_project_id', this.nextProjectId.toString());
                localStorage.setItem('crm_next_task_id', this.nextTaskId.toString());
                console.log('📊 CRM projects saved to local storage:', this.projects.length);
            }
            
            // Always save to local storage as backup
            localStorage.setItem('crm_projects', JSON.stringify(this.projects));
            localStorage.setItem('crm_next_project_id', this.nextProjectId.toString());
            localStorage.setItem('crm_next_task_id', this.nextTaskId.toString());
            
            // Invalidate cache after saving
            this.invalidateCache();
            
            // Refresh dashboard widgets that depend on CRM data
            if (window.refreshDashboardWidgets) {
                window.refreshDashboardWidgets('crm-projects');
                window.refreshDashboardWidgets('crm-revenue');
                window.refreshDashboardWidgets('tasks-today');
                window.refreshDashboardWidgets('tasks-overdue');
            }
        } catch (error) {
            console.error('Error saving CRM projects:', error);
            // Fallback to local storage
            localStorage.setItem('crm_projects', JSON.stringify(this.projects));
            localStorage.setItem('crm_next_project_id', this.nextProjectId.toString());
            localStorage.setItem('crm_next_task_id', this.nextTaskId.toString());
            
            // Invalidate cache even on error
            this.invalidateCache();
        }
    }

    async loadProjects(forceReload = false) {
        try {
            // Check cache first
            if (!forceReload && this.cache.projects && this.cache.lastUpdated) {
                const now = Date.now();
                if (now - this.cache.lastUpdated < this.cache.cacheTimeout) {
                    console.log('📦 Using cached CRM projects data');
                    this.projects = this.cache.projects;
                    this.updateNextIds();
                    return;
                }
            }

            if (this.firebase && this.firebase.isInitialized) {
                // Load projects from Firebase
                const firebaseProjects = await this.firebase.getProjects();
                if (firebaseProjects && firebaseProjects.length > 0) {
                    // Filter projects by current user
                    this.projects = firebaseProjects.filter(project => project.userId === this.firebase.userId);
                    
                    // Update cache
                    this.cache.projects = [...this.projects];
                    this.cache.lastUpdated = Date.now();
                
                    // Load counters
                    const counters = await this.firebase.getDocument('crm_counters', 'counters');
                    if (counters && counters.userId === this.firebase.userId) {
                        this.nextProjectId = counters.nextProjectId || 1;
                        this.nextTaskId = counters.nextTaskId || 1;
                    } else {
                        // Calculate next IDs from existing projects
                        this.nextProjectId = Math.max(...this.projects.map(p => p.id), 0) + 1;
                        this.nextTaskId = Math.max(...this.projects.flatMap(p => p.tasks.map(t => t.id)), 0) + 1;
                    }
                    console.log('📊 CRM projects loaded from Firebase:', this.projects.length);
                } else {
                    // No Firebase data, try local storage
                    this.loadFromLocalStorage();
                }
            } else {
                // Firebase not initialized, use local storage
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading CRM projects:', error);
            // Fallback to local storage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
            const savedProjects = localStorage.getItem('crm_projects');
            const savedNextProjectId = localStorage.getItem('crm_next_project_id');
            const savedNextTaskId = localStorage.getItem('crm_next_task_id');

            if (savedProjects) {
                this.projects = JSON.parse(savedProjects);
            }
            if (savedNextProjectId) {
                this.nextProjectId = parseInt(savedNextProjectId);
            }
            if (savedNextTaskId) {
                this.nextTaskId = parseInt(savedNextTaskId);
            }
        console.log('📊 CRM projects loaded from local storage:', this.projects.length);
    }

    // Force reload from Firebase (useful for sync issues)
    async forceReloadFromFirebase() {
        try {
            console.log('🔄 Force reloading CRM data from Firebase...');
            await this.loadProjects();
            this.renderProjects();
            this.updateStats();
            console.log('✅ CRM data force reloaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Error force reloading CRM data:', error);
            return false;
        }
    }
}

// Wallet Manager Class
class WalletManager {
    constructor(firebaseService) {
        this.firebase = firebaseService;
        this.transactions = [];
        this.nextTransactionId = 1;
        this.currentFilter = 'all';
        // Note: loadTransactions() will be called by initializeWallet() after DOM is ready
    }

    // Transaction Management
    addTransaction(amount, description, date, type = 'expense') {
        const transaction = {
            id: this.nextTransactionId++,
            amount: parseFloat(amount),
            description: description.trim(),
            date: date,
            type: type, // 'income' or 'expense'
            userId: this.firebase ? this.firebase.userId : 'anonymous_user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.transactions.push(transaction);
        this.saveTransactions();
        this.renderTransactions();
        this.updateStats();
        return transaction;
    }

    editTransaction(id, amount, description, date, type) {
        const transaction = this.transactions.find(t => t.id === id);
        if (transaction) {
            transaction.amount = parseFloat(amount);
            transaction.description = description.trim();
            transaction.date = date;
            transaction.type = type;
            transaction.updatedAt = new Date().toISOString();
            
            this.saveTransactions();
            this.renderTransactions();
            this.updateStats();
        }
    }

    async deleteTransaction(id) {
        try {
            // Delete from Firebase first
            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.deleteDocument('wallet_transactions', id.toString());
                console.log('🗑️ Transaction deleted from Firebase:', id);
            }
            
            // Remove from local array
            this.transactions = this.transactions.filter(t => t.id !== id);
            
            // Save the updated transactions list
            await this.saveTransactions();
            this.renderTransactions();
            this.updateStats();
            
            console.log('✅ Transaction deleted successfully:', id);
        } catch (error) {
            console.error('❌ Error deleting transaction:', error);
            // Still remove from local array even if Firebase delete fails
            this.transactions = this.transactions.filter(t => t.id !== id);
            await this.saveTransactions();
            this.renderTransactions();
            this.updateStats();
        }
    }

    // Statistics and Calculations
    calculateBalance() {
        return this.transactions.reduce((balance, transaction) => {
            return balance + transaction.amount;
        }, 0);
    }

    calculateTotalIncome() {
        return this.transactions
            .filter(t => t.type === 'income')
            .reduce((total, transaction) => total + transaction.amount, 0);
    }

    calculateTotalExpenses() {
        return this.transactions
            .filter(t => t.type === 'expense')
            .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
    }

    updateStats() {
        const balance = this.calculateBalance();
        const totalIncome = this.calculateTotalIncome();
        const totalExpenses = this.calculateTotalExpenses();
        const netBalance = totalIncome - totalExpenses;

        const currentBalanceEl = document.getElementById('currentBalance');
        const totalIncomeEl = document.getElementById('totalIncome');
        const totalExpensesEl = document.getElementById('totalExpenses');
        const netBalanceEl = document.getElementById('netBalance');

        if (currentBalanceEl) currentBalanceEl.textContent = `₹${balance.toLocaleString()}`;
        if (totalIncomeEl) totalIncomeEl.textContent = `₹${totalIncome.toLocaleString()}`;
        if (totalExpensesEl) totalExpensesEl.textContent = `₹${totalExpenses.toLocaleString()}`;
        if (netBalanceEl) netBalanceEl.textContent = `₹${netBalance.toLocaleString()}`;
    }

    // Filtering
    setFilter(filter) {
        this.currentFilter = filter;
        this.renderTransactions();
        this.updateFilterButtons();
    }

    updateFilterButtons() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === this.currentFilter) {
                btn.classList.add('active');
            }
        });
    }

    getFilteredTransactions() {
        switch (this.currentFilter) {
            case 'income':
                return this.transactions.filter(t => t.type === 'income');
            case 'expense':
                return this.transactions.filter(t => t.type === 'expense');
            default:
                return this.transactions;
        }
    }

    // Rendering
    renderTransactions() {
        const transactionsList = document.getElementById('transactionsList');
        const emptyState = document.getElementById('walletEmptyState');

        if (!transactionsList) return;

        const filteredTransactions = this.getFilteredTransactions();

        if (filteredTransactions.length === 0) {
            transactionsList.innerHTML = '';
            if (emptyState) {
                transactionsList.appendChild(emptyState);
            }
            return;
        }

        // Sort by date (newest first)
        const sortedTransactions = filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const transactionsHTML = sortedTransactions.map(transaction => this.renderTransaction(transaction)).join('');
        transactionsList.innerHTML = transactionsHTML;

        // Attach event listeners
        this.attachTransactionEventListeners();
    }

    renderTransaction(transaction) {
        const isIncome = transaction.type === 'income';
        const amountPrefix = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'income' : 'expense';
        const formattedDate = new Date(transaction.date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return `
            <div class="transaction-item" data-transaction-id="${transaction.id}">
                <div class="transaction-info">
                    <p class="transaction-description">${transaction.description}</p>
                    <span class="transaction-date">${formattedDate}</span>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountPrefix}₹${Math.abs(transaction.amount).toLocaleString()}
                </div>
                <div class="transaction-actions">
                    <button class="transaction-action-btn" onclick="window.secondBrain.wallet.showEditTransactionModal(${transaction.id})" title="Edit Transaction">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="transaction-action-btn" onclick="window.secondBrain.wallet.deleteTransaction(${transaction.id}).catch(console.error)" title="Delete Transaction">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    attachTransactionEventListeners() {
        // Filter button event listeners
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setFilter(btn.dataset.filter);
            });
        });
    }

    // Modal Management
    showAddTransactionModal() {
        this.createModal('Add Transaction', this.getAddTransactionModalContent(), (formData) => {
            this.addTransaction(
                formData.amount,
                formData.description,
                formData.date,
                formData.type
            );
        });
    }

    showEditTransactionModal(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        this.createModal('Edit Transaction', this.getEditTransactionModalContent(transaction), (formData) => {
            this.editTransaction(
                transactionId,
                formData.amount,
                formData.description,
                formData.date,
                formData.type
            );
        });
    }

    createModal(title, content, onSubmit) {
        // Remove existing modal
        const existingModal = document.querySelector('.wallet-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'wallet-modal';
        modal.innerHTML = `
            <div class="wallet-modal-content">
                <div class="wallet-modal-header">
                    <h3 class="wallet-modal-title">${title}</h3>
                    <button class="wallet-modal-close" onclick="this.closest('.wallet-modal').remove()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="wallet-modal-body">
                    ${content}
                </div>
                <div class="wallet-modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.wallet-modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.secondBrain.wallet.handleModalSubmit(this.closest('.wallet-modal'), arguments[0])">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Store the submit handler
        modal._submitHandler = onSubmit;
        
        // Show modal
        setTimeout(() => modal.classList.add('open'), 10);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Attach transaction type button listeners
        this.attachTransactionTypeListeners(modal);
    }

    attachTransactionTypeListeners(modal) {
        const typeButtons = modal.querySelectorAll('.transaction-type-btn');
        typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                typeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    handleModalSubmit(modal, event) {
        const form = modal.querySelector('form');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Get selected transaction type
        const activeTypeBtn = modal.querySelector('.transaction-type-btn.active');
        if (activeTypeBtn) {
            data.type = activeTypeBtn.dataset.type;
        }
        
        if (modal._submitHandler) {
            modal._submitHandler(data);
        }
        
        modal.remove();
    }

    getAddTransactionModalContent() {
        const today = new Date().toISOString().split('T')[0];
        
        return `
            <form>
                <div class="transaction-type-buttons">
                    <button type="button" class="transaction-type-btn" data-type="expense">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Expense
                    </button>
                    <button type="button" class="transaction-type-btn active" data-type="income">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Income
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transactionAmount">Amount (₹)</label>
                    <input type="number" id="transactionAmount" name="amount" class="form-input" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transactionDescription">Description</label>
                    <input type="text" id="transactionDescription" name="description" class="form-input" placeholder="Enter description..." required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transactionDate">Date</label>
                    <input type="date" id="transactionDate" name="date" class="form-input" value="${today}" required>
                </div>
            </form>
        `;
    }

    getEditTransactionModalContent(transaction) {
        const isIncome = transaction.type === 'income';
        
        return `
            <form>
                <div class="transaction-type-buttons">
                    <button type="button" class="transaction-type-btn ${!isIncome ? 'active' : ''}" data-type="expense">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Expense
                    </button>
                    <button type="button" class="transaction-type-btn ${isIncome ? 'active' : ''}" data-type="income">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Income
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transactionAmount">Amount (₹)</label>
                    <input type="number" id="transactionAmount" name="amount" class="form-input" min="0" step="0.01" value="${Math.abs(transaction.amount)}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transactionDescription">Description</label>
                    <input type="text" id="transactionDescription" name="description" class="form-input" value="${transaction.description}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transactionDate">Date</label>
                    <input type="date" id="transactionDate" name="date" class="form-input" value="${transaction.date}" required>
                </div>
            </form>
        `;
    }

    // Data Persistence
    async saveTransactions() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Save each transaction to Firebase
                for (const transaction of this.transactions) {
                    transaction.userId = this.firebase.userId;
                    transaction.updatedAt = new Date().toISOString();
                    await this.firebase.setDocument('wallet_transactions', transaction.id.toString(), transaction);
                }
                
                // Save counter
                await this.firebase.setDocument('wallet_counters', 'counters', {
                    userId: this.firebase.userId,
                    nextTransactionId: this.nextTransactionId,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('💰 Wallet transactions saved to Firebase:', this.transactions.length);
            } else {
                // Fallback to local storage
        localStorage.setItem('wallet_transactions', JSON.stringify(this.transactions));
        localStorage.setItem('wallet_next_transaction_id', this.nextTransactionId.toString());
                console.log('💰 Wallet transactions saved to local storage:', this.transactions.length);
            }
            
            // Always save to local storage as backup
            localStorage.setItem('wallet_transactions', JSON.stringify(this.transactions));
            localStorage.setItem('wallet_next_transaction_id', this.nextTransactionId.toString());
        } catch (error) {
            console.error('Error saving wallet transactions:', error);
            // Fallback to local storage
            localStorage.setItem('wallet_transactions', JSON.stringify(this.transactions));
            localStorage.setItem('wallet_next_transaction_id', this.nextTransactionId.toString());
        }
    }

    async loadTransactions() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Load transactions from Firebase
                const firebaseTransactions = await this.firebase.getCollection('wallet_transactions');
                if (firebaseTransactions && firebaseTransactions.length > 0) {
                    // Filter transactions by current user
                    this.transactions = firebaseTransactions.filter(transaction => transaction.userId === this.firebase.userId);
                    
                    // Load counter
                    const counter = await this.firebase.getDocument('wallet_counters', 'counters');
                    if (counter && counter.userId === this.firebase.userId) {
                        this.nextTransactionId = counter.nextTransactionId || 1;
                    } else {
                        // Calculate next ID from existing transactions
                        this.nextTransactionId = Math.max(...this.transactions.map(t => t.id), 0) + 1;
                    }
                    console.log('💰 Wallet transactions loaded from Firebase:', this.transactions.length);
                } else {
                    // No Firebase data, try local storage
                    this.loadFromLocalStorage();
                }
            } else {
                // Firebase not initialized, use local storage
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading wallet transactions:', error);
            // Fallback to local storage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const savedTransactions = localStorage.getItem('wallet_transactions');
        const savedNextTransactionId = localStorage.getItem('wallet_next_transaction_id');

        if (savedTransactions) {
            this.transactions = JSON.parse(savedTransactions);
        }
        if (savedNextTransactionId) {
            this.nextTransactionId = parseInt(savedNextTransactionId);
        }
        console.log('💰 Wallet transactions loaded from local storage:', this.transactions.length);
    }

    // Force reload from Firebase (useful for sync issues)
    async forceReloadFromFirebase() {
        try {
            console.log('🔄 Force reloading wallet data from Firebase...');
            await this.loadTransactions();
            this.renderTransactions();
            this.updateStats();
            console.log('✅ Wallet data force reloaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Error force reloading wallet data:', error);
            return false;
        }
    }
}

// Goals Manager Class
class GoalsManager {
    constructor(firebaseService) {
        console.log('GoalsManager constructor called');
        this.firebase = firebaseService;
        this.goals = [];
        this.nextGoalId = 1;
        this.countdownIntervals = new Map();
        // Note: loadGoals() will be called by initializeGoals() after DOM is ready
        console.log('GoalsManager initialized');
    }

    // Goal Management
    addGoal(name, description, targetAmount, currentAmount, targetDate, imageData = null) {
        console.log('Adding goal with data:', { name, description, targetAmount, currentAmount, targetDate, imageData });
        
        const goal = {
            id: this.nextGoalId++,
            name: name.trim(),
            description: description.trim(),
            targetAmount: parseFloat(targetAmount),
            currentAmount: parseFloat(currentAmount) || 0,
            targetDate: targetDate,
            imageData: imageData,
            completed: false,
            userId: this.firebase ? this.firebase.userId : 'anonymous_user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            milestones: {
                '25': false,
                '50': false,
                '75': false,
                '100': false
            }
        };

        this.goals.push(goal);
        this.saveGoals();
        this.renderGoals();
        this.updateStats();
        this.startCountdown(goal.id);
        
        console.log('Goal added successfully:', goal);
        return goal;
    }

    editGoal(id, name, description, targetAmount, currentAmount, targetDate, imageData = null) {
        const goal = this.goals.find(g => g.id === id);
        if (goal) {
            goal.name = name.trim();
            goal.description = description.trim();
            goal.targetAmount = parseFloat(targetAmount);
            goal.currentAmount = parseFloat(currentAmount) || 0;
            goal.targetDate = targetDate;
            if (imageData !== null) {
                goal.imageData = imageData;
            }
            goal.updatedAt = new Date().toISOString();
            
            this.saveGoals();
            this.renderGoals();
            this.updateStats();
            this.startCountdown(goal.id);
        }
    }

    async deleteGoal(id) {
        try {
            // Delete from Firebase first
            if (this.firebase && this.firebase.isInitialized) {
                await this.firebase.deleteDocument('goals', id.toString());
                console.log('🗑️ Goal deleted from Firebase:', id);
            }
            
            // Remove from local array
            this.goals = this.goals.filter(g => g.id !== id);
            this.stopCountdown(id);
            
            // Save the updated goals list
            await this.saveGoals();
            this.renderGoals();
            this.updateStats();
            
            console.log('✅ Goal deleted successfully:', id);
        } catch (error) {
            console.error('❌ Error deleting goal:', error);
            // Still remove from local array even if Firebase delete fails
            this.goals = this.goals.filter(g => g.id !== id);
            this.stopCountdown(id);
            await this.saveGoals();
            this.renderGoals();
            this.updateStats();
        }
    }

    updateGoalAmount(id, newAmount) {
        const goal = this.goals.find(g => g.id === id);
        if (goal) {
            const oldAmount = goal.currentAmount;
            goal.currentAmount = Math.max(0, parseFloat(newAmount));
            goal.updatedAt = new Date().toISOString();
            
            // Check for milestone celebrations
            this.checkMilestones(goal, oldAmount);
            
            // Check if goal is completed
            if (goal.currentAmount >= goal.targetAmount && !goal.completed) {
                goal.completed = true;
                this.celebrateGoalCompletion(goal);
            } else if (goal.currentAmount < goal.targetAmount && goal.completed) {
                goal.completed = false;
            }
            
            this.saveGoals();
            this.renderGoals();
            this.updateStats();
        }
    }

    // Milestone and Celebration System
    checkMilestones(goal, oldAmount) {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const oldProgress = (oldAmount / goal.targetAmount) * 100;
        
        const milestones = [25, 50, 75, 100];
        
        for (const milestone of milestones) {
            if (progress >= milestone && oldProgress < milestone && !goal.milestones[milestone.toString()]) {
                goal.milestones[milestone.toString()] = true;
                this.celebrateMilestone(goal, milestone);
            }
        }
    }

    celebrateMilestone(goal, milestone) {
        const goalElement = document.querySelector(`[data-goal-id="${goal.id}"]`);
        if (!goalElement) return;

        const celebration = document.createElement('div');
        celebration.className = 'goal-milestone-celebration';
        celebration.textContent = `${milestone}% Milestone Reached! 🎉`;
        
        goalElement.appendChild(celebration);
        
        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.parentNode.removeChild(celebration);
            }
        }, 2000);
    }

    celebrateGoalCompletion(goal) {
        const goalElement = document.querySelector(`[data-goal-id="${goal.id}"]`);
        if (!goalElement) return;

        const celebration = document.createElement('div');
        celebration.className = 'goal-milestone-celebration';
        celebration.textContent = 'Goal Completed! 🏆';
        celebration.style.fontSize = '1.5rem';
        celebration.style.padding = '1.5rem 3rem';
        
        goalElement.appendChild(celebration);
        
        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.parentNode.removeChild(celebration);
            }
        }, 3000);
    }

    // Countdown Timer System
    startCountdown(goalId) {
        this.stopCountdown(goalId);
        
        const interval = setInterval(() => {
            this.updateCountdown(goalId);
        }, 1000);
        
        this.countdownIntervals.set(goalId, interval);
        this.updateCountdown(goalId);
    }

    stopCountdown(goalId) {
        const interval = this.countdownIntervals.get(goalId);
        if (interval) {
            clearInterval(interval);
            this.countdownIntervals.delete(goalId);
        }
    }

    updateCountdown(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;

        const countdownElement = document.querySelector(`[data-goal-id="${goal.id}"] .goal-countdown-timer`);
        if (!countdownElement) return;

        const now = new Date();
        const targetDate = new Date(goal.targetDate);
        const timeDiff = targetDate - now;

        if (timeDiff <= 0) {
            countdownElement.innerHTML = '<div class="countdown-unit"><div class="countdown-number">0</div><div class="countdown-label">Time Up</div></div>';
            countdownElement.classList.add('urgent');
            return;
        }

        const years = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 365));
        const months = Math.floor((timeDiff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
        const days = Math.floor((timeDiff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        const isUrgent = timeDiff < (7 * 24 * 60 * 60 * 1000); // Less than 7 days
        countdownElement.classList.toggle('urgent', isUrgent);

        countdownElement.innerHTML = `
            <div class="countdown-unit">
                <div class="countdown-number">${years}</div>
                <div class="countdown-label">Years</div>
            </div>
            <div class="countdown-unit">
                <div class="countdown-number">${months}</div>
                <div class="countdown-label">Months</div>
            </div>
            <div class="countdown-unit">
                <div class="countdown-number">${days}</div>
                <div class="countdown-label">Days</div>
            </div>
            <div class="countdown-unit">
                <div class="countdown-number">${hours}</div>
                <div class="countdown-label">Hours</div>
            </div>
            <div class="countdown-unit">
                <div class="countdown-number">${minutes}</div>
                <div class="countdown-label">Minutes</div>
            </div>
            <div class="countdown-unit">
                <div class="countdown-number">${seconds}</div>
                <div class="countdown-label">Seconds</div>
            </div>
        `;
    }

    // Statistics
    updateStats() {
        const totalGoals = this.goals.length;
        const completedGoals = this.goals.filter(g => g.completed).length;
        const totalValue = this.goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
        const totalSaved = this.goals.reduce((sum, goal) => sum + goal.currentAmount, 0);

        const totalGoalsEl = document.getElementById('totalGoals');
        const completedGoalsEl = document.getElementById('completedGoals');
        const totalValueEl = document.getElementById('totalValue');
        const totalSavedEl = document.getElementById('totalSaved');

        if (totalGoalsEl) totalGoalsEl.textContent = totalGoals;
        if (completedGoalsEl) completedGoalsEl.textContent = completedGoals;
        if (totalValueEl) totalValueEl.textContent = `₹${totalValue.toLocaleString()}`;
        if (totalSavedEl) totalSavedEl.textContent = `₹${totalSaved.toLocaleString()}`;
    }

    // Rendering
    renderGoals() {
        const goalsList = document.getElementById('goalsList');
        const emptyState = document.getElementById('goalsEmptyState');

        if (!goalsList) return;

        if (this.goals.length === 0) {
            goalsList.innerHTML = '';
            if (emptyState) {
                goalsList.appendChild(emptyState);
            }
            return;
        }

        const goalsHTML = this.goals.map(goal => this.renderGoal(goal)).join('');
        goalsList.innerHTML = goalsHTML;

        // Attach event listeners
        this.attachGoalEventListeners();
        
        // Start countdown timers for all goals
        this.goals.forEach(goal => {
            this.startCountdown(goal.id);
        });
    }

    renderGoal(goal) {
        const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
        const formattedTargetDate = new Date(goal.targetDate).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const imageHTML = goal.imageData ? 
            `<img src="${goal.imageData}" alt="${goal.name}" class="goal-image" onclick="window.secondBrain.goals.showFullSizeImage('${goal.imageData}', '${goal.name}')" style="cursor: pointer;">` :
            `<div class="goal-image-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21,15 16,10 5,21"></polyline>
                </svg>
            </div>`;

        return `
            <div class="goal-card ${goal.completed ? 'completed' : ''}" data-goal-id="${goal.id}">
                ${goal.completed ? '<div class="goal-completed">Completed</div>' : ''}
                <div class="goal-image-container">
                    ${imageHTML}
                </div>
                <div class="goal-content">
                    <div class="goal-header">
                        <div class="goal-info">
                            <h3 class="goal-title">${goal.name}</h3>
                            <p class="goal-description">${goal.description}</p>
                        </div>
                        <div class="goal-actions">
                            <button class="goal-action-btn" onclick="window.secondBrain.goals.showEditGoalModal(${goal.id})" title="Edit Goal">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="goal-action-btn" onclick="window.secondBrain.goals.deleteGoal(${goal.id}).catch(console.error)" title="Delete Goal">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="goal-progress-section">
                        <div class="goal-progress-header">
                            <span class="goal-progress-label">Progress</span>
                            <span class="goal-progress-percentage">${Math.round(progress)}%</span>
                        </div>
                        <div class="goal-progress-bar">
                            <div class="goal-progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="goal-amounts">
                            <span class="goal-saved-amount">₹${goal.currentAmount.toLocaleString()}</span>
                            <span class="goal-target-amount">₹${goal.targetAmount.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="goal-countdown-section">
                        <div class="goal-countdown-label">Time Remaining</div>
                        <div class="goal-countdown-timer">
                            <!-- Countdown will be populated by JavaScript -->
                        </div>
                    </div>
                    
                    <div class="goal-controls">
                        <div class="goal-amount-controls">
                            <button class="goal-amount-btn" onclick="window.secondBrain.goals.updateGoalAmount(${goal.id}, ${goal.currentAmount - 1000})" ${goal.currentAmount <= 0 ? 'disabled' : ''}>-</button>
                            <span class="goal-amount-display">₹${goal.currentAmount.toLocaleString()}</span>
                            <button class="goal-amount-btn" onclick="window.secondBrain.goals.updateGoalAmount(${goal.id}, ${goal.currentAmount + 1000})">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachGoalEventListeners() {
        // Event listeners are attached via onclick attributes in the HTML
        // This method can be used for additional event listeners if needed
    }

    // Modal Management
    showAddGoalModal() {
        console.log('Opening Add Goal Modal');
        this.createModal('Add New Goal', this.getAddGoalModalContent(), (formData) => {
            console.log('Modal submit callback called with:', formData);
            this.addGoal(
                formData.name,
                formData.description,
                formData.targetAmount,
                formData.currentAmount,
                formData.targetDate,
                formData.imageData
            );
        });
    }

    showEditGoalModal(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;

        this.createModal('Edit Goal', this.getEditGoalModalContent(goal), (formData) => {
            this.editGoal(
                goalId,
                formData.name,
                formData.description,
                formData.targetAmount,
                formData.currentAmount,
                formData.targetDate,
                formData.imageData
            );
        });
    }

    createModal(title, content, onSubmit) {
        // Remove existing modal
        const existingModal = document.querySelector('.goals-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'goals-modal';
        modal.innerHTML = `
            <div class="goals-modal-content">
                <div class="goals-modal-header">
                    <h3 class="goals-modal-title">${title}</h3>
                    <button class="goals-modal-close" onclick="this.closest('.goals-modal').remove()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="goals-modal-body">
                    ${content}
                </div>
                <div class="goals-modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.goals-modal').remove()">Cancel</button>
                    <button class="btn btn-primary" id="goalsModalSaveBtn">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Store the submit handler
        modal._submitHandler = onSubmit;
        
        // Add event listener for save button
        const saveBtn = modal.querySelector('#goalsModalSaveBtn');
        console.log('Save button found:', saveBtn);
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                console.log('Save button clicked');
                e.preventDefault();
                this.handleModalSubmit(modal, e);
            });
        } else {
            console.error('Save button not found in modal');
        }
        
        // Show modal
        setTimeout(() => modal.classList.add('open'), 10);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Attach image upload listeners
        this.attachImageUploadListeners(modal);
    }

    attachImageUploadListeners(modal) {
        const uploadArea = modal.querySelector('.image-upload-area');
        const fileInput = modal.querySelector('input[type="file"]');
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleImageUpload(files[0], modal);
                }
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleImageUpload(e.target.files[0], modal);
                }
            });
        }
    }

    handleImageUpload(file, modal) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            modal._imageData = imageData;
            
            // Update preview
            const preview = modal.querySelector('.image-preview');
            const uploadArea = modal.querySelector('.image-upload-area');
            
            if (preview) {
                preview.src = imageData;
                preview.style.display = 'block';
            }
            
            if (uploadArea) {
                uploadArea.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }

    handleModalSubmit(modal, event) {
        console.log('handleModalSubmit called');
        const form = modal.querySelector('form');
        if (!form) {
            console.error('Form not found in modal');
            return;
        }

        // Check form validity before proceeding
        if (!form.checkValidity()) {
            console.log('Form validation failed');
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Add image data if uploaded
        if (modal._imageData) {
            data.imageData = modal._imageData;
        }
        
        console.log('Form data:', data);
        console.log('Submit handler exists:', !!modal._submitHandler);
        
        if (modal._submitHandler) {
            modal._submitHandler(data);
        }
        
        modal.remove();
    }

    getAddGoalModalContent() {
        const today = new Date();
        const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
        const defaultDate = nextYear.toISOString().split('T')[0];
        
        return `
            <form>
                <div class="image-upload-section">
                    <div class="image-upload-area">
                        <div class="image-upload-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21,15 16,10 5,21"></polyline>
                            </svg>
                        </div>
                        <div class="image-upload-text">Click to upload goal image</div>
                        <div class="image-upload-hint">or drag and drop</div>
                        <input type="file" accept="image/*" style="display: none;">
                    </div>
                    <img class="image-preview" style="display: none;">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="goalName">Goal Name</label>
                    <input type="text" id="goalName" name="name" class="form-input" placeholder="Enter your goal..." required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="goalDescription">Description</label>
                    <textarea id="goalDescription" name="description" class="form-textarea" rows="3" placeholder="Describe your goal..."></textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="goalTargetAmount">Target Amount (₹)</label>
                        <input type="number" id="goalTargetAmount" name="targetAmount" class="form-input" min="0" step="100" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="goalCurrentAmount">Current Amount (₹)</label>
                        <input type="number" id="goalCurrentAmount" name="currentAmount" class="form-input" min="0" step="100" value="0">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="goalTargetDate">Target Date</label>
                    <input type="date" id="goalTargetDate" name="targetDate" class="form-input" value="${defaultDate}" required>
                </div>
            </form>
        `;
    }

    getEditGoalModalContent(goal) {
        return `
            <form>
                <div class="image-upload-section">
                    <div class="image-upload-area" style="${goal.imageData ? 'display: none;' : ''}">
                        <div class="image-upload-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21,15 16,10 5,21"></polyline>
                            </svg>
                        </div>
                        <div class="image-upload-text">Click to upload goal image</div>
                        <div class="image-upload-hint">or drag and drop</div>
                        <input type="file" accept="image/*" style="display: none;">
                    </div>
                    <img class="image-preview" src="${goal.imageData || ''}" style="display: ${goal.imageData ? 'block' : 'none'};">
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="goalName">Goal Name</label>
                    <input type="text" id="goalName" name="name" class="form-input" value="${goal.name}" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="goalDescription">Description</label>
                    <textarea id="goalDescription" name="description" class="form-textarea" rows="3">${goal.description}</textarea>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="goalTargetAmount">Target Amount (₹)</label>
                        <input type="number" id="goalTargetAmount" name="targetAmount" class="form-input" value="${goal.targetAmount}" min="0" step="100" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="goalCurrentAmount">Current Amount (₹)</label>
                        <input type="number" id="goalCurrentAmount" name="currentAmount" class="form-input" value="${goal.currentAmount}" min="0" step="100">
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="goalTargetDate">Target Date</label>
                    <input type="date" id="goalTargetDate" name="targetDate" class="form-input" value="${goal.targetDate}" required>
                </div>
            </form>
        `;
    }

    // Full Size Image Display
    showFullSizeImage(imageSrc, imageTitle) {
        // Remove existing full-size modal
        const existingModal = document.querySelector('.fullsize-image-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'fullsize-image-modal';
        modal.innerHTML = `
            <div class="fullsize-image-content">
                <div class="fullsize-image-header">
                    <h3 class="fullsize-image-title">${imageTitle}</h3>
                    <button class="fullsize-image-close" onclick="this.closest('.fullsize-image-modal').remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="fullsize-image-body">
                    <img src="${imageSrc}" alt="${imageTitle}" class="fullsize-image">
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Show modal
        setTimeout(() => modal.classList.add('open'), 10);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Data Persistence
    async saveGoals() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Save each goal to Firebase
                for (const goal of this.goals) {
                    goal.userId = this.firebase.userId;
                    goal.updatedAt = new Date().toISOString();
                    await this.firebase.setDocument('goals', goal.id.toString(), goal);
                }
                
                // Save counter
                await this.firebase.setDocument('goals_counters', 'counters', {
                    userId: this.firebase.userId,
                    nextGoalId: this.nextGoalId,
                    updatedAt: new Date().toISOString()
                });
                
                console.log('🎯 Goals saved to Firebase:', this.goals.length);
            } else {
                // Fallback to local storage
        localStorage.setItem('goals_data', JSON.stringify(this.goals));
        localStorage.setItem('goals_next_id', this.nextGoalId.toString());
                console.log('🎯 Goals saved to local storage:', this.goals.length);
            }
            
            // Always save to local storage as backup
            localStorage.setItem('goals_data', JSON.stringify(this.goals));
            localStorage.setItem('goals_next_id', this.nextGoalId.toString());
        } catch (error) {
            console.error('Error saving goals:', error);
            // Fallback to local storage
            localStorage.setItem('goals_data', JSON.stringify(this.goals));
            localStorage.setItem('goals_next_id', this.nextGoalId.toString());
        }
    }

    async loadGoals() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Load goals from Firebase
                const firebaseGoals = await this.firebase.getCollection('goals');
                if (firebaseGoals && firebaseGoals.length > 0) {
                    // Filter goals by current user
                    this.goals = firebaseGoals.filter(goal => goal.userId === this.firebase.userId);
                    
                    // Load counter
                    const counter = await this.firebase.getDocument('goals_counters', 'counters');
                    if (counter && counter.userId === this.firebase.userId) {
                        this.nextGoalId = counter.nextGoalId || 1;
                    } else {
                        // Calculate next ID from existing goals
                        this.nextGoalId = Math.max(...this.goals.map(g => g.id), 0) + 1;
                    }
                    console.log('🎯 Goals loaded from Firebase:', this.goals.length);
                } else {
                    // No Firebase data, try local storage
                    this.loadFromLocalStorage();
                }
            } else {
                // Firebase not initialized, use local storage
                this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading goals:', error);
            // Fallback to local storage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const savedGoals = localStorage.getItem('goals_data');
        const savedNextId = localStorage.getItem('goals_next_id');

        if (savedGoals) {
            this.goals = JSON.parse(savedGoals);
        }
        if (savedNextId) {
            this.nextGoalId = parseInt(savedNextId);
        }
        console.log('🎯 Goals loaded from local storage:', this.goals.length);
    }

    // Force reload from Firebase (useful for sync issues)
    async forceReloadFromFirebase() {
        try {
            console.log('🔄 Force reloading goals data from Firebase...');
            await this.loadGoals();
            this.renderGoals();
            this.updateStats();
            console.log('✅ Goals data force reloaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Error force reloading goals data:', error);
            return false;
        }
    }
}

// Pomodoro Manager Class
class PomodoroManager {
    constructor(firebaseService) {
        this.firebase = firebaseService;
        this.isRunning = false;
        this.isPaused = false;
        this.currentTime = 25 * 60; // 25 minutes in seconds
        this.focusTime = 25 * 60; // 25 minutes
        this.breakTime = 5 * 60; // 5 minutes
        this.isFocusMode = true;
        this.sessionName = '';
        this.sessions = [];
        this.timerInterval = null;
        this.startTime = null;
        this.pausedTime = 0;
        
        // Load saved state
        this.loadState().catch(console.error);
    }

    async loadState() {
        try {
            // Load state from Firebase
            const state = await this.firebase.getPomodoroState();
            if (state) {
                this.isRunning = state.isRunning || false;
                this.isPaused = state.isPaused || false;
                this.currentTime = state.currentTime || this.focusTime;
                this.focusTime = state.focusTime || 25 * 60;
                this.breakTime = state.breakTime || 5 * 60;
                this.isFocusMode = state.isFocusMode !== undefined ? state.isFocusMode : true;
                this.sessionName = state.sessionName || '';
                this.startTime = state.startTime ? new Date(state.startTime) : null;
                this.pausedTime = state.pausedTime || 0;
                
                // If timer was running when page was closed, continue it
                if (this.isRunning && !this.isPaused && this.startTime) {
                    const now = new Date();
                    const elapsed = Math.floor((now - this.startTime) / 1000) - this.pausedTime;
                    const newCurrentTime = Math.max(0, this.currentTime - elapsed);
                    
                    if (newCurrentTime <= 0) {
                        this.completeSession().catch(console.error);
                    } else {
                        this.currentTime = newCurrentTime;
                        this.startTime = now; // Reset start time to now
                        this.pausedTime = 0; // Reset paused time
                        this.startTimer();
                    }
                }
            } else {
                // Fallback to local storage
                const savedState = localStorage.getItem('pomodoro_state');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    this.isRunning = state.isRunning || false;
                    this.isPaused = state.isPaused || false;
                    this.currentTime = state.currentTime || this.focusTime;
                    this.focusTime = state.focusTime || 25 * 60;
                    this.breakTime = state.breakTime || 5 * 60;
                    this.isFocusMode = state.isFocusMode !== undefined ? state.isFocusMode : true;
                    this.sessionName = state.sessionName || '';
                    this.startTime = state.startTime ? new Date(state.startTime) : null;
                    this.pausedTime = state.pausedTime || 0;
                }
            }
        } catch (error) {
            console.error('Error loading Pomodoro state:', error);
            // Fallback to local storage
            const savedState = localStorage.getItem('pomodoro_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.isRunning = state.isRunning || false;
                this.isPaused = state.isPaused || false;
                this.currentTime = state.currentTime || this.focusTime;
                this.focusTime = state.focusTime || 25 * 60;
                this.breakTime = state.breakTime || 5 * 60;
                this.isFocusMode = state.isFocusMode !== undefined ? state.isFocusMode : true;
                this.sessionName = state.sessionName || '';
                this.startTime = state.startTime ? new Date(state.startTime) : null;
                this.pausedTime = state.pausedTime || 0;
            }
        }
        
        await this.loadSessions();
        this.updateDisplay();
        this.updateControls();
        this.updateSettingsUI();
    }

    async saveState() {
        const state = {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            focusTime: this.focusTime,
            breakTime: this.breakTime,
            isFocusMode: this.isFocusMode,
            sessionName: this.sessionName,
            startTime: this.startTime,
            pausedTime: this.pausedTime
        };
        
        try {
            await this.firebase.savePomodoroState(state);
            // Also save to local storage as backup
            localStorage.setItem('pomodoro_state', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving Pomodoro state:', error);
            // Fallback to local storage
            localStorage.setItem('pomodoro_state', JSON.stringify(state));
        }
    }

    async loadSessions() {
        try {
            const sessions = await this.firebase.getPomodoroSessions();
            if (sessions && sessions.length > 0) {
                this.sessions = sessions;
            } else {
                // Fallback to local storage
                const savedSessions = localStorage.getItem('pomodoro_sessions');
                if (savedSessions) {
                    this.sessions = JSON.parse(savedSessions);
                }
            }
        } catch (error) {
            console.error('Error loading Pomodoro sessions:', error);
            // Fallback to local storage
            const savedSessions = localStorage.getItem('pomodoro_sessions');
            if (savedSessions) {
                this.sessions = JSON.parse(savedSessions);
            }
        }
    }

    async saveSessions() {
        try {
            // Save each session to Firebase
            for (const session of this.sessions) {
                await this.firebase.savePomodoroSession(session);
            }
            // Also save to local storage as backup
            localStorage.setItem('pomodoro_sessions', JSON.stringify(this.sessions));
        } catch (error) {
            console.error('Error saving Pomodoro sessions:', error);
            // Fallback to local storage
            localStorage.setItem('pomodoro_sessions', JSON.stringify(this.sessions));
        }
    }

    toggleTimer() {
        if (this.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    async startTimer() {
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = new Date();
        
        this.timerInterval = setInterval(() => {
            this.currentTime--;
            this.updateDisplay();
            
            if (this.currentTime <= 0) {
                this.completeSession().catch(console.error);
            }
        }, 1000);
        
        this.updateControls();
        this.updateDisplay();
        await this.saveState();
    }

    async pauseTimer() {
        this.isRunning = false;
        this.isPaused = true;
        
        if (this.startTime) {
            this.pausedTime += Math.floor((new Date() - this.startTime) / 1000);
        }
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        this.updateControls();
        await this.saveState();
    }

    async stopTimer() {
        this.isRunning = false;
        this.isPaused = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Save the current session as completed
        await this.saveCompletedSession();
        
        // Reset to the opposite mode (focus -> break, break -> focus)
        this.isFocusMode = !this.isFocusMode;
        this.currentTime = this.isFocusMode ? this.focusTime : this.breakTime;
        this.startTime = null;
        this.pausedTime = 0;
        
        this.updateDisplay();
        this.updateControls();
        await this.saveState();
    }

    async resetTimer() {
        await this.stopTimer();
        this.currentTime = this.isFocusMode ? this.focusTime : this.breakTime;
        this.updateDisplay();
    }

    async completeSession() {
        this.isRunning = false;
        this.isPaused = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Save completed session
        await this.saveCompletedSession();
        
        // Switch mode
        this.isFocusMode = !this.isFocusMode;
        this.currentTime = this.isFocusMode ? this.focusTime : this.breakTime;
        this.startTime = null;
        this.pausedTime = 0;
        
        this.updateDisplay();
        this.updateControls();
        await this.saveState();
        
        // Show notification
        this.showNotification();
    }

    async saveCompletedSession() {
        // Calculate the actual time spent (original time - remaining time)
        const originalTime = this.isFocusMode ? this.focusTime : this.breakTime;
        const timeSpent = originalTime - this.currentTime;
        
        // Only save if some time was actually spent
        if (timeSpent > 0) {
            const session = {
                id: Date.now(),
                name: this.sessionName || (this.isFocusMode ? 'Focus Session' : 'Break Session'),
                type: this.isFocusMode ? 'focus' : 'break',
                duration: timeSpent, // Actual time spent, not the full duration
                completedAt: new Date().toISOString()
            };
            
            this.sessions.unshift(session);
            await this.saveSessions();
            this.renderSessions();
        }
    }

    showNotification() {
        const message = this.isFocusMode ? 'Break time! Take a 5-minute break.' : 'Focus time! Ready to work?';
        
        // Simple notification (you can enhance this with a proper notification system)
        if (Notification.permission === 'granted') {
            new Notification('Pomodoro Timer', {
                body: message,
                icon: '/favicon.ico'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Pomodoro Timer', {
                        body: message,
                        icon: '/favicon.ico'
                    });
                }
            });
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timerDisplay = document.getElementById('timerDisplay');
        const timerMode = document.getElementById('timerMode');
        const timerProgress = document.getElementById('timerProgress');
        
        if (timerDisplay) {
            timerDisplay.textContent = timeString;
        }
        
        if (timerMode) {
            timerMode.textContent = this.isFocusMode ? 'Focus Time' : 'Break Time';
        }
        
        if (timerProgress) {
            const totalTime = this.isFocusMode ? this.focusTime : this.breakTime;
            const progress = ((totalTime - this.currentTime) / totalTime) * 100;
            const circumference = 2 * Math.PI * 45;
            const strokeDashoffset = circumference - (progress / 100) * circumference;
            timerProgress.style.strokeDashoffset = strokeDashoffset;
        }
    }

    updateControls() {
        const startPauseBtn = document.getElementById('startPauseBtn');
        
        if (startPauseBtn) {
            if (this.isRunning) {
                startPauseBtn.textContent = 'Pause';
                startPauseBtn.classList.remove('btn-primary');
                startPauseBtn.classList.add('btn-warning');
            } else {
                startPauseBtn.textContent = 'Start';
                startPauseBtn.classList.remove('btn-warning');
                startPauseBtn.classList.add('btn-primary');
            }
        }
    }

    async updateSessionName(name) {
        this.sessionName = name;
        await this.saveState();
    }

    async updateFocusTime(minutes) {
        this.focusTime = minutes * 60;
        if (this.isFocusMode && !this.isRunning) {
            this.currentTime = this.focusTime;
            this.updateDisplay();
        }
        await this.saveState();
    }

    async updateBreakTime(minutes) {
        this.breakTime = minutes * 60;
        if (!this.isFocusMode && !this.isRunning) {
            this.currentTime = this.breakTime;
            this.updateDisplay();
        }
        await this.saveState();
    }

    renderSessions() {
        const sessionsList = document.getElementById('sessionsList');
        if (!sessionsList) return;
        
        if (this.sessions.length === 0) {
            sessionsList.innerHTML = '<div class="empty-state"><p>No sessions completed yet.</p></div>';
            return;
        }
        
        const sessionsHTML = this.sessions.map(session => `
            <div class="session-item">
                <div class="session-info">
                    <h4 class="session-name">${session.name}</h4>
                    <div class="session-details">
                        <span class="session-type ${session.type}">${session.type === 'focus' ? 'Focus' : 'Break'}</span>
                        <span class="session-duration">${Math.floor(session.duration / 60)}:${(session.duration % 60).toString().padStart(2, '0')} min</span>
                        <span class="session-date">${new Date(session.completedAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        sessionsList.innerHTML = sessionsHTML;
    }

    async clearHistory() {
        if (confirm('Are you sure you want to clear all session history?')) {
            this.sessions = [];
            await this.saveSessions();
            this.renderSessions();
        }
    }

    updateSettingsUI() {
        const sessionNameInput = document.getElementById('sessionName');
        const focusTimeInput = document.getElementById('focusTime');
        const breakTimeInput = document.getElementById('breakTime');
        
        if (sessionNameInput) {
            sessionNameInput.value = this.sessionName;
        }
        
        if (focusTimeInput) {
            focusTimeInput.value = Math.floor(this.focusTime / 60);
        }
        
        if (breakTimeInput) {
            breakTimeInput.value = Math.floor(this.breakTime / 60);
        }
    }
}

// Productivity Calendar Class
class ProductivityCalendar {
    constructor(completedTasksManager, firebaseService = null) {
        this.completedTasksManager = completedTasksManager;
        this.firebase = firebaseService;
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.today = new Date();
        this.monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        this.targetHoursPerDay = 8; // 8 hours = 100% productivity
    }

    // Calculate productivity percentage based on hours worked
    calculateProductivity(hoursWorked) {
        if (hoursWorked <= 0) return 0;
        return Math.round((hoursWorked / this.targetHoursPerDay) * 100);
    }

    // Get productivity class for styling
    getProductivityClass(productivityPercentage) {
        if (productivityPercentage <= 25) return 'productivity-0-25';
        if (productivityPercentage <= 50) return 'productivity-26-50';
        if (productivityPercentage <= 75) return 'productivity-51-75';
        if (productivityPercentage <= 100) return 'productivity-76-100';
        return 'productivity-100-plus';
    }

    // Get completed tasks for a specific date
    getTasksForDate(date) {
        const dateString = date.toDateString();
        return this.completedTasksManager.completedTasks.filter(task => {
            const taskDate = new Date(task.completedAt).toDateString();
            return taskDate === dateString;
        });
    }

    // Get total hours worked for a specific date
    getHoursForDate(date) {
        const tasks = this.getTasksForDate(date);
        return tasks.reduce((total, task) => total + (task.hoursSpent || 0), 0);
    }

    // Get productivity data for a specific date
    getProductivityForDate(date) {
        const hoursWorked = this.getHoursForDate(date);
        const productivityPercentage = this.calculateProductivity(hoursWorked);
        const tasks = this.getTasksForDate(date);
        
        return {
            hoursWorked,
            productivityPercentage,
            tasksCount: tasks.length,
            tasks
        };
    }

    // Render the calendar
    renderCalendar() {
        const calendarContainer = document.getElementById('productivityCalendarContainer');
        const calendarDays = document.getElementById('productivityCalendarDays');
        const monthYear = document.getElementById('productivityCalendarMonthYear');
        
        if (!calendarContainer || !calendarDays || !monthYear) return;

        // Update month/year display
        monthYear.textContent = `${this.monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;

        // Clear existing days
        calendarDays.innerHTML = '';

        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            const dayElement = this.createDayElement(0, true);
            calendarDays.appendChild(dayElement);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dayElement = this.createDayElement(day, false, dayDate);
            calendarDays.appendChild(dayElement);
        }

        // Add empty cells for days after the last day of the month
        const totalCells = calendarDays.children.length;
        const remainingCells = 42 - totalCells; // 6 weeks * 7 days
        for (let i = 0; i < remainingCells; i++) {
            const dayElement = this.createDayElement(0, true);
            calendarDays.appendChild(dayElement);
        }
    }

    // Create a day element
    createDayElement(dayNumber, isOtherMonth, dayDate = null) {
        const dayElement = document.createElement('div');
        dayElement.className = 'productivity-calendar-day';
        dayElement.textContent = dayNumber;

        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        } else if (dayDate) {
            // Check if this is today
            if (this.isSameDay(dayDate, this.today)) {
                dayElement.classList.add('today');
            }

            // Check if this is the selected date
            if (this.isSameDay(dayDate, this.selectedDate)) {
                dayElement.classList.add('selected');
            }

            // Add productivity visualization
            this.addProductivityToDay(dayElement, dayDate);

            // Add click event
            dayElement.addEventListener('click', () => {
                this.selectDate(dayDate);
                this.showProductivityForDate(dayDate);
            });
        }

        return dayElement;
    }

    // Add productivity visualization to a day
    addProductivityToDay(dayElement, dayDate) {
        const productivityData = this.getProductivityForDate(dayDate);
        
        if (productivityData.hoursWorked > 0) {
            const productivityClass = this.getProductivityClass(productivityData.productivityPercentage);
            dayElement.classList.add(productivityClass);
            
            // Add productivity percentage display
            const percentageElement = document.createElement('div');
            percentageElement.className = 'productivity-percentage';
            percentageElement.textContent = `${productivityData.productivityPercentage}%`;
            dayElement.appendChild(percentageElement);
            
            // Add tooltip with productivity info
            dayElement.title = `${productivityData.hoursWorked}h worked (${productivityData.productivityPercentage}% productivity)`;
        }
    }

    // Check if two dates are the same day
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    // Select a date
    selectDate(date) {
        this.selectedDate = new Date(date);
        this.renderCalendar(); // Re-render to update selected state
    }

    // Navigate to previous month
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
    }

    // Navigate to next month
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
    }

    // Show productivity details for a specific date
    showProductivityForDate(date) {
        const modal = document.getElementById('dailyProductivityModal');
        const modalDate = document.getElementById('productivityModalDate');
        const productivityPercentage = document.getElementById('productivityPercentage');
        const totalHoursWorked = document.getElementById('totalHoursWorked');
        const tasksCompleted = document.getElementById('tasksCompleted');
        const completedTasksForDay = document.getElementById('completedTasksForDay');

        if (!modal || !modalDate || !productivityPercentage || !totalHoursWorked || !tasksCompleted || !completedTasksForDay) return;

        // Update modal date
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        modalDate.textContent = date.toLocaleDateString('en-US', dateOptions);

        // Get productivity data
        const productivityData = this.getProductivityForDate(date);

        // Update metrics
        productivityPercentage.textContent = `${productivityData.productivityPercentage}%`;
        totalHoursWorked.textContent = `${productivityData.hoursWorked}h`;
        tasksCompleted.textContent = productivityData.tasksCount;

        // Display tasks for the day
        if (productivityData.tasks.length === 0) {
            completedTasksForDay.innerHTML = '<p style="text-align: center; color: var(--color-gray-600); padding: 1rem;">No tasks completed on this day.</p>';
        } else {
            const tasksHTML = productivityData.tasks.map(task => `
                <div class="task-item-for-day">
                    <div class="task-name-for-day">${task.name}</div>
                    <div class="task-hours-for-day">${task.hoursSpent}h</div>
                </div>
            `).join('');
            completedTasksForDay.innerHTML = `<h4>Completed Tasks</h4>${tasksHTML}`;
        }

        // Show modal
        modal.classList.add('open');
    }

    // Hide productivity modal
    hideProductivityModal() {
        const modal = document.getElementById('dailyProductivityModal');
        if (modal) {
            modal.classList.remove('open');
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // View toggle buttons
        const listViewBtn = document.getElementById('listViewBtn');
        const calendarViewBtn = document.getElementById('calendarViewBtn');
        const calendarContainer = document.getElementById('productivityCalendarContainer');
        const tasksList = document.getElementById('completedTasksList');

        if (listViewBtn && calendarViewBtn && calendarContainer && tasksList) {
            listViewBtn.addEventListener('click', () => {
                listViewBtn.classList.add('active');
                calendarViewBtn.classList.remove('active');
                calendarContainer.style.display = 'none';
                tasksList.style.display = 'block';
            });

            calendarViewBtn.addEventListener('click', () => {
                calendarViewBtn.classList.add('active');
                listViewBtn.classList.remove('active');
                calendarContainer.style.display = 'block';
                tasksList.style.display = 'none';
                this.renderCalendar();
            });
        }

        // Calendar navigation
        const prevMonthBtn = document.getElementById('prevMonthProductivity');
        const nextMonthBtn = document.getElementById('nextMonthProductivity');

        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => this.previousMonth());
        }

        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => this.nextMonth());
        }

        // Modal close button
        const modalCloseBtn = document.getElementById('dailyProductivityModalClose');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => this.hideProductivityModal());
        }

        // Close modal when clicking outside
        const modal = document.getElementById('dailyProductivityModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideProductivityModal();
                }
            });
        }
    }

    // Initialize the productivity calendar
    initialize() {
        this.setupEventListeners();
        // Calendar will be rendered when user switches to calendar view
    }

    // Update calendar when completed tasks change
    updateCalendar() {
        if (document.getElementById('productivityCalendarContainer').style.display !== 'none') {
            this.renderCalendar();
        }
    }
}

// ========================================
// ANALYTICS MANAGER
// ========================================

class AnalyticsManager {
    constructor(firebaseService) {
        this.firebase = firebaseService;
        this.charts = {};
        this.data = {};
        this.timeRange = 30; // days
        this.init();
    }

    async init() {
        console.log('AnalyticsManager initialized');
        this.setupEventListeners();
        await this.loadAllData();
        this.renderCharts();
    }

    setupEventListeners() {
        // Time range selector
        document.addEventListener('change', (e) => {
            if (e.target.id === 'analyticsTimeRange') {
                this.timeRange = parseInt(e.target.value);
                this.refreshAnalytics();
            }
        });

        // Chart control buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('chart-btn')) {
                const chartType = e.target.dataset.chart;
                const parent = e.target.parentElement;
                
                // Update active button
                parent.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update chart based on type
                this.updateChartByType(chartType);
            }
        });

        // Export button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'exportAnalyticsBtn' || e.target.closest('#exportAnalyticsBtn')) {
                this.exportAnalyticsData();
            }
        });
    }

    async loadAllData() {
        try {
            console.log('📊 Loading analytics data...');
            
            // Load data from all modules
            this.data = {
                notes: await this.loadNotesData(),
                tasks: await this.loadTasksData(),
                goals: await this.loadGoalsData(),
                habits: await this.loadHabitsData(),
                wallet: await this.loadWalletData(),
                crm: await this.loadCrmData(),
                pomodoro: await this.loadPomodoroData(),
                bookmarks: await this.loadBookmarksData()
            };

            console.log('✅ Analytics data loaded:', this.data);
            this.updateMetrics();
            this.generateInsights();
        } catch (error) {
            console.error('❌ Error loading analytics data:', error);
        }
    }

    async loadNotesData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const notes = await this.firebase.getCollection('notes');
                return notes || [];
            } else {
                const notes = JSON.parse(localStorage.getItem('notes') || '[]');
                return notes;
            }
        } catch (error) {
            console.error('Error loading notes data:', error);
            return [];
        }
    }

    async loadTasksData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const projects = await this.firebase.getCollection('projects');
                const completedTasks = await this.firebase.getCollection('completed_tasks');
                
                let allTasks = [];
                if (projects) {
                    projects.forEach(project => {
                        if (project.tasks) {
                            allTasks = allTasks.concat(project.tasks.map(task => ({
                                ...task,
                                projectName: project.name,
                                projectId: project.id
                            })));
                        }
                    });
                }
                
                return {
                    all: allTasks,
                    completed: completedTasks || []
                };
            } else {
                const crmData = JSON.parse(localStorage.getItem('crm_data') || '[]');
                const completedTasks = JSON.parse(localStorage.getItem('completed_tasks') || '[]');
                
                let allTasks = [];
                crmData.forEach(project => {
                    if (project.tasks) {
                        allTasks = allTasks.concat(project.tasks.map(task => ({
                            ...task,
                            projectName: project.name,
                            projectId: project.id
                        })));
                    }
                });
                
                return {
                    all: allTasks,
                    completed: completedTasks
                };
            }
        } catch (error) {
            console.error('Error loading tasks data:', error);
            return { all: [], completed: [] };
        }
    }

    async loadGoalsData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const goals = await this.firebase.getCollection('goals');
                return goals || [];
            } else {
                const goals = JSON.parse(localStorage.getItem('goals_data') || '[]');
                return goals;
            }
        } catch (error) {
            console.error('Error loading goals data:', error);
            return [];
        }
    }

    async loadHabitsData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const habits = await this.firebase.getCollection('habits');
                return habits || [];
            } else {
                const habits = JSON.parse(localStorage.getItem('habits_data') || '[]');
                return habits;
            }
        } catch (error) {
            console.error('Error loading habits data:', error);
            return [];
        }
    }

    async loadWalletData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const transactions = await this.firebase.getCollection('wallet_transactions');
                return transactions || [];
            } else {
                const transactions = JSON.parse(localStorage.getItem('wallet_data') || '[]');
                return transactions;
            }
        } catch (error) {
            console.error('Error loading wallet data:', error);
            return [];
        }
    }

    async loadCrmData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const projects = await this.firebase.getCollection('projects');
                return projects || [];
            } else {
                const projects = JSON.parse(localStorage.getItem('crm_data') || '[]');
                return projects;
            }
        } catch (error) {
            console.error('Error loading CRM data:', error);
            return [];
        }
    }

    async loadPomodoroData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const sessions = await this.firebase.getCollection('pomodoro_sessions');
                return sessions || [];
            } else {
                const sessions = JSON.parse(localStorage.getItem('pomodoro_sessions') || '[]');
                return sessions;
            }
        } catch (error) {
            console.error('Error loading pomodoro data:', error);
            return [];
        }
    }

    async loadBookmarksData() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                const bookmarks = await this.firebase.getCollection('bookmarks');
                return bookmarks || [];
            } else {
                const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
                return bookmarks;
            }
        } catch (error) {
            console.error('Error loading bookmarks data:', error);
            return [];
        }
    }

    updateMetrics() {
        // Update key metrics
        const totalNotes = this.data.notes.length;
        const completedTasks = this.data.tasks.completed.length;
        const activeGoals = this.data.goals.filter(goal => !goal.completed).length;
        
        // Calculate total revenue
        const totalRevenue = this.data.tasks.completed.reduce((sum, task) => {
            return sum + (task.price || 0);
        }, 0);

        // Calculate best habit streak
        const bestHabitStreak = this.data.habits.reduce((max, habit) => {
            const streak = habit.streak || 0;
            return Math.max(max, streak);
        }, 0);

        // Calculate total focus time
        const totalFocusTime = this.data.pomodoro.reduce((sum, session) => {
            if (session.type === 'focus') {
                return sum + (session.duration || 0);
            }
            return sum;
        }, 0);

        // Update DOM elements
        this.updateElement('totalNotes', totalNotes);
        this.updateElement('completedTasks', completedTasks);
        this.updateElement('activeGoals', activeGoals);
        this.updateElement('totalRevenue', `₹${totalRevenue.toLocaleString()}`);
        this.updateElement('habitStreak', bestHabitStreak);
        this.updateElement('focusTime', `${Math.round(totalFocusTime / 3600)}h`);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    renderCharts() {
        // Wait for DOM to be ready
        setTimeout(() => {
            this.renderTaskCompletionChart();
            this.renderGoalProgressChart();
            this.renderRevenueChart();
            this.renderHabitChart();
            this.renderProductivityHeatmap();
            this.renderModuleUsageChart();
            this.renderTimeDistributionChart();
        }, 100);
    }

    renderTaskCompletionChart() {
        const ctx = document.getElementById('taskCompletionChart');
        if (!ctx) return;

        const completedTasks = this.data.tasks.completed;
        const last30Days = this.getLastNDays(30);
        
        const dailyCompletions = last30Days.map(date => {
            return completedTasks.filter(task => {
                const taskDate = new Date(task.completedAt || task.createdAt);
                return taskDate.toDateString() === date.toDateString();
            }).length;
        });

        this.charts.taskCompletion = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last30Days.map(date => date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Tasks Completed',
                    data: dailyCompletions,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderGoalProgressChart() {
        const ctx = document.getElementById('goalProgressChart');
        if (!ctx) return;

        const goals = this.data.goals;
        const completedGoals = goals.filter(goal => goal.completed);
        const inProgressGoals = goals.filter(goal => !goal.completed && goal.currentAmount > 0);
        const notStartedGoals = goals.filter(goal => !goal.completed && goal.currentAmount === 0);

        this.charts.goalProgress = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Not Started'],
                datasets: [{
                    data: [completedGoals.length, inProgressGoals.length, notStartedGoals.length],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderRevenueChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        const completedTasks = this.data.tasks.completed;
        const last12Months = this.getLastNMonths(12);
        
        const monthlyRevenue = last12Months.map(month => {
            return completedTasks.filter(task => {
                const taskDate = new Date(task.completedAt || task.createdAt);
                return taskDate.getMonth() === month.getMonth() && 
                       taskDate.getFullYear() === month.getFullYear();
            }).reduce((sum, task) => sum + (task.price || 0), 0);
        });

        this.charts.revenue = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last12Months.map(month => month.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })),
                datasets: [{
                    label: 'Revenue (₹)',
                    data: monthlyRevenue,
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    renderHabitChart() {
        const ctx = document.getElementById('habitChart');
        if (!ctx) return;

        const habits = this.data.habits;
        const habitNames = habits.map(habit => habit.name);
        const habitStreaks = habits.map(habit => habit.streak || 0);

        this.charts.habits = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: habitNames,
                datasets: [{
                    label: 'Current Streak',
                    data: habitStreaks,
                    backgroundColor: '#f59e0b',
                    borderColor: '#d97706',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderProductivityHeatmap() {
        const ctx = document.getElementById('productivityHeatmap');
        if (!ctx) return;

        // Create a simple productivity heatmap
        const last30Days = this.getLastNDays(30);
        const completedTasks = this.data.tasks.completed;
        
        const productivityData = last30Days.map(date => {
            const dayTasks = completedTasks.filter(task => {
                const taskDate = new Date(task.completedAt || task.createdAt);
                return taskDate.toDateString() === date.toDateString();
            }).length;
            
            return {
                x: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                y: dayTasks
            };
        });

        this.charts.productivity = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Daily Productivity',
                    data: productivityData,
                    backgroundColor: function(context) {
                        const value = context.parsed.y;
                        const alpha = Math.min(value / 10, 1);
                        return `rgba(79, 70, 229, ${alpha})`;
                    },
                    borderColor: '#4f46e5',
                    borderWidth: 1,
                    pointRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Tasks Completed'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderModuleUsageChart() {
        const ctx = document.getElementById('moduleUsageChart');
        if (!ctx) return;

        const moduleData = {
            'Notes': this.data.notes.length,
            'Tasks': this.data.tasks.all.length,
            'Goals': this.data.goals.length,
            'Habits': this.data.habits.length,
            'Bookmarks': this.data.bookmarks.length,
            'Projects': this.data.crm.length
        };

        this.charts.moduleUsage = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(moduleData),
                datasets: [{
                    data: Object.values(moduleData),
                    backgroundColor: [
                        '#4f46e5', '#10b981', '#f59e0b', 
                        '#ef4444', '#8b5cf6', '#06b6d4'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderTimeDistributionChart() {
        const ctx = document.getElementById('timeDistributionChart');
        if (!ctx) return;

        const pomodoroSessions = this.data.pomodoro;
        const focusTime = pomodoroSessions.filter(s => s.type === 'focus').reduce((sum, s) => sum + (s.duration || 0), 0);
        const breakTime = pomodoroSessions.filter(s => s.type === 'break').reduce((sum, s) => sum + (s.duration || 0), 0);
        
        // Estimate other time based on completed tasks
        const estimatedWorkTime = this.data.tasks.completed.length * 30 * 60; // 30 minutes per task

        this.charts.timeDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Focus Time', 'Break Time', 'Estimated Work Time'],
                datasets: [{
                    data: [focusTime, breakTime, estimatedWorkTime],
                    backgroundColor: ['#4f46e5', '#10b981', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    generateInsights() {
        const insights = [];
        const recommendations = [];

        // Generate insights based on data
        const totalTasks = this.data.tasks.all.length;
        const completedTasks = this.data.tasks.completed.length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;

        if (completionRate > 80) {
            insights.push({
                icon: '🎉',
                text: `Excellent task completion rate of ${completionRate}%!`
            });
        } else if (completionRate > 60) {
            insights.push({
                icon: '👍',
                text: `Good task completion rate of ${completionRate}%`
            });
        } else {
            insights.push({
                icon: '📈',
                text: `Task completion rate is ${completionRate}% - room for improvement`
            });
            recommendations.push({
                icon: '💡',
                text: 'Try breaking down large tasks into smaller, manageable chunks'
            });
        }

        // Goal insights
        const activeGoals = this.data.goals.filter(g => !g.completed).length;
        const completedGoals = this.data.goals.filter(g => g.completed).length;
        
        if (completedGoals > 0) {
            insights.push({
                icon: '🎯',
                text: `You've completed ${completedGoals} goal${completedGoals > 1 ? 's' : ''}!`
            });
        }

        if (activeGoals > 5) {
            recommendations.push({
                icon: '💡',
                text: 'Consider focusing on fewer goals at once for better results'
            });
        }

        // Habit insights
        const bestStreak = Math.max(...this.data.habits.map(h => h.streak || 0));
        if (bestStreak > 30) {
            insights.push({
                icon: '🔥',
                text: `Amazing habit streak of ${bestStreak} days!`
            });
        }

        // Revenue insights
        const totalRevenue = this.data.tasks.completed.reduce((sum, task) => sum + (task.price || 0), 0);
        if (totalRevenue > 0) {
            insights.push({
                icon: '💰',
                text: `Total revenue generated: ₹${totalRevenue.toLocaleString()}`
            });
        }

        // Render insights
        this.renderInsights(insights, recommendations);
    }

    renderInsights(insights, recommendations) {
        const insightsList = document.getElementById('insightsList');
        const recommendationsList = document.getElementById('recommendationsList');

        if (insightsList) {
            insightsList.innerHTML = insights.map(insight => `
                <div class="insight-item">
                    <span class="insight-icon">${insight.icon}</span>
                    <span class="insight-text">${insight.text}</span>
                </div>
            `).join('');
        }

        if (recommendationsList) {
            recommendationsList.innerHTML = recommendations.map(rec => `
                <div class="recommendation-item">
                    <span class="recommendation-icon">${rec.icon}</span>
                    <span class="recommendation-text">${rec.text}</span>
                </div>
            `).join('');
        }
    }

    updateChartByType(chartType) {
        // Update specific charts based on button clicks
        switch (chartType) {
            case 'tasks-weekly':
            case 'tasks-monthly':
                this.renderTaskCompletionChart();
                break;
            case 'revenue-monthly':
            case 'revenue-project':
                this.renderRevenueChart();
                break;
            case 'heatmap-tasks':
            case 'heatmap-focus':
                this.renderProductivityHeatmap();
                break;
        }
    }

    async refreshAnalytics() {
        await this.loadAllData();
        this.renderCharts();
    }

    exportAnalyticsData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            timeRange: this.timeRange,
            metrics: {
                totalNotes: this.data.notes.length,
                completedTasks: this.data.tasks.completed.length,
                activeGoals: this.data.goals.filter(g => !g.completed).length,
                totalRevenue: this.data.tasks.completed.reduce((sum, task) => sum + (task.price || 0), 0)
            },
            data: this.data
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showNotification('Analytics data exported successfully!');
    }

    // Helper methods
    getLastNDays(n) {
        const days = [];
        for (let i = n - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date);
        }
        return days;
    }

    getLastNMonths(n) {
        const months = [];
        for (let i = n - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            date.setDate(1);
            months.push(date);
        }
        return months;
    }
}

// ========================================
// DASHBOARD WIDGET SYSTEM
// ========================================

class DashboardWidgets {
    constructor() {
        this.widgets = [];
        this.widgetIdCounter = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadWidgets();
    }

    setupEventListeners() {
        // Add widget button
        const addWidgetBtn = document.getElementById('addWidgetBtn');
        const addFirstWidgetBtn = document.getElementById('addFirstWidgetBtn');
        const refreshWidgetsBtn = document.getElementById('refreshWidgetsBtn');
        
        if (addWidgetBtn) {
            addWidgetBtn.addEventListener('click', () => this.showWidgetSelectionModal());
        }
        
        if (addFirstWidgetBtn) {
            addFirstWidgetBtn.addEventListener('click', () => this.showWidgetSelectionModal());
        }
        
        if (refreshWidgetsBtn) {
            refreshWidgetsBtn.addEventListener('click', () => this.refreshAllWidgets());
        }

        // Widget selection modal
        const widgetSelectionModal = document.getElementById('widgetSelectionModal');
        const widgetSelectionModalClose = document.getElementById('widgetSelectionModalClose');
        const cancelWidgetSelection = document.getElementById('cancelWidgetSelection');

        if (widgetSelectionModalClose) {
            widgetSelectionModalClose.addEventListener('click', () => this.hideWidgetSelectionModal());
        }

        if (cancelWidgetSelection) {
            cancelWidgetSelection.addEventListener('click', () => this.hideWidgetSelectionModal());
        }

        // Close modal when clicking outside
        if (widgetSelectionModal) {
            widgetSelectionModal.addEventListener('click', (e) => {
                if (e.target === widgetSelectionModal) {
                    this.hideWidgetSelectionModal();
                }
            });
        }

        // Widget option clicks
        const widgetOptions = document.querySelectorAll('.widget-option');
        widgetOptions.forEach(option => {
            option.addEventListener('click', () => {
                const widgetType = option.dataset.widget;
                this.addWidget(widgetType);
                this.hideWidgetSelectionModal();
            });
        });
    }

    showWidgetSelectionModal() {
        const modal = document.getElementById('widgetSelectionModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    hideWidgetSelectionModal() {
        const modal = document.getElementById('widgetSelectionModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    async addWidget(widgetType) {
        try {
            console.log(`Adding widget: ${widgetType}`);
            
            // Check if widget already exists
            const existingWidget = this.widgets.find(w => w.type === widgetType);
            if (existingWidget) {
                alert('This widget is already added to your dashboard!');
                return;
            }
            
            // Create new widget
            const widget = {
                id: `widget-${++this.widgetIdCounter}`,
                type: widgetType,
                title: this.getWidgetTitle(widgetType),
                icon: this.getWidgetIcon(widgetType),
                position: this.widgets.length,
                data: null
            };
            
            // Add to widgets array
            this.widgets.push(widget);
            
            // Load widget data
            widget.data = { loading: true };
            await this.renderWidget(widget);
            
            // Load actual data
            try {
                console.log(`🔍 Loading data for widget: ${widgetType}`);
                const realData = await this.getWidgetData(widgetType);
                console.log(`🔍 Widget data loaded:`, realData);
                widget.data = realData;
                
                // Update the widget content
                const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"] .widget-card-content`);
                if (widgetElement) {
                    const content = this.renderWidgetContent(widget);
                    console.log(`🔍 Widget content:`, content);
                    widgetElement.innerHTML = content;
                } else {
                    console.log(`❌ Widget element not found for ${widget.id}`);
                }
            } catch (error) {
                console.error(`❌ Error loading data for widget ${widgetType}:`, error);
                widget.data = { error: 'Failed to load data' };
                
                // Update the widget content with error state
                const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"] .widget-card-content`);
                if (widgetElement) {
                    widgetElement.innerHTML = this.renderWidgetContent(widget);
                }
            }
            
            // Update empty state
            this.updateEmptyState();
            
            // Save widgets to localStorage
            this.saveWidgets();
            
            console.log(`✅ Widget ${widgetType} added successfully`);
            
        } catch (error) {
            console.error('Error adding widget:', error);
            alert('Failed to add widget. Please try again.');
        }
    }

    getWidgetTitle(widgetType) {
        const titles = {
            'notes-recent': 'My Notes',
            'notes-stats': 'Notes Statistics',
            'tasks-today': "My Tasks",
            'tasks-overdue': 'Overdue Tasks',
            'tasks-completed': 'Completed Tasks',
            'calendar-mini': 'Mini Calendar',
            'calendar-upcoming': 'Upcoming Events',
            'habits-streak': 'Habit Streaks',
            'wallet-balance': 'Wallet Balance',
            'wallet-transactions': 'Recent Transactions',
            'wallet-summary': 'Income vs Expense',
            'goals-progress': 'Goal Progress',
            'goals-achievements': 'Recent Achievements',
            'crm-projects': 'Active Projects',
            'crm-revenue': 'Revenue Tracker',
            'pomodoro-timer': 'Pomodoro Timer',
            'daily-summary': 'Daily Summary',
            'focus-time': 'Focus Time',
            'quick-notes': 'Quick Notes',
            'time-weather': 'Time & Weather',
            'bookmark-shortcuts': 'Bookmark Shortcuts',
            'analytics-productivity': 'Productivity Chart'
        };
        return titles[widgetType] || 'Widget';
    }

    getWidgetIcon(widgetType) {
        const icons = {
            'notes-recent': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
            </svg>`,
            'notes-stats': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 20V10"></path>
                <path d="M12 20V4"></path>
                <path d="M6 20v-6"></path>
            </svg>`,
            'tasks-today': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
            </svg>`,
            'tasks-overdue': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>`,
            'tasks-completed': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"></path>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
            </svg>`,
            'calendar-mini': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>`,
            'calendar-upcoming': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
            </svg>`,
            'habits-streak': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
            </svg>`,
            'wallet-balance': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
            </svg>`,
            'wallet-transactions': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>`,
            'wallet-summary': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 20V10"></path>
                <path d="M12 20V4"></path>
                <path d="M6 20v-6"></path>
            </svg>`,
            'goals-progress': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>`,
            'goals-achievements': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>`,
            'crm-projects': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>`,
            'crm-revenue': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>`,
            'pomodoro-timer': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
            </svg>`,
            'daily-summary': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 20V10"></path>
                <path d="M12 20V4"></path>
                <path d="M6 20v-6"></path>
            </svg>`,
            'focus-time': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>`,
            'quick-notes': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
            </svg>`,
            'time-weather': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
            </svg>`,
            'bookmark-shortcuts': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>`,
            'analytics-productivity': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 20V10"></path>
                <path d="M12 20V4"></path>
                <path d="M6 20v-6"></path>
            </svg>`
        };
        return icons[widgetType] || '';
    }

    async getWidgetData(widgetType) {
        // Fetch real data from Firebase modules
        try {
            switch (widgetType) {
                case 'notes-recent':
                    return await this.getNotesRecentData();
                case 'notes-stats':
                    return await this.getNotesStatsData();
                case 'tasks-today':
                    return await this.getTasksTodayData();
                case 'tasks-overdue':
                    return await this.getTasksOverdueData();
                case 'tasks-completed':
                    return await this.getTasksCompletedData();
                case 'wallet-balance':
                    return await this.getWalletBalanceData();
                case 'wallet-transactions':
                    return await this.getWalletTransactionsData();
                case 'wallet-summary':
                    return await this.getWalletSummaryData();
                case 'crm-projects':
                    return await this.getCrmProjectsData();
                case 'crm-revenue':
                    return await this.getCrmRevenueData();
                case 'pomodoro-timer':
                    return await this.getPomodoroTimerData();
                case 'daily-summary':
                    return await this.getDailySummaryData();
                case 'goals-progress':
                    return await this.getGoalsProgressData();
                case 'goals-achievements':
                    return await this.getGoalsAchievementsData();
                case 'habits-streak':
                    return await this.getHabitsStreakData();
                default:
                    // Return placeholder data for widgets not yet implemented
                    return this.getPlaceholderData(widgetType);
            }
        } catch (error) {
            console.error(`Error fetching data for widget ${widgetType}:`, error);
            return this.getPlaceholderData(widgetType);
        }
    }

    getPlaceholderData(widgetType) {
        // Fallback placeholder data
        const data = {
            'calendar-mini': { events: [], currentDate: new Date() },
            'calendar-upcoming': { events: [], count: 0 },
            'habits-streak': { habits: [], totalStreaks: 0 },
            'focus-time': { today: 0, thisWeek: 0, streak: 0 },
            'quick-notes': { notes: [], recent: [] },
            'time-weather': { time: new Date(), weather: 'Sunny', temp: '24°C' },
            'bookmark-shortcuts': { bookmarks: [], favorites: [] },
            'analytics-productivity': { chartData: [], productivity: 0 }
        };
        return data[widgetType] || {};
    }

    // Data fetching methods for each widget type
    async getNotesRecentData() {
        console.log('🔍 SIMPLE: Getting notes data...');
        
        // Simple approach: just get all notes and show recent ones
        let allNotes = [];
        
        // Try to get notes from localStorage first (simplest approach)
        const savedNotes = localStorage.getItem('notes');
        if (savedNotes) {
            allNotes = JSON.parse(savedNotes);
            console.log('✅ SIMPLE: Found notes in localStorage:', allNotes.length);
        }
        
        // If no notes in localStorage, try to get from notes module
        if (allNotes.length === 0 && window.secondBrain?.notes?.notes) {
            allNotes = window.secondBrain.notes.notes;
            console.log('✅ SIMPLE: Found notes in module:', allNotes.length);
        }
        
        // If still no notes, create some simple sample data
        if (allNotes.length === 0) {
            console.log('🔍 SIMPLE: No notes found, creating sample data...');
            allNotes = [
                { id: 1, title: 'Meeting Notes', content: 'Discussed project timeline and next steps...', createdAt: new Date().toISOString() },
                { id: 2, title: 'App Ideas', content: 'New feature ideas for the mobile app...', createdAt: new Date().toISOString() },
                { id: 3, title: 'Shopping List', content: 'Milk, bread, eggs, and vegetables...', createdAt: new Date().toISOString() }
            ];
            console.log('✅ SIMPLE: Created sample notes:', allNotes);
        }
        
        // Get recent notes (last 3)
        const recentNotes = allNotes
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
            .slice(0, 3)
            .map(note => ({
            title: note.title || 'Untitled Note',
                content: note.content ? note.content.substring(0, 50) + '...' : '',
            updatedAt: note.updatedAt || note.createdAt
        }));
        
        console.log(`✅ SIMPLE: Total notes: ${allNotes.length}, Recent: ${recentNotes.length}`);
        
        return { 
            notes: recentNotes, 
            count: allNotes.length,
            message: `Showing ${recentNotes.length} recent notes`
        };
    }

    async getNotesStatsData() {
        if (!window.secondBrain?.notes) return { total: 0, thisWeek: 0, growth: 0 };
        
        const notes = window.secondBrain.notes.notes || [];
        const total = notes.length;
        
        // Calculate notes created this week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thisWeek = notes.filter(note => {
            const noteDate = new Date(note.createdAt || note.updatedAt);
            return noteDate >= oneWeekAgo;
        }).length;
        
        return { total, thisWeek, growth: thisWeek > 0 ? Math.round((thisWeek / total) * 100) : 0 };
    }

    async getTasksTodayData() {
        console.log('🔍 SIMPLE: Getting tasks data...');
        
        // Simple approach: just get all tasks and show them
        let allTasks = [];
        
        // Try to get tasks from localStorage first (simplest approach)
        const savedTasks = localStorage.getItem('tasks');
        if (savedTasks) {
            allTasks = JSON.parse(savedTasks);
            console.log('✅ SIMPLE: Found tasks in localStorage:', allTasks.length);
        }
        
        // If no tasks in localStorage, try to get from tasks module
        if (allTasks.length === 0 && window.secondBrain?.tasks?.tasks) {
            allTasks = window.secondBrain.tasks.tasks;
            console.log('✅ SIMPLE: Found tasks in module:', allTasks.length);
        }
        
        // If still no tasks, create some simple sample data
        if (allTasks.length === 0) {
            console.log('🔍 SIMPLE: No tasks found, creating sample data...');
            allTasks = [
                { id: 1, title: 'Sample Task 1', completed: false, dueDate: new Date().toISOString().split('T')[0] },
                { id: 2, title: 'Sample Task 2', completed: true, dueDate: new Date().toISOString().split('T')[0] },
                { id: 3, title: 'Sample Task 3', completed: false, dueDate: new Date().toISOString().split('T')[0] }
            ];
            console.log('✅ SIMPLE: Created sample tasks:', allTasks);
        }
        
        // Simple calculation
        const completed = allTasks.filter(task => task.completed).length;
        const total = allTasks.length;
        
        console.log(`✅ SIMPLE: Total tasks: ${total}, Completed: ${completed}`);
        
        return { 
            tasks: allTasks, 
            completed: completed, 
            total: total,
            message: `Showing ${total} tasks (${completed} completed)`
        };
    }
    
    async createSampleTasks() {
        if (!window.secondBrain?.tasks) return;
        
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const sampleTasks = [
            {
                id: 1,
                title: 'Complete project report',
                description: 'Finish the quarterly project report',
                priority: 'high',
                dueDate: today,
                completed: false,
                userId: 'demo_user',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 2,
                title: 'Team meeting at 2 PM',
                description: 'Weekly team standup meeting',
                priority: 'medium',
                dueDate: today,
                completed: true,
                userId: 'demo_user',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 3,
                title: 'Review code changes',
                description: 'Review pull requests from team members',
                priority: 'medium',
                dueDate: today,
                completed: false,
                userId: 'demo_user',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 4,
                title: 'Update documentation',
                description: 'Update API documentation',
                priority: 'low',
                dueDate: tomorrowStr,
                completed: false,
                userId: 'demo_user',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        
        // Add sample tasks to the tasks module
        window.secondBrain.tasks.tasks = sampleTasks;
        window.secondBrain.tasks.nextTaskId = 5;
        
        // Save to localStorage
        localStorage.setItem('tasks', JSON.stringify(sampleTasks));
        localStorage.setItem('tasks_next_id', '5');
        
        console.log('✅ Sample tasks created:', sampleTasks);
    }
    
    async createTaskForToday(title, description = '', priority = 'medium') {
        if (!window.secondBrain?.tasks) {
            console.log('❌ Tasks module not available for creating task');
            return false;
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        try {
            await window.secondBrain.tasks.addTask(title, description, priority, today);
            console.log('✅ Task created for today:', title);
            
            // Refresh the widget
            setTimeout(() => {
                this.refreshWidget('tasks-today');
            }, 500);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to create task for today:', error);
            return false;
        }
    }

    async getTasksOverdueData() {
        // Check if tasks module is available, if not, try to initialize it
        if (!window.secondBrain?.tasks) {
            console.log('🔍 Tasks module not available for overdue data, trying to initialize...');
            try {
                await window.secondBrain.initializeTasks();
                console.log('✅ Tasks module initialized successfully for overdue data');
            } catch (error) {
                console.log('❌ Failed to initialize tasks module for overdue data:', error);
                return { tasks: [], count: 0 };
            }
        }
        
        // Check again after initialization
        if (!window.secondBrain?.tasks) {
            console.log('❌ Tasks module still not available after initialization for overdue data');
            return { tasks: [], count: 0 };
        }
        
        const today = new Date().toISOString().split('T')[0];
        let allTasks = window.secondBrain.tasks.tasks || [];
        
        // If no tasks found, try to load from localStorage directly
        if (allTasks.length === 0) {
            console.log('🔍 No tasks in module for overdue, checking localStorage...');
            const savedTasks = localStorage.getItem('tasks');
            if (savedTasks) {
                allTasks = JSON.parse(savedTasks);
                console.log('🔍 Tasks loaded from localStorage for overdue:', allTasks);
            }
        }
        
        // Filter overdue tasks
        const overdueTasks = allTasks.filter(task => {
            if (!task.dueDate || task.completed) return false;
            const taskDate = new Date(task.dueDate).toISOString().split('T')[0];
            return taskDate < today;
        });
        
        console.log(`✅ Overdue tasks: ${overdueTasks.length} found`);
        
        return { tasks: overdueTasks, count: overdueTasks.length };
    }

    async getTasksCompletedData() {
        if (!window.secondBrain?.completedTasks) return { tasks: [], count: 0, hours: 0 };
        
        const completedTasks = window.secondBrain.completedTasks.completedTasks || [];
        const totalHours = completedTasks.reduce((sum, task) => sum + (task.hoursSpent || 0), 0);
        
        return { 
            tasks: completedTasks.slice(0, 5), // Show last 5 completed tasks
            count: completedTasks.length, 
            hours: Math.round(totalHours * 10) / 10 // Round to 1 decimal place
        };
    }

    async getWalletBalanceData() {
        console.log('🔍 SIMPLE: Getting wallet data...');
        
        // Simple approach: just get wallet data
        let allTransactions = [];
        
        // Try to get transactions from localStorage first (simplest approach)
        const savedTransactions = localStorage.getItem('wallet_transactions');
        if (savedTransactions) {
            allTransactions = JSON.parse(savedTransactions);
            console.log('✅ SIMPLE: Found transactions in localStorage:', allTransactions.length);
        }
        
        // If no transactions in localStorage, try to get from wallet module
        if (allTransactions.length === 0 && window.secondBrain?.wallet?.transactions) {
            allTransactions = window.secondBrain.wallet.transactions;
            console.log('✅ SIMPLE: Found transactions in module:', allTransactions.length);
        }
        
        // If still no transactions, create some simple sample data
        if (allTransactions.length === 0) {
            console.log('🔍 SIMPLE: No transactions found, creating sample data...');
            allTransactions = [
                { id: 1, type: 'income', amount: 5000, description: 'Freelance Payment', date: new Date().toISOString() },
                { id: 2, type: 'expense', amount: 1200, description: 'Grocery Shopping', date: new Date().toISOString() },
                { id: 3, type: 'income', amount: 3000, description: 'Project Payment', date: new Date().toISOString() }
            ];
            console.log('✅ SIMPLE: Created sample transactions:', allTransactions);
        }
        
        // Calculate balance
        const balance = allTransactions.reduce((total, transaction) => {
            return total + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
        }, 0);
        
        const recentTransactions = allTransactions.slice(0, 3);
        
        console.log(`✅ SIMPLE: Balance: ₹${balance}, Recent transactions: ${recentTransactions.length}`);
        
        return { 
            balance, 
            currency: '₹', 
            transactions: recentTransactions,
            message: `Balance: ₹${balance.toLocaleString()}`
        };
    }

    async getWalletTransactionsData() {
        if (!window.secondBrain?.wallet) return { transactions: [], count: 0 };
        
        const transactions = window.secondBrain.wallet.transactions || [];
        const recentTransactions = transactions.slice(0, 5);
        
        return { transactions: recentTransactions, count: transactions.length };
    }

    async getWalletSummaryData() {
        if (!window.secondBrain?.wallet) return { income: 0, expense: 0, net: 0 };
        
        const transactions = window.secondBrain.wallet.transactions || [];
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        return { income, expense, net: income - expense };
    }

    async getCrmProjectsData() {
        if (!window.secondBrain?.crm) return { projects: [], active: 0, completed: 0 };
        
        const projects = window.secondBrain.crm.projects || [];
        const active = projects.filter(p => !p.completed).length;
        const completed = projects.filter(p => p.completed).length;
        
        return { projects: projects.slice(0, 3), active, completed };
    }

    async getCrmRevenueData() {
        if (!window.secondBrain?.crm) return { monthly: 0, total: 0, clients: 0 };
        
        const projects = window.secondBrain.crm.projects || [];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let monthlyRevenue = 0;
        let totalRevenue = 0;
        const clients = new Set();
        
        projects.forEach(project => {
            if (project.client) {
                clients.add(project.client.name || project.client.email);
            }
            
            if (project.tasks) {
                project.tasks.forEach(task => {
                    if (task.completed && task.price) {
                        totalRevenue += task.price;
                        
                        // Check if task was completed this month
                        if (task.completedAt) {
                            const completedDate = new Date(task.completedAt);
                            if (completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear) {
                                monthlyRevenue += task.price;
                            }
                        }
                    }
                });
            }
        });
        
        return { monthly: monthlyRevenue, total: totalRevenue, clients: clients.size };
    }

    async getPomodoroTimerData() {
        if (!window.secondBrain?.pomodoro) return { sessions: 0, focusTime: 0, isRunning: false };
        
        const pomodoro = window.secondBrain.pomodoro;
        const sessions = pomodoro.sessions || [];
        const focusTime = sessions.reduce((sum, session) => {
            return sum + (session.type === 'focus' ? session.duration : 0);
        }, 0);
        
        return { 
            sessions: sessions.length, 
            focusTime: Math.round(focusTime / 60), // Convert seconds to minutes
            isRunning: pomodoro.isRunning || false 
        };
    }

    async getDailySummaryData() {
        if (!window.secondBrain?.completedTasks) return { tasksCompleted: 0, hoursWorked: 0, productivity: 0 };
        
        const completedTasks = window.secondBrain.completedTasks.completedTasks || [];
        const today = new Date().toISOString().split('T')[0];
        
        const todayTasks = completedTasks.filter(task => {
            const completedDate = task.completedAt ? task.completedAt.split('T')[0] : '';
            return completedDate === today;
        });
        
        const tasksCompleted = todayTasks.length;
        const hoursWorked = todayTasks.reduce((sum, task) => sum + (task.hoursSpent || 0), 0);
        const productivity = hoursWorked > 0 ? Math.min(100, Math.round((tasksCompleted / Math.max(1, hoursWorked)) * 20)) : 0;
        
        return { tasksCompleted, hoursWorked: Math.round(hoursWorked * 10) / 10, productivity };
    }

    async getGoalsProgressData() {
        if (!window.secondBrain?.goals) return { goals: [], completed: 0, total: 0 };
        
        const goals = window.secondBrain.goals.goals || [];
        const completed = goals.filter(g => g.completed).length;
        const total = goals.length;
        
        return { goals: goals.slice(0, 3), completed, total };
    }

    async getGoalsAchievementsData() {
        if (!window.secondBrain?.goals) return { achievements: [], count: 0 };
        
        const goals = window.secondBrain.goals.goals || [];
        const achievements = goals.filter(g => g.completed).slice(0, 3);
        
        return { achievements, count: achievements.length };
    }

    async getHabitsStreakData() {
        if (!window.secondBrain?.habits) return { habits: [], totalStreaks: 0 };
        
        const habits = window.secondBrain.habits.habits || [];
        const totalStreaks = habits.length > 0 ? 
            Math.max(...habits.map(habit => habit.streak || 0)) : 0;
        
        return { habits, totalStreaks };
    }

    renderWidget(widget) {
        const widgetGrid = document.getElementById('widgetGrid');
        if (!widgetGrid) return;

        const widgetElement = document.createElement('div');
        widgetElement.className = `widget-card size-${widget.size || 'medium'}`;
        widgetElement.dataset.widgetId = widget.id;
        widgetElement.draggable = true;
        widgetElement.innerHTML = `
            <div class="widget-drag-handle" title="Drag to move"></div>
            <div class="widget-card-header">
                <div class="widget-card-title">
                    ${widget.icon}
                    ${widget.title}
                </div>
                <div class="widget-controls">
                    <button class="widget-control" onclick="dashboardWidgets.toggleSizeSelector('${widget.id}')" title="Resize Widget">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                        </svg>
                        <div class="widget-size-selector" id="sizeSelector_${widget.id}">
                            <div class="widget-size-option ${widget.size === 'small' ? 'active' : ''}" onclick="dashboardWidgets.resizeWidget('${widget.id}', 'small')">
                                <div class="widget-size-indicator small"></div>
                                Small
                            </div>
                            <div class="widget-size-option ${widget.size === 'medium' ? 'active' : ''}" onclick="dashboardWidgets.resizeWidget('${widget.id}', 'medium')">
                                <div class="widget-size-indicator medium"></div>
                                Medium
                            </div>
                            <div class="widget-size-option ${widget.size === 'large' ? 'active' : ''}" onclick="dashboardWidgets.resizeWidget('${widget.id}', 'large')">
                                <div class="widget-size-indicator large"></div>
                                Large
                            </div>
                            <div class="widget-size-option ${widget.size === 'extra-large' ? 'active' : ''}" onclick="dashboardWidgets.resizeWidget('${widget.id}', 'extra-large')">
                                <div class="widget-size-indicator extra-large"></div>
                                Extra Large
                            </div>
                        </div>
                    </button>
                    <button class="widget-control" onclick="dashboardWidgets.removeWidget('${widget.id}')" title="Remove Widget">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="widget-card-content">
                ${this.renderWidgetContent(widget)}
            </div>
        `;

        // Add drag and drop event listeners
        this.setupWidgetDragAndDrop(widgetElement);
        
        widgetGrid.appendChild(widgetElement);
    }

    renderWidgetContent(widget) {
        // Show loading state
        if (widget.data && widget.data.loading) {
            return `
                <div style="display: flex; align-items: center; justify-content: center; height: 100px; color: var(--color-gray-600);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 16px; height: 16px; border: 2px solid var(--color-gray-300); border-top: 2px solid var(--color-gray-600); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        Loading data...
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
        }

        // Show error state
        if (widget.data && widget.data.error) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100px; color: var(--color-gray-600); text-align: center;">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
                    <div style="font-size: 0.875rem;">${widget.data.error}</div>
                </div>
            `;
        }

        switch (widget.type) {
            case 'notes-recent':
                return this.renderNotesRecentWidget(widget.data);
            case 'notes-stats':
                return this.renderNotesStatsWidget(widget.data);
            case 'tasks-today':
                return this.renderTasksTodayWidget(widget.data);
            case 'tasks-overdue':
                return this.renderTasksOverdueWidget(widget.data);
            case 'tasks-completed':
                return this.renderTasksCompletedWidget(widget.data);
            case 'calendar-mini':
                return this.renderCalendarMiniWidget(widget.data);
            case 'calendar-upcoming':
                return this.renderCalendarUpcomingWidget(widget.data);
            case 'habits-streak':
                return this.renderHabitsStreakWidget(widget.data);
            case 'wallet-balance':
                return this.renderWalletBalanceWidget(widget.data);
            case 'wallet-transactions':
                return this.renderWalletTransactionsWidget(widget.data);
            case 'wallet-summary':
                return this.renderWalletSummaryWidget(widget.data);
            case 'goals-progress':
                return this.renderGoalsProgressWidget(widget.data);
            case 'goals-achievements':
                return this.renderGoalsAchievementsWidget(widget.data);
            case 'crm-projects':
                return this.renderCrmProjectsWidget(widget.data);
            case 'crm-revenue':
                return this.renderCrmRevenueWidget(widget.data);
            case 'pomodoro-timer':
                return this.renderPomodoroTimerWidget(widget.data);
            case 'daily-summary':
                return this.renderDailySummaryWidget(widget.data);
            case 'focus-time':
                return this.renderFocusTimeWidget(widget.data);
            case 'quick-notes':
                return this.renderQuickNotesWidget(widget.data);
            case 'time-weather':
                return this.renderTimeWeatherWidget(widget.data);
            case 'bookmark-shortcuts':
                return this.renderBookmarkShortcutsWidget(widget.data);
            case 'analytics-productivity':
                return this.renderAnalyticsProductivityWidget(widget.data);
            default:
                return '<p>Widget content coming soon...</p>';
        }
    }

    renderNotesRecentWidget(data) {
        console.log('🔍 SIMPLE: Rendering notes widget with data:', data);
        
        if (!data || data.notes.length === 0) {
            return `
                <div style="text-align: center; padding: 1rem; color: var(--color-gray-600);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
                    <div style="font-size: 0.875rem;">No notes found</div>
                    <div style="font-size: 0.75rem; margin-top: 0.25rem; color: var(--color-gray-500);">Click below to add notes</div>
                    <button onclick="window.secondBrain.loadModule('notes')" style="margin-top: 0.75rem; padding: 0.5rem 1rem; background: var(--color-primary); color: var(--color-bg-primary); border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                        Go to Notes
                    </button>
                </div>
            `;
        }
        
        return `
            <div style="padding: 1rem;">
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-text-primary);">${data.count}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Total Notes</div>
                </div>
                
                <div style="font-size: 0.75rem; color: #666; text-align: center; margin-bottom: 1rem;">
                    ${data.message || `${data.notes.length} recent notes`}
                </div>
                
                <div style="font-size: 0.7rem; color: #888;">
                    <div style="font-weight: bold; margin-bottom: 0.5rem;">Recent Notes:</div>
                    ${data.notes.map(note => `
                        <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #000000;">
                            <div style="font-weight: bold; color: #000000; margin-bottom: 0.25rem;">📄 ${note.title}</div>
                            <div style="color: #525252; line-height: 1.3;">${note.content}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderNotesStatsWidget(data) {
        return `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.total}</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Total</div>
                </div>
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.thisWeek}</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">This Week</div>
                </div>
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.growth}%</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Growth</div>
                </div>
            </div>
        `;
    }

    renderTasksTodayWidget(data) {
        console.log('🔍 SIMPLE: Rendering widget with data:', data);
        
        if (!data || data.total === 0) {
            return `
                <div style="text-align: center; padding: 1rem; color: var(--color-gray-600);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
                    <div style="font-size: 0.875rem;">No tasks found</div>
                    <div style="font-size: 0.75rem; margin-top: 0.25rem; color: var(--color-gray-500);">Click below to add tasks</div>
                    <button onclick="window.secondBrain.loadModule('tasks')" style="margin-top: 0.75rem; padding: 0.5rem 1rem; background: var(--color-primary); color: var(--color-bg-primary); border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                        Go to Tasks
                    </button>
                </div>
            `;
        }
        
        const progress = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        
        return `
            <div style="padding: 1rem;">
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-text-primary);">${data.completed}/${data.total}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Tasks Completed</div>
                </div>
                
                <div style="background-color: var(--color-gray-200); height: 8px; border-radius: 4px; margin-bottom: 1rem;">
                    <div style="background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-gray-700) 100%); height: 100%; width: ${progress}%; border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
                
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); text-align: center;">
                    ${data.message || `${data.total} total tasks`}
                </div>
                
                ${data.tasks && data.tasks.length > 0 ? `
                    <div style="margin-top: 0.75rem; font-size: 0.7rem; color: #888;">
                        <div style="font-weight: bold; margin-bottom: 0.25rem;">Recent Tasks:</div>
                        ${data.tasks.slice(0, 3).map(task => `
                            <div style="margin-bottom: 0.25rem; ${task.completed ? 'text-decoration: line-through; color: #999;' : ''}">
                                ${task.completed ? '✅' : '⏳'} ${task.title}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderTasksOverdueWidget(data) {
        return `
            <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: #ef4444; margin-bottom: 0.5rem;">${data.count}</div>
                <div style="color: var(--color-gray-600);">Overdue Tasks</div>
                ${data.count > 0 ? '<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #ef4444;">⚠️ Needs attention</div>' : ''}
            </div>
        `;
    }

    renderTasksCompletedWidget(data) {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; text-align: center;">
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.count}</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Completed</div>
                </div>
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.hours}h</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Hours</div>
                </div>
            </div>
        `;
    }

    renderCalendarMiniWidget(data) {
        const today = new Date();
        const month = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `
            <div style="text-align: center;">
                <div style="font-weight: 600; margin-bottom: 1rem;">${month}</div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--color-black);">${today.getDate()}</div>
                <div style="color: var(--color-gray-600); margin-bottom: 1rem;">${today.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                <div style="font-size: 0.875rem; color: var(--color-gray-600);">${data.events.length} events today</div>
            </div>
        `;
    }

    renderCalendarUpcomingWidget(data) {
        if (data.events.length === 0) {
            return '<p style="text-align: center; color: var(--color-gray-600);">No upcoming events</p>';
        }
        return data.events.slice(0, 3).map(event => `
            <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-200);">
                <div style="font-weight: 500; margin-bottom: 0.25rem;">${event.title}</div>
                <div style="font-size: 0.875rem; color: var(--color-gray-600);">${event.date}</div>
            </div>
        `).join('');
    }

    renderHabitsStreakWidget(data) {
        return `
            <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--color-black); margin-bottom: 0.5rem;">${data.totalStreaks}</div>
                <div style="color: var(--color-gray-600); margin-bottom: 1rem;">Total Streaks</div>
                <div style="font-size: 0.875rem; color: var(--color-gray-600);">${data.habits.length} active habits</div>
            </div>
        `;
    }

    renderAnalyticsProductivityWidget(data) {
        return `
            <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--color-black); margin-bottom: 0.5rem;">${data.productivity}%</div>
                <div style="color: var(--color-gray-600);">Productivity Score</div>
                <div style="margin-top: 1rem; height: 60px; background: linear-gradient(135deg, var(--color-gray-300) 0%, var(--color-gray-400) 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--color-black); font-size: 0.875rem;">
                    Chart visualization coming soon
                </div>
            </div>
        `;
    }

    // ========================================
    // NEW WIDGET RENDERING FUNCTIONS
    // ========================================

    renderWalletBalanceWidget(data) {
        console.log('🔍 SIMPLE: Rendering wallet widget with data:', data);
        
        if (!data || data.balance === undefined) {
            return `
                <div style="text-align: center; padding: 1rem; color: var(--color-gray-600);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">💰</div>
                    <div style="font-size: 0.875rem;">No wallet data found</div>
                    <div style="font-size: 0.75rem; margin-top: 0.25rem; color: var(--color-gray-500);">Click below to manage wallet</div>
                    <button onclick="window.secondBrain.loadModule('wallet')" style="margin-top: 0.75rem; padding: 0.5rem 1rem; background: var(--color-primary); color: var(--color-bg-primary); border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                        Go to Wallet
                    </button>
                </div>
            `;
        }
        
        return `
            <div style="padding: 1rem;">
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-text-primary);">${data.currency}${data.balance.toLocaleString()}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Current Balance</div>
                </div>
                
                <div style="font-size: 0.75rem; color: #666; text-align: center; margin-bottom: 1rem;">
                    ${data.message || 'Wallet Summary'}
                </div>
                
                ${data.transactions && data.transactions.length > 0 ? `
                    <div style="font-size: 0.7rem; color: #888;">
                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Recent Transactions:</div>
                        ${data.transactions.map(transaction => `
                            <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; border-left: 3px solid ${transaction.type === 'income' ? '#000000' : '#404040'};">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="font-weight: bold; color: #000000;">${transaction.type === 'income' ? '💰' : '💸'} ${transaction.description}</div>
                                    <div style="color: ${transaction.type === 'income' ? '#000000' : '#404040'}; font-weight: bold;">
                                        ${transaction.type === 'income' ? '+' : '-'}${data.currency}${transaction.amount}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem;">
                    <button onclick="window.secondBrain.loadModule('wallet')" style="padding: 0.5rem 1rem; background: #000000; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">+ Add Income</button>
                    <button onclick="window.secondBrain.loadModule('wallet')" style="padding: 0.5rem 1rem; background: #404040; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">- Add Expense</button>
                </div>
            </div>
        `;
    }

    renderWalletTransactionsWidget(data) {
        if (data.transactions.length === 0) {
            return '<p style="text-align: center; color: var(--color-gray-600);">No recent transactions</p>';
        }
        return data.transactions.slice(0, 3).map(transaction => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-200);">
                <div>
                    <div style="font-weight: 500; font-size: 0.875rem;">${transaction.description}</div>
                    <div style="font-size: 0.75rem; color: var(--color-gray-600);">${transaction.date}</div>
                </div>
                <div style="font-weight: 600; color: ${transaction.type === 'income' ? '#10b981' : '#ef4444'};">
                    ${transaction.type === 'income' ? '+' : '-'}₹${transaction.amount}
                </div>
            </div>
        `).join('');
    }

    renderWalletSummaryWidget(data) {
        return `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                <div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #10b981;">₹${data.income}</div>
                    <div style="font-size: 0.75rem; color: var(--color-gray-600);">Income</div>
                </div>
                <div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #ef4444;">₹${data.expense}</div>
                    <div style="font-size: 0.75rem; color: var(--color-gray-600);">Expense</div>
                </div>
                <div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--color-black);">₹${data.net}</div>
                    <div style="font-size: 0.75rem; color: var(--color-gray-600);">Net</div>
                </div>
            </div>
        `;
    }

    renderGoalsProgressWidget(data) {
        const progress = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        return `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Goals Progress</span>
                    <span>${data.completed}/${data.total}</span>
                </div>
                <div style="background-color: var(--color-gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, var(--color-gray-400) 0%, var(--color-gray-500) 100%); height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
                </div>
            </div>
            <p style="text-align: center; color: var(--color-gray-600); font-size: 0.875rem;">${data.goals.length} active goals</p>
        `;
    }

    renderGoalsAchievementsWidget(data) {
        if (data.achievements.length === 0) {
            return '<p style="text-align: center; color: var(--color-gray-600);">No recent achievements</p>';
        }
        return data.achievements.slice(0, 3).map(achievement => `
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-200);">
                <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--color-gray-300) 0%, var(--color-gray-400) 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 500; font-size: 0.875rem;">${achievement.title}</div>
                    <div style="font-size: 0.75rem; color: var(--color-gray-600);">${achievement.date}</div>
                </div>
            </div>
        `).join('');
    }

    renderCrmProjectsWidget(data) {
        return `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; text-align: center;">
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.active}</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Active</div>
                </div>
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.completed}</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Completed</div>
                </div>
            </div>
            <div style="margin-top: 1rem; text-align: center; color: var(--color-gray-600); font-size: 0.875rem;">
                ${data.projects.length} total projects
            </div>
        `;
    }

    renderCrmRevenueWidget(data) {
        return `
            <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--color-black); margin-bottom: 0.5rem;">
                    ₹${data.monthly.toLocaleString()}
                </div>
                <div style="color: var(--color-gray-600); margin-bottom: 1rem;">This Month</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--color-black);">₹${data.total.toLocaleString()}</div>
                        <div style="font-size: 0.75rem; color: var(--color-gray-600);">Total</div>
                    </div>
                    <div>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--color-black);">${data.clients}</div>
                        <div style="font-size: 0.75rem; color: var(--color-gray-600);">Clients</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPomodoroTimerWidget(data) {
        return `
            <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--color-black); margin-bottom: 0.5rem;">
                    ${data.isRunning ? '25:00' : '25:00'}
                </div>
                <div style="color: var(--color-gray-600); margin-bottom: 1rem;">Focus Session</div>
                <button style="padding: 0.75rem 1.5rem; background: var(--color-gray-300); border: none; border-radius: 6px; color: var(--color-black); font-weight: 600; cursor: pointer; width: 100%;">
                    ${data.isRunning ? 'Pause' : 'Start'} Timer
                </button>
                <div style="margin-top: 1rem; display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--color-gray-600);">
                    <span>${data.sessions} sessions</span>
                    <span>${data.focusTime}h focused</span>
                </div>
            </div>
        `;
    }

    renderDailySummaryWidget(data) {
        return `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.tasksCompleted}</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Tasks Done</div>
                </div>
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.hoursWorked}h</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Hours Worked</div>
                </div>
                <div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-black);">${data.productivity}%</div>
                    <div style="font-size: 0.875rem; color: var(--color-gray-600);">Productivity</div>
                </div>
            </div>
        `;
    }

    renderFocusTimeWidget(data) {
        return `
            <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--color-black); margin-bottom: 0.5rem;">
                    ${data.today}h
                </div>
                <div style="color: var(--color-gray-600); margin-bottom: 1rem;">Today's Focus</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--color-black);">${data.thisWeek}h</div>
                        <div style="font-size: 0.75rem; color: var(--color-gray-600);">This Week</div>
                    </div>
                    <div>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--color-black);">${data.streak}</div>
                        <div style="font-size: 0.75rem; color: var(--color-gray-600);">Day Streak</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderQuickNotesWidget(data) {
        return `
            <div style="margin-bottom: 1rem;">
                <textarea placeholder="Quick note..." style="width: 100%; height: 80px; padding: 0.5rem; border: 1px solid var(--color-gray-200); border-radius: 4px; background: var(--color-gray-50); color: var(--color-black); resize: none; font-size: 0.875rem;"></textarea>
            </div>
            <button style="width: 100%; padding: 0.5rem; background: var(--color-gray-300); border: none; border-radius: 4px; color: var(--color-black); font-weight: 600; cursor: pointer;">
                Save Note
            </button>
        `;
    }

    renderTimeWeatherWidget(data) {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
        return `
            <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--color-black); margin-bottom: 0.25rem;">
                    ${time}
                </div>
                <div style="color: var(--color-gray-600); margin-bottom: 1rem; font-size: 0.875rem;">
                    ${date}
                </div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="font-size: 1.5rem;">☀️</span>
                    <span style="font-weight: 600; color: var(--color-black);">${data.weather}</span>
                </div>
                <div style="color: var(--color-gray-600); font-size: 0.875rem;">
                    ${data.temp}
                </div>
            </div>
        `;
    }

    renderBookmarkShortcutsWidget(data) {
        if (data.bookmarks.length === 0) {
            return '<p style="text-align: center; color: var(--color-gray-600);">No bookmarks yet</p>';
        }
        return data.bookmarks.slice(0, 4).map(bookmark => `
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--color-gray-200);">
                <div style="width: 24px; height: 24px; background: var(--color-gray-300); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">
                    ${bookmark.title.charAt(0).toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 0.875rem;">${bookmark.title}</div>
                    <div style="font-size: 0.75rem; color: var(--color-gray-600);">${bookmark.url}</div>
                </div>
            </div>
        `).join('');
    }

    removeWidget(widgetId) {
        this.widgets = this.widgets.filter(widget => widget.id !== widgetId);
        
        const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (widgetElement) {
            widgetElement.remove();
        }
        
        this.updateEmptyState();
        this.saveWidgets();
    }

    updateEmptyState() {
        const emptyState = document.getElementById('dashboardEmptyState');
        const widgetGrid = document.getElementById('widgetGrid');
        
        if (this.widgets.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            if (widgetGrid) widgetGrid.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (widgetGrid) widgetGrid.style.display = 'grid';
        }
    }

    saveWidgets() {
        try {
            localStorage.setItem('dashboard_widgets', JSON.stringify(this.widgets));
        } catch (error) {
            console.error('Error saving widgets:', error);
        }
    }

    loadWidgets() {
        try {
            const savedWidgets = localStorage.getItem('dashboard_widgets');
            if (savedWidgets) {
                this.widgets = JSON.parse(savedWidgets);
                this.widgets.forEach(widget => {
                    this.renderWidget(widget);
                });
                this.updateEmptyState();
            }
        } catch (error) {
            console.error('Error loading widgets:', error);
        }
    }

    // Method to update widget data (called by other modules)
    async updateWidgetData(widgetType, newData) {
        const widget = this.widgets.find(w => w.type === widgetType);
        if (widget) {
            widget.data = { ...widget.data, ...newData };
            const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"] .widget-card-content`);
            if (widgetElement) {
                widgetElement.innerHTML = this.renderWidgetContent(widget);
            }
            this.saveWidgets();
        }
    }

    // Method to refresh all widget data
    async refreshAllWidgets() {
        console.log('🔄 Refreshing all dashboard widgets...');
        
        for (const widget of this.widgets) {
            try {
                const realData = await this.getWidgetData(widget.type);
                widget.data = realData;
                
                // Update the widget content
                const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"] .widget-card-content`);
                if (widgetElement) {
                    widgetElement.innerHTML = this.renderWidgetContent(widget);
                }
            } catch (error) {
                console.error(`Error refreshing widget ${widget.type}:`, error);
            }
        }
        
        this.saveWidgets();
        console.log('✅ All widgets refreshed');
    }

    // Method to refresh specific widget type
    async refreshWidgetType(widgetType) {
        const widgets = this.widgets.filter(w => w.type === widgetType);
        
        for (const widget of widgets) {
            try {
                const realData = await this.getWidgetData(widget.type);
                widget.data = realData;
                
                // Update the widget content
                const widgetElement = document.querySelector(`[data-widget-id="${widget.id}"] .widget-card-content`);
                if (widgetElement) {
                    widgetElement.innerHTML = this.renderWidgetContent(widget);
                }
            } catch (error) {
                console.error(`Error refreshing widget ${widget.type}:`, error);
            }
        }
        
        this.saveWidgets();
    }

    // ========================================
    // WIDGET RESIZING AND DRAG & DROP
    // ========================================

    toggleSizeSelector(widgetId) {
        // Close all other size selectors
        document.querySelectorAll('.widget-size-selector').forEach(selector => {
            if (selector.id !== `sizeSelector_${widgetId}`) {
                selector.classList.remove('active');
            }
        });

        // Toggle current selector
        const selector = document.getElementById(`sizeSelector_${widgetId}`);
        if (selector) {
            selector.classList.toggle('active');
        }
    }

    resizeWidget(widgetId, newSize) {
        const widget = this.widgets.find(w => w.id === widgetId);
        if (widget) {
            widget.size = newSize;
            
            // Update the widget element
            const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
            if (widgetElement) {
                // Remove old size class
                widgetElement.classList.remove('size-small', 'size-medium', 'size-large', 'size-extra-large');
                // Add new size class
                widgetElement.classList.add(`size-${newSize}`);
            }

            // Update size selector active state
            const selector = document.getElementById(`sizeSelector_${widgetId}`);
            if (selector) {
                selector.querySelectorAll('.widget-size-option').forEach(option => {
                    option.classList.remove('active');
                });
                selector.querySelector(`[onclick*="'${newSize}'"]`).classList.add('active');
            }

            this.saveWidgets();
        }
    }

    setupWidgetDragAndDrop(widgetElement) {
        let draggedElement = null;
        let draggedIndex = -1;

        // Drag start
        widgetElement.addEventListener('dragstart', (e) => {
            draggedElement = widgetElement;
            draggedIndex = Array.from(widgetElement.parentNode.children).indexOf(widgetElement);
            widgetElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', widgetElement.outerHTML);
        });

        // Drag end
        widgetElement.addEventListener('dragend', (e) => {
            widgetElement.classList.remove('dragging');
            document.querySelectorAll('.widget-card').forEach(card => {
                card.classList.remove('drag-over');
            });
            draggedElement = null;
            draggedIndex = -1;
        });

        // Drag over
        widgetElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (e.target !== draggedElement) {
                e.target.classList.add('drag-over');
            }
        });

        // Drag leave
        widgetElement.addEventListener('dragleave', (e) => {
            e.target.classList.remove('drag-over');
        });

        // Drop
        widgetElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.target.classList.remove('drag-over');

            if (draggedElement && e.target !== draggedElement) {
                const dropIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
                
                // Reorder widgets array
                const draggedWidget = this.widgets.find(w => w.id === draggedElement.dataset.widgetId);
                const dropWidget = this.widgets.find(w => w.id === e.target.dataset.widgetId);
                
                if (draggedWidget && dropWidget) {
                    const draggedWidgetIndex = this.widgets.indexOf(draggedWidget);
                    const dropWidgetIndex = this.widgets.indexOf(dropWidget);
                    
                    // Remove dragged widget from array
                    this.widgets.splice(draggedWidgetIndex, 1);
                    
                    // Insert at new position
                    const newIndex = dropWidgetIndex > draggedWidgetIndex ? dropWidgetIndex - 1 : dropWidgetIndex;
                    this.widgets.splice(newIndex, 0, draggedWidget);
                    
                    // Re-render the grid
                    this.reorderWidgets();
                }
            }
        });

        // Close size selector when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.widget-control')) {
                document.querySelectorAll('.widget-size-selector').forEach(selector => {
                    selector.classList.remove('active');
                });
            }
        });
    }

    reorderWidgets() {
        const widgetGrid = document.getElementById('widgetGrid');
        if (!widgetGrid) return;

        // Clear the grid
        widgetGrid.innerHTML = '';

        // Re-render all widgets in new order
        this.widgets.forEach(widget => {
            this.renderWidget(widget);
        });

        this.saveWidgets();
    }

    // Enhanced save method to include size and position
    saveWidgets() {
        try {
            const widgetsToSave = this.widgets.map((widget, index) => ({
                ...widget,
                position: index
            }));
            localStorage.setItem('dashboard_widgets', JSON.stringify(widgetsToSave));
        } catch (error) {
            console.error('Error saving widgets:', error);
        }
    }

    // Enhanced load method to restore size and position
    async loadWidgets() {
        try {
            // Clear all existing widgets for now
            this.widgets = [];
            localStorage.removeItem('dashboard_widgets');
            this.updateEmptyState();
            console.log('🧹 Dashboard widgets cleared');
        } catch (error) {
            console.error('Error loading widgets:', error);
        }
    }
}

// Initialize dashboard widgets when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardWidgets = new DashboardWidgets();
});

// Global function to refresh dashboard widgets (can be called by other modules)
window.refreshDashboardWidgets = async (widgetType = null) => {
    if (window.dashboardWidgets) {
        if (widgetType) {
            await window.dashboardWidgets.refreshWidgetType(widgetType);
        } else {
            await window.dashboardWidgets.refreshAllWidgets();
        }
    }
};

// Theme Management System
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }
    
    init() {
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
        this.updateThemeIcon();
    }
    
    setupEventListeners() {
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }
    }
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.updateThemeIcon();
        localStorage.setItem('theme', this.currentTheme);
    }
    
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
    }
    
    updateThemeIcon() {
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            if (this.currentTheme === 'light') {
                // Sun icon for light mode
                themeIcon.innerHTML = `
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                `;
            } else {
                // Moon icon for dark mode
                themeIcon.innerHTML = `
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                `;
            }
        }
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecondBrain;
}
