import { api } from './api.js';

export class FileUploadHandler {
    constructor(elements, onFileProcessed) {
        this.elements = elements;
        this.onFileProcessed = onFileProcessed;
        this.currentFileId = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const { dropArea, fileInput } = this.elements;

        dropArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                this.handleFile(fileInput.files[0]);
            }
        });

        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const { dropArea } = this.elements;

        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('active');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('active');
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('active');
            if (e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    async handleFile(file) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a PDF or image file (JPEG, PNG).');
            return;
        }

        window.showLoading('Uploading file...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadData = await api.uploadFile(formData);
            if (!uploadData.file_id) {
                throw new Error('File upload failed');
            }

            this.currentFileId = uploadData.file_id;

            // Fetch and display document immediately without waiting for analysis
            window.updateLoadingMessage('Loading document...');
            await this.fetchDocumentData();

            // Trigger analysis in background after document is shown
            this.triggerBackgroundAnalysis();
        } catch (error) {
            console.error('Error:', error);
            window.hideLoading();
            alert('An error occurred while uploading the file.');
        }
    }

    async fetchDocumentData() {
        try {
            const data = await api.fetchDocumentData(this.currentFileId);
            window.hideLoading();
            this.onFileProcessed(data, this.currentFileId);
        } catch (error) {
            console.error('Error:', error);
            window.hideLoading();
            alert('An error occurred while fetching document data.');
        }
    }

    // New method to trigger analysis in the background
    async triggerBackgroundAnalysis() {
        try {
            console.log('Starting background analysis for document:', this.currentFileId);
            await api.analyzeDocument(this.currentFileId);
            console.log('Background analysis completed');

            // After analysis completes, start polling for updated summaries
            this.pollForUpdatedSummaries();
        } catch (error) {
            console.error('Error in background analysis:', error);
            // Don't show an alert since this is in the background
        }
    }

    // New method to poll for updated summaries and refresh the document
    async pollForUpdatedSummaries() {
        try {
            console.log('Polling for updated summaries...');
            const data = await api.fetchDocumentData(this.currentFileId);

            // Dispatch an event with the updated document data
            const event = new CustomEvent('summariesUpdated', {
                detail: {
                    documentData: data
                }
            });
            document.dispatchEvent(event);

            console.log('Document data refreshed with updated summaries');
        } catch (error) {
            console.error('Error polling for summaries:', error);
        }
    }

    showLoading(message) {
        window.showLoading(message);
    }

    updateLoadingMessage(message) {
        window.updateLoadingMessage(message);
    }

    hideLoading() {
        window.hideLoading();
    }
}