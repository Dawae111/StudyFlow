import { api } from './api.js';

export class FileListHandler {
    constructor(elements, onFileSelected) {
        this.elements = elements;
        this.onFileSelected = onFileSelected;
        this.files = [];
        this.initializeEventListeners();
        this.loadFiles();
    }

    initializeEventListeners() {
        // Add any event listeners for the file list UI
    }

    async loadFiles() {
        try {
            const response = await api.listFiles();
            if (response.success) {
                this.files = response.files;
                this.renderFiles();
            } else {
                console.error('Failed to load files:', response.error);
            }
        } catch (error) {
            console.error('Error loading files:', error);
        }
    }

    renderFiles() {
        const fileList = this.elements.fileList;
        if (!fileList) return;

        // Clear existing content
        fileList.innerHTML = '';

        // Sort files by creation date (newest first)
        const sortedFiles = [...this.files].sort((a, b) => {
            return new Date(b.created) - new Date(a.created);
        });

        // Create file list items
        sortedFiles.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item p-4 border-b hover:bg-gray-50 cursor-pointer';
            fileItem.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <div>
                            <div class="font-medium text-gray-900">${file.name}</div>
                            <div class="text-sm text-gray-500">${new Date(file.created).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="text-sm text-gray-500">${file.extension.toUpperCase()}</div>
                </div>
            `;

            // Add click handler to load the file
            fileItem.addEventListener('click', () => {
                this.onFileSelected(file);
            });

            fileList.appendChild(fileItem);
        });
    }
} 