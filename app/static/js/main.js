import { AppController } from './modules/appController.js';

document.addEventListener('DOMContentLoaded', function () {
    const elements = {
        // Header element
        header: document.getElementById('app-header'),

        // File Upload elements
        dropArea: document.getElementById('drop-area'),
        fileInput: document.getElementById('file-input'),
        uploadSection: document.getElementById('upload-section'),
        fileList: document.getElementById('file-list'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingMessage: document.getElementById('loading-message'),

        // Document Viewer elements
        documentViewer: document.getElementById('document-viewer'),
        pageThumbnails: document.getElementById('page-thumbnails'),
        currentPageContent: document.getElementById('current-page-content'),

        // Study Tools elements
        summaryContent: document.getElementById('summary-content'),
        qaContent: document.getElementById('qa-content'),
        notesContent: document.getElementById('notes-content'),
        tabSummary: document.getElementById('tab-summary'),
        tabQA: document.getElementById('tab-qa'),
        tabNotes: document.getElementById('tab-notes'),
        questionInput: document.getElementById('question-input'),
        askButton: document.getElementById('ask-button'),
        qaHistory: document.getElementById('qa-history'),
        notesTextarea: document.getElementById('notes-textarea'),
        saveNotesButton: document.getElementById('save-notes')
    };

    // Define global utility functions
    window.showLoading = function (message) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingMessage = document.getElementById('loading-message');
        if (loadingOverlay && loadingMessage) {
            loadingMessage.textContent = message || 'Loading...';
            loadingOverlay.classList.remove('hidden');
        }
    };

    window.updateLoadingMessage = function (message) {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    };

    window.hideLoading = function () {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    };

    // Initialize the app controller
    const app = new AppController(elements);
    app.init();

    // Expose the app controller for testing/debugging
    window.appController = app;
}); 