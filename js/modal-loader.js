// Modal Loader Utility
class ModalLoader {
    constructor() {
        this.loadedModals = new Set();
        this.modalCache = new Map();
    }

    async loadModal(modalName) {
        // Return cached modal if already loaded
        if (this.modalCache.has(modalName)) {
            return this.modalCache.get(modalName);
        }

        try {
            const response = await fetch(`modals/${modalName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load modal: ${modalName}`);
            }
            
            const modalHTML = await response.text();
            this.modalCache.set(modalName, modalHTML);
            this.loadedModals.add(modalName);
            
            return modalHTML;
        } catch (error) {
            console.error(`Error loading modal ${modalName}:`, error);
            return null;
        }
    }

    async injectModal(modalName, containerId = 'modal-container') {
        const modalHTML = await this.loadModal(modalName);
        if (!modalHTML) return false;

        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            document.body.appendChild(container);
        }

        container.innerHTML = modalHTML;
        return true;
    }

    isModalLoaded(modalName) {
        return this.loadedModals.has(modalName);
    }

    preloadModals(modalNames) {
        return Promise.all(modalNames.map(name => this.loadModal(name)));
    }
}

// Initialize modal loader
window.modalLoader = new ModalLoader();
