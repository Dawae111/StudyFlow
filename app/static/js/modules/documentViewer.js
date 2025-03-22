import { api } from './api.js';

export class DocumentViewer {
    constructor(elements) {
        this.elements = elements;
        this.currentPageId = 1;
        this.documentData = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
        this.elements.currentPageContent.addEventListener('scroll', (e) => this.handleDocumentScroll(e));
    }

    renderDocument(documentData) {
        this.documentData = documentData;
        this.renderThumbnails();
        return this.renderCurrentPage();
    }

    renderThumbnails() {
        const { pageThumbnails } = this.elements;
        pageThumbnails.innerHTML = '';

        const thumbnailsContainer = document.createElement('div');
        thumbnailsContainer.className = 'thumbnails-container overflow-y-auto max-h-[calc(100vh-80px)]';
        pageThumbnails.appendChild(thumbnailsContainer);

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'thumbnails-controls p-1 mb-2 flex justify-between items-center';
        controlsContainer.innerHTML = `
            <button id="add-page-btn" class="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                <i class="fas fa-plus mr-1"></i> Add Page
            </button>
            <!-- 
            <button id="remove-page-btn" class="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">
                <i class="fas fa-trash mr-1"></i> Remove Page
            </button>
            -->
        `;
        thumbnailsContainer.appendChild(controlsContainer);

        controlsContainer.querySelector('#add-page-btn').addEventListener('click', () => this.addNewPage());
        // Comment out the event listener for remove button
        // controlsContainer.querySelector('#remove-page-btn').addEventListener('click', () => this.removeCurrentPage());

        this.documentData.pages.forEach(page => {
            const pageElement = this.createThumbnail(page);
            thumbnailsContainer.appendChild(pageElement);
        });
    }

    createThumbnail(page) {
        const pageElement = document.createElement('div');
        pageElement.className = 'page-thumbnail p-1 mb-1 border rounded cursor-pointer hover:bg-gray-100 transition text-xs';
        pageElement.dataset.pageId = page.page_number;

        if (page.page_number === this.currentPageId) {
            pageElement.classList.add('bg-indigo-100', 'border-indigo-300');
        }

        // Calculate preview text
        const previewText = page.text ? page.text.substring(0, 10) + '...' : 'No text';

        // Create a more informative thumbnail
        pageElement.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <div class="page-number font-semibold mr-1 text-indigo-600">P${page.page_number}</div>
                    <div class="page-preview text-xs text-gray-500 truncate">${previewText}</div>
                </div>
            </div>
            <div class="text-xs text-gray-400 mt-1">
                ${page.source ? `Source: ${page.source}` : ''}
                ${page.word_count ? `Words: ${page.word_count}` : ''}
            </div>
        `;

        pageElement.addEventListener('click', () => {
            this.currentPageId = page.page_number;
            this.renderCurrentPage();
            this.updateActiveThumbnail();
        });

        return pageElement;
    }

    handleDocumentScroll(e) {
        if (!this.documentData || this.documentData.pages.length <= 1 ||
            this.documentData.file_type !== 'pdf' || !this.elements.currentPageContent.querySelector('.pdf-container')) {
            return;
        }

        const pdfContainer = this.elements.currentPageContent.querySelector('.pdf-container');
        const containerHeight = pdfContainer.clientHeight;
        const scrollTop = this.elements.currentPageContent.scrollTop;
        const scrollPosition = scrollTop / (pdfContainer.scrollHeight - containerHeight);

        const totalPages = this.documentData.pages.length;
        const newPageId = Math.max(1, Math.min(totalPages, Math.ceil(scrollPosition * totalPages)));

        if (newPageId !== this.currentPageId) {
            this.currentPageId = newPageId;
            this.updateRightPanel();
            this.updateActiveThumbnail();
        }
    }

    handleKeyboardNavigation(e) {
        if (!this.documentData) return;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            if (this.currentPageId < this.documentData.pages.length) {
                this.currentPageId++;
                this.renderCurrentPage();
                this.updateActiveThumbnail();
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            if (this.currentPageId > 1) {
                this.currentPageId--;
                this.renderCurrentPage();
                this.updateActiveThumbnail();
            }
        }
    }

    updateActiveThumbnail() {
        document.querySelectorAll('.page-thumbnail').forEach(el => {
            el.classList.remove('bg-indigo-100', 'border-indigo-300');
            if (parseInt(el.dataset.pageId) === this.currentPageId) {
                el.classList.add('bg-indigo-100', 'border-indigo-300');
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    getCurrentPage() {
        return this.documentData.pages.find(p => p.page_number === this.currentPageId);
    }

    renderCurrentPage() {
        const page = this.getCurrentPage();
        if (!page) return null;

        this.elements.currentPageContent.innerHTML = this.getPageContentHTML(page);
        this.setupToggleTextButton();
        return page;
    }

    getPageContentHTML(page) {
        if (!this.documentData.file_type || !this.documentData.file_url) {
            return this.getDefaultContentHTML(page);
        }

        const fileType = this.documentData.file_type.toLowerCase();
        if (['jpg', 'jpeg', 'png'].includes(fileType)) {
            return this.getImageContentHTML(page);
        } else if (fileType === 'pdf') {
            return this.getPDFContentHTML(page);
        }

        return this.getDefaultContentHTML(page);
    }

    getDefaultContentHTML(page) {
        return `
            <div class="overflow-auto h-screen">
                <div class="text-sm whitespace-pre-wrap">${page.text}</div>
            </div>
            ${this.getPageIndicatorHTML()}
        `;
    }

    getImageContentHTML(page) {
        return `
            <div class="mb-2 overflow-auto h-screen">
                <img src="${this.documentData.file_url}" class="max-w-full h-auto rounded" alt="Uploaded image">
            </div>
            ${this.getPageIndicatorHTML()}
        `;
    }

    getPDFContentHTML(page) {
        const isMergedPDF = this.documentData.is_merged || false;
        const pdfLabel = isMergedPDF ? 'Merged PDF' : 'PDF';

        return `
            <div class="relative mb-1 overflow-auto h-full">
                <div class="absolute top-1 left-1 right-1 flex justify-between items-center z-10 bg-white bg-opacity-80 rounded p-1 text-xs">
                    <p class="text-gray-500 italic">${pdfLabel} - ${this.documentData.pages.length} pages</p>
                    <a href="${this.documentData.download_url}" download class="text-indigo-600 hover:underline flex items-center">
                        <i class="fas fa-download mr-1"></i> Download
                    </a>
                </div>
                <div class="pdf-container h-full">
                    <object data="${this.documentData.file_url}" 
                        type="application/pdf" width="100%" height="100%" class="border rounded h-full">
                        <div class="p-4 bg-gray-100 rounded">
                            <p>It seems your browser doesn't support embedded PDFs.</p>
                            <a href="${this.documentData.file_url}" target="_blank" class="text-indigo-600 hover:underline">
                                <i class="fas fa-external-link-alt mr-1"></i> Open PDF in new tab
                            </a>
                        </div>
                    </object>
                </div>
                <div class="absolute bottom-1 left-1 right-1 flex justify-between items-center z-10 bg-white bg-opacity-80 rounded p-1 text-xs">
                    <span class="text-gray-500">Page ${page.page_number} of ${this.documentData.pages.length}</span>
                    <button id="toggle-extracted-text" class="px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                        <i class="fas fa-file-alt mr-1"></i> Show Text
                    </button>
                </div>
            </div>
            <div id="extracted-text-container" class="mt-1 p-2 border rounded text-xs whitespace-pre-wrap bg-gray-50 hidden max-h-[20vh] overflow-auto">
                ${page.text}
            </div>
        `;
    }

    getPageIndicatorHTML() {
        if (!this.documentData.file_type || this.documentData.file_type.toLowerCase() === 'pdf') {
            return '';
        }
        return `
            <div class="text-center text-xs text-gray-500 mt-1">
                Page ${this.currentPageId} of ${this.documentData.pages.length}
            </div>
        `;
    }

    setupToggleTextButton() {
        setTimeout(() => {
            const toggleBtn = document.getElementById('toggle-extracted-text');
            const textContainer = document.getElementById('extracted-text-container');

            if (toggleBtn && textContainer) {
                toggleBtn.addEventListener('click', () => {
                    const isHidden = textContainer.classList.contains('hidden');
                    textContainer.classList.toggle('hidden');
                    toggleBtn.innerHTML = isHidden ?
                        '<i class="fas fa-file-alt mr-1"></i> Hide Text' :
                        '<i class="fas fa-file-alt mr-1"></i> Show Text';
                });
            }
        }, 100);
    }

    updateRightPanel() {
        const page = this.getCurrentPage();
        if (!page) return;

        const event = new CustomEvent('pageChanged', { detail: { page } });
        document.dispatchEvent(event);
    }

    getDocumentId() {
        // If found an ID, sanitize it to remove path components and invalid URL characters
        let id = null;

        // Try each potential ID source
        if (this.documentData.document_id) {
            id = this.documentData.document_id;
        } else if (this.documentData.file_id) {
            id = this.documentData.file_id;
        } else if (this.documentData.id) {
            id = this.documentData.id;
        } else if (this.documentData.file_url) {
            // Try to extract from URL
            const urlParts = this.documentData.file_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            if (fileName && fileName.includes('.')) {
                id = fileName.split('.')[0];
            }
        }

        // If we found an ID, sanitize it
        if (id) {
            // Remove any path components, keeping only the filename part
            if (id.includes('\\') || id.includes('/')) {
                console.log("Sanitizing ID with path separators:", id);
                // Get just the last part after any slash or backslash
                const parts = id.split(/[\\\/]/);
                id = parts[parts.length - 1];
                console.log("Sanitized ID:", id);
            }

            return id;
        }

        console.error("Could not find document ID in:", this.documentData);
        return null;
    }

    async addNewPage() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/pdf,image/jpeg,image/png,image/jpg';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', async (e) => {
            if (fileInput.files.length) {
                const file = fileInput.files[0];
                try {
                    if (this.elements.loadingOverlay && this.elements.loadingMessage) {
                        this.elements.loadingOverlay.classList.remove('hidden');
                        this.elements.loadingMessage.textContent = 'Adding new page...';
                    }

                    // Get the document ID
                    const docId = this.getDocumentId();
                    console.log("Using document ID for add page:", docId);

                    if (!docId) {
                        console.error("Document data:", this.documentData);
                        throw new Error('Missing document ID in current document data. Check console for details.');
                    }

                    // Update the loading message to be more descriptive based on file type
                    if (file.type.includes('pdf')) {
                        this.updateLoadingMessage('Processing PDF pages...');
                    } else if (file.type.includes('image')) {
                        this.updateLoadingMessage('Analyzing image content...');
                    }

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('documentId', docId);

                    console.log("📤 Sending request to /api/add-page with documentId:", docId);
                    console.log("📤 File being uploaded:", file.name, "Size:", file.size, "Type:", file.type);

                    // Make the API request
                    const result = await api.addPage(formData);
                    console.log("📥 API Response:", result);

                    if (!result.success) {
                        throw new Error(result.error || 'Failed to add page - server returned an error');
                    }

                    // Show pages added in loading message
                    const pagesAdded = result.pages_added || 1;
                    this.updateLoadingMessage(`Added ${pagesAdded} page(s). Refreshing view...`);

                    // Fetch the updated document data
                    console.log("Fetching updated document data for ID:", docId);
                    const newDocData = await api.fetchDocumentData(docId);

                    console.log("Received updated document data:", newDocData);

                    if (!newDocData || !newDocData.pages) {
                        throw new Error('Retrieved invalid document data after page addition. Check server logs.');
                    }

                    this.documentData = newDocData;

                    // Go to the newly added page
                    this.currentPageId = this.documentData.pages.length;
                    this.renderThumbnails();
                    this.renderCurrentPage();

                    alert(`New content added successfully! Added ${pagesAdded} page(s).`);
                } catch (error) {
                    console.error("🚨 Error adding page:", error);
                    alert("Failed to add new page: " + error.message);
                } finally {
                    if (this.elements.loadingOverlay) {
                        this.elements.loadingOverlay.classList.add('hidden');
                    }
                    document.body.removeChild(fileInput);
                }
            }
        });

        fileInput.click();
    }

    removeCurrentPage() {
        if (!this.documentData || this.documentData.pages.length <= 1) {
            alert('Cannot remove the only page in the document.');
            return;
        }

        if (!confirm(`Are you sure you want to remove page ${this.currentPageId}?`)) {
            return;
        }

        const docId = this.getDocumentId();
        if (!docId) {
            alert('Cannot remove page: Missing document ID');
            return;
        }

        console.log("Removing page from document ID:", docId);

        api.removePage(docId, this.currentPageId)
            .then(result => {
                if (result.success) {
                    this.documentData.pages = this.documentData.pages.filter(p => p.page_number !== this.currentPageId);

                    this.documentData.pages.forEach((page, idx) => {
                        page.page_number = idx + 1;
                    });

                    if (this.currentPageId > this.documentData.pages.length) {
                        this.currentPageId = this.documentData.pages.length;
                    }

                    this.renderThumbnails();
                    this.renderCurrentPage();

                    alert('Page removed successfully!');
                } else {
                    throw new Error(result.message || 'Failed to remove page');
                }
            })
            .catch(error => {
                console.error('Error removing page:', error);
                alert('Failed to remove page: ' + error.message);
            });
    }

    // Add this helper method
    updateLoadingMessage(message) {
        if (this.elements.loadingMessage) {
            this.elements.loadingMessage.textContent = message;
        }
    }
}