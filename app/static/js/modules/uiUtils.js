export class UIManager {
    constructor(elements) {
        this.elements = elements;
        this.setupTabSwitching();
        this.setupLoadingOverlay();
    }

    setupTabSwitching() {
        this.elements.tabSummary.addEventListener('click', () => this.switchTab('summary'));
        this.elements.tabQA.addEventListener('click', () => this.switchTab('qa'));
        this.elements.tabNotes.addEventListener('click', () => this.switchTab('notes'));

        // Default to summary tab
        this.switchTab('summary');
    }

    switchTab(tab) {
        // Remove active class from all tabs and content
        this.elements.tabSummary.classList.remove('active-tab');
        this.elements.tabQA.classList.remove('active-tab');
        this.elements.tabNotes.classList.remove('active-tab');
        this.elements.summaryContent.classList.add('hidden');
        this.elements.qaContent.classList.add('hidden');
        this.elements.notesContent.classList.add('hidden');

        // Add active class to selected tab and show content
        if (tab === 'summary') {
            this.elements.tabSummary.classList.add('active-tab');
            this.elements.summaryContent.classList.remove('hidden');
        } else if (tab === 'qa') {
            this.elements.tabQA.classList.add('active-tab');
            this.elements.qaContent.classList.remove('hidden');
        } else if (tab === 'notes') {
            this.elements.tabNotes.classList.add('active-tab');
            this.elements.notesContent.classList.remove('hidden');
        }
    }

    setupLoadingOverlay() {
        // Define loading overlay methods
        window.showLoading = this.showLoading.bind(this);
        window.updateLoadingMessage = this.updateLoadingMessage.bind(this);
        window.hideLoading = this.hideLoading.bind(this);
    }

    showLoading(message) {
        this.elements.loadingOverlay.classList.remove('hidden');
        this.elements.loadingMessage.textContent = message || 'Loading...';
    }

    updateLoadingMessage(message) {
        this.elements.loadingMessage.textContent = message;
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }
} 