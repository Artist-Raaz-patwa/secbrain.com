// Module Loader for Second Brain - Lazy Loading System
class ModuleLoader {
    constructor() {
        this.loadedModules = new Set();
        this.moduleCache = new Map();
        this.loadingPromises = new Map();
    }

    // Load a module dynamically
    async loadModule(moduleName, options = {}) {
        // Return cached module if already loaded
        if (this.moduleCache.has(moduleName)) {
            return this.moduleCache.get(moduleName);
        }

        // Return existing loading promise if already loading
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        const loadPromise = this._loadModuleFile(moduleName, options);
        this.loadingPromises.set(moduleName, loadPromise);

        try {
            const module = await loadPromise;
            this.moduleCache.set(moduleName, module);
            this.loadedModules.add(moduleName);
            this.loadingPromises.delete(moduleName);
            return module;
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            throw error;
        }
    }

    async _loadModuleFile(moduleName, options) {
        const modulePath = `modules/${moduleName}.js`;
        
        try {
            // Load the module script
            const script = document.createElement('script');
            script.type = 'module';
            script.src = modulePath;
            
            return new Promise((resolve, reject) => {
                script.onload = () => {
                    // Module should be available on window object
                    const module = window[moduleName] || window[moduleName.charAt(0).toUpperCase() + moduleName.slice(1)];
                    if (module) {
                        resolve(module);
                    } else {
                        reject(new Error(`Module ${moduleName} not found after loading`));
                    }
                };
                
                script.onerror = () => {
                    reject(new Error(`Failed to load module: ${moduleName}`));
                };
                
                document.head.appendChild(script);
            });
        } catch (error) {
            throw new Error(`Error loading module ${moduleName}: ${error.message}`);
        }
    }

    // Preload modules for better performance
    async preloadModules(moduleNames) {
        const preloadPromises = moduleNames.map(name => this.loadModule(name));
        try {
            await Promise.all(preloadPromises);
            console.log('✅ Modules preloaded successfully:', moduleNames);
        } catch (error) {
            console.warn('⚠️ Some modules failed to preload:', error);
        }
    }

    // Check if module is loaded
    isModuleLoaded(moduleName) {
        return this.loadedModules.has(moduleName);
    }

    // Get loaded modules
    getLoadedModules() {
        return Array.from(this.loadedModules);
    }

    // Lazy load modules based on user interaction
    setupLazyLoading() {
        // Disabled for SecondBrain app - it uses its own module system
        console.log('🔍 Module loader lazy loading disabled for SecondBrain app');
    }

    // Initialize critical modules
    async initCriticalModules() {
        // Disabled for SecondBrain app - it uses its own module system
        console.log('🔍 Module loader critical modules disabled for SecondBrain app');
    }
}

// Initialize module loader
window.moduleLoader = new ModuleLoader();

// Setup lazy loading when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.moduleLoader.setupLazyLoading();
        window.moduleLoader.initCriticalModules();
    });
} else {
    window.moduleLoader.setupLazyLoading();
    window.moduleLoader.initCriticalModules();
}
