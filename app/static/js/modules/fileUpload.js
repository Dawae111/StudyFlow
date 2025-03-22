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

        this.showLoading('Uploading and processing file...');
        
        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadData = await api.uploadFile(formData);
            if (!uploadData.file_id) {
                throw new Error('File upload failed');
            }

            this.currentFileId = uploadData.file_id;
            await api.analyzeDocument(this.currentFileId);
            
            this.updateLoadingMessage('Processing document...');
            setTimeout(() => this.fetchDocumentData(), 2000);
        } catch (error) {
            console.error('Error:', error);
            this.hideLoading();
            alert('An error occurred while uploading the file.');
        }
    }

    async fetchDocumentData() {
        try {
            const data = await api.fetchDocumentData(this.currentFileId);
            this.hideLoading();
            this.onFileProcessed(data, this.currentFileId);
        } catch (error) {
            console.error('Error:', error);
            this.hideLoading();
            alert('An error occurred while fetching document data.');
        }
    }

    showLoading(message) {
        const { loadingMessage, loadingOverlay } = this.elements;
        loadingMessage.textContent = message || 'Loading...';
        loadingOverlay.classList.remove('hidden');
    }

    updateLoadingMessage(message) {
        this.elements.loadingMessage.textContent = message;
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }
}