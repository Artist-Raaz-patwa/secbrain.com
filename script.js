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
            
            return true;
        } catch (error) {
            console.error('Error setting document:', error);
            // Fallback to local storage
            return this.setToLocalStorage(collection, docId, data);
        }
    }

    async getCollection(collection) {
        if (!this.isInitialized) return this.getFromLocalStorage(collection);
        
        try {
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
            
            return documents;
        } catch (error) {
            console.error('Error getting collection:', error);
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
            console.log('Firebase initialized, starting app...');
        } else {
            console.log('Firebase not available, using local storage fallback...');
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
        
        this.loadModule(this.currentModule);
        
        // Initialize CRM if we're starting on the CRM module
        if (this.currentModule === 'crm') {
            setTimeout(async () => {
                await this.initializeCrm();
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

        // Initialize Goals if switching to Goals module
        if (moduleName === 'goals') {
            setTimeout(async () => {
                await initializeGoals();
            }, 100);
        }

        // Initialize Completed Tasks if switching to completed-tasks module
        if (moduleName === 'completed-tasks') {
            setTimeout(() => {
                this.initializeCompletedTasks();
                this.completedTasks.loadCompletedTasks();
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

        // Module configurations
        const modules = {
            dashboard: {
                title: 'Dashboard',
                subtitle: 'Welcome to your Second Brain',
                content: this.getDashboardContent()
            },
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

    getDashboardContent() {
        return `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Quick Stats</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Notes</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Tasks</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Bookmarks</span>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Recent Activity</h3>
                    <div class="activity-list">
                        <div class="activity-item">
                            <div class="activity-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                </svg>
                            </div>
                            <div class="activity-content">
                                <p class="activity-text">Welcome to Second Brain</p>
                                <span class="activity-time">Just now</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Quick Actions</h3>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="secondBrain.switchModule('notes')">New Note</button>
                        <button class="btn btn-secondary" onclick="secondBrain.switchModule('tasks')">Add Task</button>
                        <button class="btn btn-secondary" onclick="secondBrain.switchModule('bookmarks')">Bookmark</button>
                    </div>
                </div>
            </div>
        `;
    }

    getNotesContent() {
        return `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Create New Note</h3>
                    <div class="action-buttons">
                        <button class="btn btn-primary">+ New Note</button>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Recent Notes</h3>
                    <div class="activity-list">
                        <div class="activity-item">
                            <div class="activity-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                </svg>
                            </div>
                            <div class="activity-content">
                                <p class="activity-text">No notes yet</p>
                                <span class="activity-time">Create your first note</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getTasksContent() {
        return `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Add New Task</h3>
                    <div class="action-buttons">
                        <button class="btn btn-primary">+ New Task</button>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Task List</h3>
                    <div class="activity-list">
                        <div class="activity-item">
                            <div class="activity-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 11l3 3l8-8"></path>
                                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
                                </svg>
                            </div>
                            <div class="activity-content">
                                <p class="activity-text">No tasks yet</p>
                                <span class="activity-time">Create your first task</span>
                            </div>
                        </div>
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
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Usage Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Total Notes</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Completed Tasks</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Bookmarks</span>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Activity Trends</h3>
                    <p>Analytics and insights will be displayed here.</p>
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
                    <button class="btn btn-primary" id="addProjectBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New Project
                    </button>
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
                        <p class="completed-tasks-subtitle">View and manage your completed tasks</p>
                    </div>
                    <div class="completed-tasks-actions">
                        <div class="selection-info">
                            <span id="selectionCount">0</span> of <span id="totalCount">0</span> selected
                        </div>
                        <button class="btn btn-secondary" id="selectAllBtn">Select All</button>
                        <button class="btn btn-secondary" id="clearSelectionBtn">Clear Selection</button>
                        <button class="btn btn-primary" id="generateReportBtn" disabled>Generate Report</button>
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

                <div class="completed-tasks-list" id="completedTasksList">
                    <!-- Completed tasks will be rendered here -->
                </div>

                <div class="empty-state" id="emptyCompletedTasks" style="display: none;">
                    <div class="empty-state-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M9 11l3 3l8-8"></path>
                            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9s9 4.03 9 9z"></path>
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
        
        // Connect with habit tracker if it exists
        if (this.habitTracker) {
            this.calendar.setHabitTracker(this.habitTracker);
            this.habitTracker.setCalendar(this.calendar);
            this.calendar.updateHabitProgress();
        }
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
        this.crm = new CrmManager(this.firebase);
        await this.crm.loadProjects();
        this.crm.renderProjects();
        this.crm.updateStats();
        this.setupCrmEventListeners();
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
        this.wallet = new WalletManager(this.firebase);
        await this.wallet.loadTransactions();
        this.setupWalletEventListeners();
    }

    setupWalletEventListeners() {
        const addTransactionBtn = document.getElementById('addTransactionBtn');

        if (addTransactionBtn) {
            addTransactionBtn.addEventListener('click', () => {
                this.wallet.showAddTransactionModal();
            });
        }
    }

    // Completed Tasks Methods
    initializeCompletedTasks() {
        this.completedTasks = new CompletedTasksManager();
        this.setupCompletedTasksEventListeners();
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
            searchTasks.addEventListener('input', () => {
                this.completedTasks.filterTasks();
            });
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.completedTasks.clearAllFilters();
            });
        }
    }

    // Goals Methods - Using simple global functions
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
    }

    loadCompletedTasks() {
        // Get all completed tasks from CRM projects
        this.completedTasks = [];
        
        if (window.secondBrain && window.secondBrain.crm && window.secondBrain.crm.projects) {
            window.secondBrain.crm.projects.forEach(project => {
                this.collectCompletedTasks(project.tasks, project);
            });
        }

        // Sort by completion date (newest first)
        this.completedTasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        
        this.filteredTasks = [...this.completedTasks];
        this.updateProjectFilter();
        this.renderCompletedTasks();
        this.updateStats();
    }

    collectCompletedTasks(tasks, project, parentTask = null) {
        tasks.forEach(task => {
            if (task.completed && task.completedAt) {
                this.completedTasks.push({
                    ...task,
                    projectName: project.name,
                    projectId: project.id,
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
                    <h3 class="report-modal-title">Client Report</h3>
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
            <div style="font-family: Arial, sans-serif; color: black; background: white; padding: 20px; max-width: 800px; margin: 0 auto;">
                <h1 style="text-align: center; margin-bottom: 30px; font-size: 24px; font-weight: bold;">CLIENT WORK REPORT</h1>
                <p style="text-align: center; margin-bottom: 30px; font-size: 14px;">Generated on: ${date}</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background-color: #f5f5f5;">
                            <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold;">Task Name</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Hours Spent</th>
                            <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Completion Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        reportData.tasks.forEach((task, index) => {
            const completedDate = new Date(task.completedAt).toISOString().split('T')[0]; // YYYY-MM-DD format
            html += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px;">${task.name}</td>
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
                            <td style="border: 1px solid #000; padding: 8px; text-align: right;">TOTAL:</td>
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
        a.download = `client-report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.secondBrain = new SecondBrain();
});

// Simple Goals System
let goals = [];

async function initializeGoals() {
    const addBtn = document.getElementById('addGoalBtn');
    if (addBtn) {
        addBtn.onclick = addGoal;
    }
    await loadGoals();
    displayGoals();
}

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

async function addGoal() {
    const name = prompt('Enter goal name:');
    if (!name) return;
    
    const target = prompt('Enter target amount (₹):');
    if (!target) return;
    
    const targetDate = prompt('Enter target date (YYYY-MM-DD):', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    if (!targetDate) return;
    
    const goal = {
        id: Date.now(),
        name: name,
        target: parseFloat(target),
        current: 0,
        targetDate: targetDate,
        image: null,
        date: new Date().toLocaleDateString(),
        userId: window.secondBrain && window.secondBrain.firebase ? window.secondBrain.firebase.userId : 'anonymous_user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    goals.push(goal);
    await saveGoals();
    
    // Log the activity
    logActivity('Goals', 'Added', `Created new goal: "${name}" with target amount ₹${target}`);
    
    displayGoals();
}

function displayGoals() {
    const list = document.getElementById('goalsList');
    if (!list) return;
    
    if (goals.length === 0) {
        list.innerHTML = '<p>No goals yet. Click "New Goal" to get started!</p>';
        return;
    }
    
    list.innerHTML = goals.map(goal => {
        const progress = (goal.current / goal.target) * 100;
        const countdown = getCountdown(goal.targetDate);
        const imageHtml = goal.image ? `<img src="${goal.image}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px; margin: 10px 0;" onclick="showFullImage('${goal.image}')">` : '';
        
        return `
            <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; display: flex; gap: 15px;">
                <div style="flex: 1;">
                    ${imageHtml}
                    <h3>${goal.name}</h3>
                    <p><strong>Target:</strong> ₹${goal.target.toLocaleString('en-IN')}</p>
                    <p><strong>Current:</strong> ₹${goal.current.toLocaleString('en-IN')}</p>
                    <p><strong>Time Left:</strong> <span style="color: ${countdown.days < 30 ? '#f44336' : '#4CAF50'}">${countdown.text}</span></p>
                    <div style="background: #f0f0f0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0;">
                        <div style="background: #4CAF50; height: 100%; width: ${Math.min(progress, 100)}%; transition: width 0.3s;"></div>
                    </div>
                    <p><strong>Progress:</strong> ${Math.round(progress)}%</p>
                    <div style="margin-top: 10px;">
                        <button onclick="updateGoal(${goal.id})" style="margin-right: 10px; padding: 5px 10px;">Update Amount</button>
                        <button onclick="addImage(${goal.id})" style="margin-right: 10px; padding: 5px 10px; background: #2196F3; color: white;">Add Image</button>
                        <button onclick="deleteGoal(${goal.id})" style="background: #f44336; color: white; padding: 5px 10px;">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

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
        goals = goals.filter(g => g.id !== id);
        await saveGoals();
        
        // Log the activity
        logActivity('Goals', 'Deleted', `Deleted goal: "${goal.name}"`);
        
        displayGoals();
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
        background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4CAF50'};
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
        if (!this.habitTracker) return;
        
        const modal = document.getElementById('habitModal');
        if (!modal) {
            this.createHabitModal();
        }
        
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
        const modal = document.getElementById('habitModal');
        const modalDate = document.getElementById('habitModalDate');
        const modalProgressFill = document.getElementById('habitModalProgressFill');
        const modalProgressText = document.getElementById('habitModalProgressText');
        const modalList = document.getElementById('habitModalList');

        if (!modal || !modalDate || !modalProgressFill || !modalProgressText || !modalList) return;

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
        this.loadProjects();
        // Note: renderProjects() will be called by initializeCrm() after DOM is ready
    }

    // Project Management
    async addProject(name, description, deadline, companyName, companyEmail) {
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

    async editProject(id, name, description, deadline, companyName, companyEmail) {
        const project = this.projects.find(p => p.id === id);
        if (project) {
            project.name = name.trim();
            project.description = description.trim();
            project.deadline = deadline;
            project.client.name = companyName.trim();
            project.client.email = companyEmail.trim();
            
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
        }
    }

    async deleteProject(id) {
        this.projects = this.projects.filter(p => p.id !== id);
        await this.saveProjects();
        this.renderProjects();
        this.updateStats();
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

        this.removeTaskFromProject(project, taskId);
        await this.saveProjects();
        this.renderProjects();
        this.updateStats();
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
            
            await this.saveProjects();
            this.renderProjects();
            this.updateStats();
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

        const totalProjectsEl = document.getElementById('totalProjects');
        const totalTasksEl = document.getElementById('totalTasks');
        const completedTasksEl = document.getElementById('completedTasks');
        const totalValueEl = document.getElementById('totalValue');

        if (totalProjectsEl) totalProjectsEl.textContent = totalProjects;
        if (totalTasksEl) totalTasksEl.textContent = allTasks.length;
        if (completedTasksEl) completedTasksEl.textContent = completedTasks;
        if (totalValueEl) totalValueEl.textContent = `₹${totalValue.toLocaleString()}`;
    }

    // Rendering
    renderProjects() {
        const projectsList = document.getElementById('projectsList');
        const emptyState = document.getElementById('crmEmptyState');

        if (!projectsList) return;

        if (this.projects.length === 0) {
            projectsList.innerHTML = '';
            if (emptyState) {
                projectsList.appendChild(emptyState);
            }
            return;
        }

        const projectsHTML = this.projects.map(project => this.renderProject(project)).join('');
        projectsList.innerHTML = projectsHTML;

        // Attach event listeners
        this.attachProjectEventListeners();
    }

    renderProject(project) {
        const progress = this.calculateProjectProgress(project);
        const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline';
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div class="project-info">
                        <h3 class="project-title">${project.name}</h3>
                        <div class="project-meta">
                            <span>Company: ${project.client.name}</span>
                            <span>Deadline: ${deadline}</span>
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

        return `
            <div class="task-item level-${level} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="window.secondBrain.crm.toggleTask(${projectId}, ${task.id}).catch(console.error)"></div>
                <div class="task-content">
                    <div class="task-header">
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

    // Modal Management
    showAddProjectModal() {
        this.createModal('Add Project', this.getAddProjectModalContent(), async (formData) => {
            await this.addProject(
                formData.name,
                formData.description,
                formData.deadline,
                formData.companyName,
                formData.companyEmail
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
                formData.companyEmail
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
            </form>
        `;
    }

    getEditProjectModalContent(project) {
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
        } catch (error) {
            console.error('Error saving CRM projects:', error);
            // Fallback to local storage
            localStorage.setItem('crm_projects', JSON.stringify(this.projects));
            localStorage.setItem('crm_next_project_id', this.nextProjectId.toString());
            localStorage.setItem('crm_next_task_id', this.nextTaskId.toString());
        }
    }

    async loadProjects() {
        try {
            if (this.firebase && this.firebase.isInitialized) {
                // Load projects from Firebase
                const firebaseProjects = await this.firebase.getProjects();
                if (firebaseProjects && firebaseProjects.length > 0) {
                    // Filter projects by current user
                    this.projects = firebaseProjects.filter(project => project.userId === this.firebase.userId);
                    
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
        this.loadTransactions();
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

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.saveTransactions();
        this.renderTransactions();
        this.updateStats();
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
                    <button class="transaction-action-btn" onclick="window.secondBrain.wallet.deleteTransaction(${transaction.id})" title="Delete Transaction">
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
        this.loadGoals();
        console.log('GoalsManager initialized with', this.goals.length, 'goals');
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

    deleteGoal(id) {
        this.goals = this.goals.filter(g => g.id !== id);
        this.stopCountdown(id);
        this.saveGoals();
        this.renderGoals();
        this.updateStats();
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
                            <button class="goal-action-btn" onclick="window.secondBrain.goals.deleteGoal(${goal.id})" title="Delete Goal">
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

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecondBrain;
}
