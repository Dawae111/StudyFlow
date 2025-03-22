import { AppController } from './modules/appController.js';

document.addEventListener('DOMContentLoaded', function () {
    const elements = {
        // File Upload elements
        dropArea: document.getElementById('drop-area'),
        fileInput: document.getElementById('file-input'),
        uploadSection: document.getElementById('upload-section'),
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

    // Initialize the application
    const app = new AppController(elements);
    app.init();
}); 
