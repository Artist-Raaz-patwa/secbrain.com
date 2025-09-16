// CSS Loader for Performance Optimization
class CSSLoader {
    constructor() {
        this.loadedStyles = new Set();
        this.fallbackStyles = new Map();
    }

    async loadOptimizedCSS() {
        try {
            // Check if optimized CSS is available
            const response = await fetch('css/optimized-styles.css');
            if (response.ok) {
                const cssText = await response.text();
                this.injectCSS('optimized-styles', cssText);
                console.log('✅ Optimized CSS loaded successfully');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Optimized CSS not available, using original styles');
        }
        return false;
    }

    injectCSS(id, cssText) {
        // Remove existing style if present
        const existingStyle = document.getElementById(id);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new style element
        const style = document.createElement('style');
        style.id = id;
        style.textContent = cssText;
        document.head.appendChild(style);
        
        this.loadedStyles.add(id);
    }

    async loadCriticalCSS() {
        // Load only the most critical styles first
        const criticalCSS = `
            /* Critical CSS - Above the fold */
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #000000;
                color: #ffffff;
                margin: 0;
                padding: 0;
            }
            
            .app-container {
                display: flex;
                min-height: 100vh;
            }
            
            .header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 64px;
                background-color: #000000;
                border-bottom: 1px solid #262626;
                z-index: 100;
            }
            
            .sidebar {
                width: 280px;
                background-color: #171717;
                border-right: 1px solid #262626;
                position: fixed;
                top: 64px;
                left: 0;
                bottom: 0;
                overflow-y: auto;
            }
            
            .main-content {
                flex: 1;
                margin-left: 280px;
                margin-top: 64px;
                padding: 2rem;
                min-height: calc(100vh - 64px);
            }
            
            .loading-spinner {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2rem;
            }
            
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #404040;
                border-top: 3px solid #ffffff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        this.injectCSS('critical-css', criticalCSS);
    }

    async loadNonCriticalCSS() {
        // Load non-critical styles after page load
        if (!this.loadedStyles.has('optimized-styles')) {
            await this.loadOptimizedCSS();
        }
    }

    preloadCSS() {
        // Preload CSS files for better performance
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = 'css/optimized-styles.css';
        link.onload = () => {
            link.rel = 'stylesheet';
        };
        document.head.appendChild(link);
    }
}

// Initialize CSS loader
window.cssLoader = new CSSLoader();

// Load critical CSS immediately
window.cssLoader.loadCriticalCSS();

// Load non-critical CSS after page load
window.addEventListener('load', () => {
    window.cssLoader.loadNonCriticalCSS();
});

// Preload CSS for better performance
if (document.readyState === 'loading') {
    window.cssLoader.preloadCSS();
}
