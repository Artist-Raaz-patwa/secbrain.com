// Performance Optimizer for Second Brain
class PerformanceOptimizer {
    constructor() {
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.observers = new Map();
        this.cache = new Map();
    }

    // Debounce function calls
    debounce(func, delay, key = 'default') {
        return (...args) => {
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            
            const timer = setTimeout(() => {
                func.apply(this, args);
                this.debounceTimers.delete(key);
            }, delay);
            
            this.debounceTimers.set(key, timer);
        };
    }

    // Throttle function calls
    throttle(func, delay, key = 'default') {
        return (...args) => {
            const existingTimer = this.throttleTimers.get(key);
            if (existingTimer) {
                return;
            }
            
            func.apply(this, args);
            
            const timer = setTimeout(() => {
                this.throttleTimers.delete(key);
            }, delay);
            
            this.throttleTimers.set(key, timer);
        };
    }

    // Memoize function results
    memoize(func, keyGenerator = (...args) => JSON.stringify(args)) {
        return (...args) => {
            const key = keyGenerator(...args);
            
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }
            
            const result = func.apply(this, args);
            this.cache.set(key, result);
            return result;
        };
    }

    // Lazy load images
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // Optimize scroll events
    optimizeScrollEvents() {
        const scrollHandler = this.throttle((e) => {
            // Handle scroll events efficiently
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Update header visibility based on scroll
            const header = document.querySelector('.header');
            if (header) {
                if (scrollTop > 100) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }
        }, 16, 'scroll'); // ~60fps

        window.addEventListener('scroll', scrollHandler, { passive: true });
    }

    // Optimize resize events
    optimizeResizeEvents() {
        const resizeHandler = this.debounce(() => {
            // Handle resize events efficiently
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Update responsive classes
            document.body.classList.toggle('mobile', width < 768);
            document.body.classList.toggle('tablet', width >= 768 && width < 1024);
            document.body.classList.toggle('desktop', width >= 1024);
            
            // Trigger custom resize event
            window.dispatchEvent(new CustomEvent('optimizedResize', {
                detail: { width, height }
            }));
        }, 250, 'resize');

        window.addEventListener('resize', resizeHandler);
    }

    // Preload critical resources
    preloadResources() {
        const criticalResources = [
            'js/modal-loader.js',
            'js/modal-utils.js',
            'css/optimized-styles.css'
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            
            if (resource.endsWith('.js')) {
                link.as = 'script';
            } else if (resource.endsWith('.css')) {
                link.as = 'style';
            }
            
            document.head.appendChild(link);
        });
    }

    // Optimize DOM queries
    optimizeDOMQueries() {
        // Cache frequently accessed elements
        const cache = new Map();
        
        window.$ = (selector) => {
            if (cache.has(selector)) {
                return cache.get(selector);
            }
            
            const element = document.querySelector(selector);
            if (element) {
                cache.set(selector, element);
            }
            return element;
        };

        window.$$ = (selector) => {
            const cacheKey = `all-${selector}`;
            if (cache.has(cacheKey)) {
                return cache.get(cacheKey);
            }
            
            const elements = document.querySelectorAll(selector);
            cache.set(cacheKey, elements);
            return elements;
        };
    }

    // Setup performance monitoring
    setupPerformanceMonitoring() {
        // Monitor Core Web Vitals
        if ('PerformanceObserver' in window) {
            // Largest Contentful Paint
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                console.log('LCP:', lastEntry.startTime);
            }).observe({ entryTypes: ['largest-contentful-paint'] });

            // First Input Delay
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    console.log('FID:', entry.processingStart - entry.startTime);
                });
            }).observe({ entryTypes: ['first-input'] });

            // Cumulative Layout Shift
            new PerformanceObserver((list) => {
                let clsValue = 0;
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                });
                console.log('CLS:', clsValue);
            }).observe({ entryTypes: ['layout-shift'] });
        }
    }

    // Initialize all optimizations
    init() {
        console.log('🚀 Initializing performance optimizations...');
        
        this.optimizeDOMQueries();
        this.setupLazyLoading();
        this.optimizeScrollEvents();
        this.optimizeResizeEvents();
        this.preloadResources();
        this.setupPerformanceMonitoring();
        
        console.log('✅ Performance optimizations initialized');
    }

    // Cleanup
    cleanup() {
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.throttleTimers.forEach(timer => clearTimeout(timer));
        this.observers.forEach(observer => observer.disconnect());
        this.debounceTimers.clear();
        this.throttleTimers.clear();
        this.observers.clear();
        this.cache.clear();
    }
}

// Initialize performance optimizer
window.performanceOptimizer = new PerformanceOptimizer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.performanceOptimizer.init();
    });
} else {
    window.performanceOptimizer.init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.performanceOptimizer.cleanup();
});
