import { FileUploadHandler } from './fileUpload.js';
import { DocumentViewer } from './documentViewer.js';
import { StudyTools } from './studyTools.js';
import { UIManager } from './uiUtils.js';
import { QAHandler } from './qaHandler.js';

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
    }

    init() {
        console.log("StudyFlow App initializing...");

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
        console.log("StudyFlow App initialized");
    }

    handleFileProcessed(documentData, fileId) {
        console.log(`Processing file with ID: ${fileId}`);

        // Hide upload section, show document viewer
        this.elements.uploadSection.classList.add('hidden');
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
} 