import { FileListHandler } from './modules/fileList.js';
import { FileUploadHandler } from './modules/fileUpload.js';
import { StudyTools } from './modules/studyTools.js';
import { UIManager } from './modules/uiUtils.js';

class AppController {
    constructor() {
        // Initialize the app controller instance
        if (window.app) {
            console.warn('AppController already initialized');
            return window.app;
        }

        // Store the instance
        window.app = this;

        // Bind methods to ensure proper 'this' context
        this.handleFileProcessed = this.handleFileProcessed.bind(this);

        this.elements = {
            fileList: document.getElementById('file-list'),
            fileUpload: document.getElementById('file-upload'),
            dropArea: document.getElementById('drop-area'),
            currentPageContent: document.getElementById('current-page-content'),
            qaHistory: document.getElementById('qa-history'),
            qaInput: document.getElementById('qa-input'),
            pdfViewer: document.getElementById('pdf-viewer'),
            pageText: document.getElementById('page-text'),
            pageSummary: document.getElementById('page-summary'),
            pageNotes: document.getElementById('page-notes'),
            tabSummary: document.getElementById('tab-summary'),
            tabQA: document.getElementById('tab-qa'),
            tabNotes: document.getElementById('tab-notes'),
            summaryContent: document.getElementById('summary-content'),
            qaContent: document.getElementById('qa-content'),
            notesContent: document.getElementById('notes-content'),
            documentTitle: document.getElementById('document-title'),
            pageNavigation: document.getElementById('page-navigation'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingMessage: document.getElementById('loading-message')
        };

        // Initialize modules after setting up the app controller
        this.initializeModules();
    }

    initializeModules() {
        // Initialize UI manager first
        this.uiManager = new UIManager(this.elements);

        // Initialize other modules with the fully set up app controller
        this.studyTools = new StudyTools(this.elements, this);
        this.fileListHandler = new FileListHandler(this.elements, this);
        this.fileUploadHandler = new FileUploadHandler(this.elements, this);

        console.log('All modules initialized');
    }

    async handleFileProcessed(documentData, fileId) {
        try {
            console.log('Processing document:', documentData);

            // Store the current file ID and data
            this.currentFileId = fileId;
            this.currentDocument = documentData;

            // Reset Q&A history for the new document
            if (this.elements.qaHistory) {
                this.elements.qaHistory.innerHTML = '';
            }

            // Display the PDF if available
            if (documentData.file_url) {
                if (documentData.file_type === 'pdf') {
                    // Display PDF in the viewer
                    if (this.elements.pdfViewer) {
                        this.elements.pdfViewer.src = documentData.file_url;
                        this.elements.pdfViewer.classList.remove('hidden');
                    }
                    if (this.elements.currentPageContent) {
                        this.elements.currentPageContent.classList.add('hidden');
                    }
                } else {
                    // Display image directly
                    if (this.elements.currentPageContent) {
                        this.elements.currentPageContent.innerHTML = `<img src="${documentData.file_url}" class="max-w-full h-auto" alt="Document content">`;
                        this.elements.currentPageContent.classList.remove('hidden');
                    }
                    if (this.elements.pdfViewer) {
                        this.elements.pdfViewer.classList.add('hidden');
                    }
                }
            }

            // Display the first page's content if available
            if (documentData.pages && documentData.pages.length > 0) {
                const firstPage = documentData.pages[0];

                // Update text content
                if (this.elements.pageText) {
                    this.elements.pageText.textContent = firstPage.text || '';
                }

                // Update summary
                if (this.elements.pageSummary) {
                    this.elements.pageSummary.textContent = firstPage.summary || '';
                }

                // Update notes
                if (this.elements.pageNotes) {
                    this.elements.pageNotes.value = firstPage.notes || '';
                }
            }

            // Update any other UI elements or state as needed
            if (this.uiManager) {
                this.uiManager.updateUIForNewDocument(documentData);
            }

            console.log('Document processing complete');
        } catch (error) {
            console.error('Error in handleFileProcessed:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create the app controller instance
    const app = new AppController();
}); 