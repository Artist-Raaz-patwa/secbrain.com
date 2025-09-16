// Modal Utilities for Second Brain
class ModalUtils {
    constructor() {
        this.modalLoader = window.modalLoader;
    }

    async showModal(modalName, options = {}) {
        try {
            // Load modal if not already loaded
            await this.modalLoader.injectModal(modalName);
            
            // Show the modal
            const modal = document.getElementById(modalName);
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                // Set up event listeners if not already set
                this.setupModalListeners(modalName);
                
                // Call custom show callback if provided
                if (options.onShow) {
                    options.onShow(modal);
                }
            }
        } catch (error) {
            console.error(`Error showing modal ${modalName}:`, error);
        }
    }

    hideModal(modalName) {
        const modal = document.getElementById(modalName);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    setupModalListeners(modalName) {
        const modal = document.getElementById(modalName);
        if (!modal) return;

        // Close button
        const closeBtn = modal.querySelector(`#${modalName}Close`);
        if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
            closeBtn.addEventListener('click', () => this.hideModal(modalName));
            closeBtn.setAttribute('data-listener-added', 'true');
        }

        // Click outside to close
        if (!modal.hasAttribute('data-listener-added')) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modalName);
                }
            });
            modal.setAttribute('data-listener-added', 'true');
        }

        // ESC key to close
        const handleEsc = (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.hideModal(modalName);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        
        if (!modal.hasAttribute('data-esc-listener-added')) {
            document.addEventListener('keydown', handleEsc);
            modal.setAttribute('data-esc-listener-added', 'true');
        }
    }

    // Preload commonly used modals
    async preloadCommonModals() {
        const commonModals = [
            'task-completion-modal',
            'widget-selection-modal'
        ];
        
        try {
            await this.modalLoader.preloadModals(commonModals);
            console.log('✅ Common modals preloaded successfully');
        } catch (error) {
            console.error('❌ Error preloading modals:', error);
        }
    }
}

// Initialize modal utils
window.modalUtils = new ModalUtils();
