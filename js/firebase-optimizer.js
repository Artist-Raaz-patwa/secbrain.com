// Firebase Optimizer for Second Brain
class FirebaseOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.batchOperations = [];
        this.batchTimer = null;
        this.connectionStatus = 'unknown';
        this.retryAttempts = new Map();
        this.maxRetries = 3;
    }

    // Cache management
    setCache(key, data, ttl = 300000) { // 5 minutes default TTL
        this.cache.set(key, data);
        this.cacheExpiry.set(key, Date.now() + ttl);
    }

    getCache(key) {
        const expiry = this.cacheExpiry.get(key);
        if (expiry && Date.now() > expiry) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return null;
        }
        return this.cache.get(key);
    }

    clearCache(pattern = null) {
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                    this.cacheExpiry.delete(key);
                }
            }
        } else {
            this.cache.clear();
            this.cacheExpiry.clear();
        }
    }

    // Optimized data fetching with caching
    async fetchWithCache(collection, docId = null, options = {}) {
        const cacheKey = docId ? `${collection}/${docId}` : collection;
        const cached = this.getCache(cacheKey);
        
        if (cached && !options.forceRefresh) {
            return cached;
        }

        try {
            let data;
            if (docId) {
                data = await this.fetchDocument(collection, docId);
            } else {
                data = await this.fetchCollection(collection, options);
            }
            
            this.setCache(cacheKey, data, options.ttl);
            return data;
        } catch (error) {
            console.error(`Error fetching ${cacheKey}:`, error);
            throw error;
        }
    }

    async fetchDocument(collection, docId) {
        const retryKey = `doc_${collection}_${docId}`;
        return this.withRetry(async () => {
            const doc = await window.firebase.db.collection(collection).doc(docId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            throw new Error(`Document ${docId} not found in ${collection}`);
        }, retryKey);
    }

    async fetchCollection(collection, options = {}) {
        const retryKey = `collection_${collection}`;
        return this.withRetry(async () => {
            let query = window.firebase.db.collection(collection);
            
            // Apply filters
            if (options.where) {
                options.where.forEach(filter => {
                    query = query.where(filter.field, filter.operator, filter.value);
                });
            }
            
            // Apply ordering
            if (options.orderBy) {
                options.orderBy.forEach(order => {
                    query = query.orderBy(order.field, order.direction || 'asc');
                });
            }
            
            // Apply limit
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, retryKey);
    }

    // Batch operations for better performance
    batchWrite(operation) {
        this.batchOperations.push(operation);
        
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        
        this.batchTimer = setTimeout(() => {
            this.executeBatch();
        }, 100); // Batch operations within 100ms
    }

    async executeBatch() {
        if (this.batchOperations.length === 0) return;
        
        const batch = window.firebase.db.batch();
        const operations = [...this.batchOperations];
        this.batchOperations = [];
        this.batchTimer = null;
        
        try {
            operations.forEach(operation => {
                operation(batch);
            });
            
            await batch.commit();
            console.log(`✅ Batch operation completed: ${operations.length} operations`);
        } catch (error) {
            console.error('❌ Batch operation failed:', error);
            // Retry individual operations
            for (const operation of operations) {
                try {
                    const singleBatch = window.firebase.db.batch();
                    operation(singleBatch);
                    await singleBatch.commit();
                } catch (singleError) {
                    console.error('❌ Individual operation failed:', singleError);
                }
            }
        }
    }

    // Retry mechanism with exponential backoff
    async withRetry(operation, key) {
        const attempts = this.retryAttempts.get(key) || 0;
        
        try {
            const result = await operation();
            this.retryAttempts.delete(key);
            return result;
        } catch (error) {
            if (attempts < this.maxRetries) {
                this.retryAttempts.set(key, attempts + 1);
                const delay = Math.pow(2, attempts) * 1000; // Exponential backoff
                
                console.warn(`⚠️ Retrying operation (attempt ${attempts + 1}/${this.maxRetries}) after ${delay}ms`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(operation, key);
            } else {
                this.retryAttempts.delete(key);
                throw error;
            }
        }
    }

    // Connection monitoring
    setupConnectionMonitoring() {
        // Monitor Firebase connection status
        const connectedRef = window.firebase.db.ref('.info/connected');
        
        connectedRef.on('value', (snapshot) => {
            const isConnected = snapshot.val();
            this.connectionStatus = isConnected ? 'connected' : 'disconnected';
            
            if (isConnected) {
                console.log('✅ Firebase connected');
                // Sync any pending operations
                this.syncPendingOperations();
            } else {
                console.warn('⚠️ Firebase disconnected');
            }
        });
    }

    // Offline support
    setupOfflineSupport() {
        // Enable offline persistence
        window.firebase.db.enablePersistence({
            synchronizeTabs: true
        }).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ The current browser does not support offline persistence');
            }
        });
    }

    // Data synchronization
    async syncPendingOperations() {
        // Implement sync logic for offline operations
        console.log('🔄 Syncing pending operations...');
    }

    // Performance monitoring
    setupPerformanceMonitoring() {
        // Monitor Firebase performance
        if (window.firebase.analytics) {
            // Track Firebase operations
            const originalGet = window.firebase.db.collection;
            window.firebase.db.collection = function(collectionName) {
                const startTime = performance.now();
                const collection = originalGet.call(this, collectionName);
                
                // Wrap get method to track performance
                const originalGetMethod = collection.get;
                collection.get = function() {
                    const getStartTime = performance.now();
                    return originalGetMethod.apply(this, arguments).then(result => {
                        const duration = performance.now() - getStartTime;
                        console.log(`📊 Firebase get operation: ${collectionName} took ${duration.toFixed(2)}ms`);
                        return result;
                    });
                };
                
                return collection;
            };
        }
    }

    // Initialize Firebase optimizations
    init() {
        console.log('🔥 Initializing Firebase optimizations...');
        
        this.setupConnectionMonitoring();
        this.setupOfflineSupport();
        this.setupPerformanceMonitoring();
        
        console.log('✅ Firebase optimizations initialized');
    }

    // Cleanup
    cleanup() {
        this.clearCache();
        this.batchOperations = [];
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        this.retryAttempts.clear();
    }
}

// Initialize Firebase optimizer
window.firebaseOptimizer = new FirebaseOptimizer();

// Initialize when Firebase is ready
if (window.firebase) {
    window.firebaseOptimizer.init();
} else {
    // Wait for Firebase to be available
    const checkFirebase = setInterval(() => {
        if (window.firebase) {
            window.firebaseOptimizer.init();
            clearInterval(checkFirebase);
        }
    }, 100);
}
