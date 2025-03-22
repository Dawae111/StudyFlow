import { DocumentViewer } from './modules/documentViewer.js';
import { StudyTools } from './modules/studyTools.js';
import { QAHandler } from './modules/qaHandler.js';
import { UIManager } from './modules/uiUtils.js';

document.addEventListener('DOMContentLoaded', function () {
    // Get the file ID from the URL
    const fileId = window.location.pathname.split('/').pop();
    console.log(`Initializing document page for file ID: ${fileId}`);

    const elements = {
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
        saveNotesButton: document.getElementById('save-notes'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingMessage: document.getElementById('loading-message')
    };

    // Initialize UI manager
    const uiManager = new UIManager(elements);

    // Initialize modules
    const documentViewer = new DocumentViewer(elements);
    const studyTools = new StudyTools(elements);
    const qaHandler = new QAHandler(elements);

    // Load document data
    fetch(`/api/summaries/${fileId}`)
        .then(response => response.json())
        .then(documentData => {
            // Set file ID for components
            studyTools.setFileId(fileId);

            // Render document in viewer
            const currentPage = documentViewer.renderDocument(documentData);

            // Update study tools with current page data
            if (currentPage) {
                studyTools.updateContent(currentPage);

                // Initialize QAHandler with file ID and current page
                qaHandler.initializeWithCurrentFile(fileId, currentPage.page_number);

                // Make sure QA handler is aware of the current page
                const event = new CustomEvent('pageChanged', {
                    detail: {
                        page: currentPage,
                        pageId: String(currentPage.page_number)
                    }
                });
                document.dispatchEvent(event);
            }

            // Hide loading overlay
            elements.loadingOverlay.classList.add('hidden');
        })
        .catch(error => {
            console.error('Error loading document:', error);
            elements.loadingMessage.textContent = 'Error loading document. Please try again.';
        });
}); 