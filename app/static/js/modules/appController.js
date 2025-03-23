import { FileUploadHandler } from './fileUpload.js';
import { DocumentViewer } from './documentViewer.js';
import { StudyTools } from './studyTools.js';
import { UIManager } from './uiUtils.js';
import { QAHandler } from './qaHandler.js';
import { FileListHandler } from './fileList.js';
import { api } from './api.js';

export class AppController {
    constructor(elements) {
        this.elements = elements;
        this.currentFileId = null;

        // Initialize UI manager
        this.uiManager = new UIManager(elements);

        // Initialize modules
        this.documentViewer = new DocumentViewer(elements);
        this.studyTools = new StudyTools(elements);
        this.qaHandler = new QAHandler(elements, this);
        this.fileUploadHandler = new FileUploadHandler(elements, this.handleFileProcessed.bind(this));

        // Add listener for summaries updated event
        document.addEventListener('summariesUpdated', (e) => {
            this.handleSummariesUpdated(e.detail.documentData);
        });

        // Add listener for return to homepage event
        document.addEventListener('returnToHomepage', () => {
            this.showHomepage();
        });

        this.fileListHandler = new FileListHandler(elements, this.handleFileSelected.bind(this));
    }

    init() {    
        console.log("Notate App initializing...");

        // Check server connection
        this.checkServerConnection().then(isConnected => {
            if (isConnected) {
                console.log("✅ Server connection successful");
            } else {
                console.error("❌ Server connection failed - API requests may not work");
                alert("Warning: Unable to connect to the server. Some features may not work correctly.");
            }
        });

        // Any additional initialization can go here
        console.log("Notate App initialized");
    }

    handleFileProcessed(documentData, fileId) {
        console.log(`Processing file with ID: ${fileId}`);

        // Hide upload section and header, show document viewer
        this.elements.uploadSection.classList.add('hidden');
        this.elements.header.classList.add('hidden');
        this.elements.documentViewer.classList.remove('hidden');

        // Set file ID for both components
        this.currentFileId = fileId;
        this.studyTools.setFileId(fileId);

        // Render document in viewer
        const currentPage = this.documentViewer.renderDocument(documentData);

        // Update study tools with current page data
        if (currentPage) {
            this.studyTools.updateContent(currentPage);

            // Initialize QAHandler with file ID and current page
            if (this.qaHandler) {
                console.log("Initializing QAHandler with file and page");
                this.qaHandler.appController = this; // Ensure appController reference is current
                this.qaHandler.initializeWithCurrentFile(fileId, currentPage.page_number);
            }

            // Make sure QA handler is aware of the current page
            const event = new CustomEvent('pageChanged', {
                detail: {
                    page: currentPage,
                    pageId: String(currentPage.page_number)
                }
            });
            document.dispatchEvent(event);

            console.log("Dispatched pageChanged event for page:", currentPage.page_number);
        }
    }

    handleFileSelected(file) {
        console.log(`Selected file: ${file.name}`);
        // Hide upload section and header, show document viewer
        this.elements.uploadSection.classList.add('hidden');
        this.elements.header.classList.add('hidden');
        this.elements.documentViewer.classList.remove('hidden');

        // Set file ID for both components
        this.currentFileId = file.id;
        this.studyTools.setFileId(file.id);

        // Fetch and render document data
        console.log(`Fetching and rendering document data for file: ${file.id}`);
        this.fetchAndRenderDocument(file.id);
    }

    async fetchAndRenderDocument(fileId) {
        try {
            const documentData = await api.fetchDocumentData(fileId);
            console.log(`Document data: ${documentData}`);
            const currentPage = this.documentViewer.renderDocument(documentData);
            console.log(`Current page: ${currentPage}`);
            if (currentPage) {
                this.studyTools.updateContent(currentPage);
                this.qaHandler.initializeWithCurrentFile(fileId, currentPage.page_number);

                const event = new CustomEvent('pageChanged', {
                    detail: {
                        page: currentPage,
                        pageId: String(currentPage.page_number)
                    }
                });
                document.dispatchEvent(event);
            }
        } catch (error) {
            console.error('Error fetching document:', error);
            alert('Error loading document. Please try again.');
        }
    }

    async checkServerConnection() {
        try {
            const response = await fetch('/api/debug/document/health-check', {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            return response.ok;
        } catch (error) {
            console.error("Failed to connect to server:", error);
            return false;
        }
    }

    // New method to handle updated summaries
    handleSummariesUpdated(documentData) {
        if (!documentData || !documentData.pages || !this.currentFileId) {
            return;
        }

        console.log('AppController: Handling updated summaries');

        // Update study tools with current page data
        const currentPageId = this.documentViewer.currentPageId;
        const currentPage = documentData.pages.find(p => p.page_number === currentPageId);

        if (currentPage) {
            this.studyTools.updateContent(currentPage);
        }
    }

    showHomepage() {
        // Show upload section and header, hide document viewer
        this.elements.uploadSection.classList.remove('hidden');
        this.elements.header.classList.remove('hidden');
        this.elements.documentViewer.classList.add('hidden');

        // Reset current file ID
        this.currentFileId = null;
        this.studyTools.setFileId(null);

        // Clean up any existing document viewer state
        this.documentViewer.cleanupPdfMonitoring();

        // Refresh the page after a short delay to ensure cleanup is complete
        setTimeout(() => {
            window.location.reload();
        }, 10);
    }
} 