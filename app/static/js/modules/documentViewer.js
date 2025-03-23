import { api } from './api.js';

export class DocumentViewer {
    constructor(elements) {
        this.elements = elements;
        this.currentPageId = 1;
        this.documentData = null;
        this.pdfDocument = null;
        this.pdfPageRendering = false;
        this.pdfPagePending = null;
        this.pdfCurrentZoom = 1.0;

        this.setupEventListeners();

        this.setupGlobalClipboardListener();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));

        // Listen for summary updates from background processing
        document.addEventListener('summariesUpdated', (e) => {
            this.handleSummariesUpdated(e.detail.documentData);
        });
    }

    renderDocument(documentData) {
        // Clean up any existing PDF monitoring
        this.cleanupPdfMonitoring();

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
            this.navigateToPdfPage(page.page_number);
        });

        return pageElement;
    }

    handleKeyboardNavigation(e) {
        if (!this.documentData) return;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            if (this.currentPageId < this.documentData.pages.length) {
                this.currentPageId++;
                this.renderCurrentPage();
                this.updateActiveThumbnail();
                this.navigateToPdfPage(this.currentPageId);
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            if (this.currentPageId > 1) {
                this.currentPageId--;
                this.renderCurrentPage();
                this.updateActiveThumbnail();
                this.navigateToPdfPage(this.currentPageId);
            }
        }
    }

    updateActiveThumbnail() {
        document.querySelectorAll('.page-thumbnail').forEach(el => {
            el.classList.remove('bg-indigo-100', 'border-indigo-300');
            if (String(el.dataset.pageId) === String(this.currentPageId)) {
                el.classList.add('bg-indigo-100', 'border-indigo-300');
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    getCurrentPage() {
        return this.documentData.pages.find(p => String(p.page_number) === String(this.currentPageId));
    }

    renderCurrentPage() {
        const page = this.getCurrentPage();
        if (!page) return null;

        this.elements.currentPageContent.innerHTML = this.getPageContentHTML(page);

        if (this.documentData.file_type === 'pdf') {
            if (this.lastDocumentId !== this.getDocumentId()) {
                this.pdfDocument = null;
                this.lastDocumentId = this.getDocumentId();
            }
            
            setTimeout(() => {
                this.renderPdf(this.currentPageId);
                this.setupZoomControls();
            }, 100);
        }

        this.setupToggleTextButton();
        this.setupTextActionButtons();

        this.updateRightPanel();

        console.log(`DocumentViewer rendered page ${this.currentPageId}`);


        // Add an event listener for the PDF object if it's a PDF
        if (this.documentData.file_type === 'pdf') {
            this.monitorPdfPageChange();
        }

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
            <div class="overflow-auto h-full">
                <div class="text-sm whitespace-pre-wrap">${page.text}</div>
            </div>
            ${this.getPageIndicatorHTML()}
        `;
    }

    getImageContentHTML(page) {
        return `
            <div class="mb-2 overflow-auto h-full">
                <img src="${this.documentData.file_url}" class="max-w-full h-auto rounded" alt="Uploaded image">
            </div>
            ${this.getPageIndicatorHTML()}
        `;
    }

    getPDFContentHTML(page) {
        const isMergedPDF = this.documentData.is_merged || false;
        const pdfLabel = isMergedPDF ? 'Merged PDF' : 'PDF';
        const totalPages = this.documentData.pages.length;
        const currentPage = page.page_number;

        return `
            <div class="relative mb-1 h-full" id="pdf-container-wrapper">
                <div class="absolute top-1 left-1 right-1 flex justify-between items-center z-10 bg-white bg-opacity-80 rounded p-2 text-xs">
                    <!-- Left: PDF Info -->
                    <div class="flex-shrink-0">
                        <p class="text-gray-500 italic">${pdfLabel} - ${this.documentData.pages.length} pages</p>
                    </div>
                    
                    <!-- Center: Text Action Buttons -->
                    <div class="flex items-center space-x-2 flex-grow justify-center">
                        <button id="explain-button" class="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50" disabled>
                            <i class="fas fa-lightbulb mr-1"></i> Explain
                        </button>
                        <button id="discuss-button" class="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50" disabled>
                            <i class="fas fa-comments mr-1"></i> Discuss
                        </button>
                        <button id="summarize-button" class="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50" disabled>
                            <i class="fas fa-compress-alt mr-1"></i> Summarize
                        </button>
                        <button id="clarify-button" class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50" disabled>
                            <i class="fas fa-question-circle mr-1"></i> Clarify
                        </button>
                    </div>
                    
                    <!-- Right: Download Button -->
                    <div class="flex-shrink-0">
                        <a href="${this.documentData.download_url}" download class="text-indigo-600 hover:underline flex items-center">
                            <i class="fas fa-download mr-1"></i> Download
                        </a>
                    </div>
                </div>
                
                <!-- Pagination Controls - Center of screen -->
                <div class="absolute top-1/2 left-0 right-0 flex justify-between items-center z-20 px-2 pointer-events-none">
                    <button id="prev-page-btn-big" class="px-3 py-3 bg-gray-800 bg-opacity-50 text-white rounded-full hover:bg-opacity-70 pointer-events-auto ${currentPage === 1 ? 'opacity-25 cursor-not-allowed' : ''}">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button id="next-page-btn-big" class="px-3 py-3 bg-gray-800 bg-opacity-50 text-white rounded-full hover:bg-opacity-70 pointer-events-auto ${currentPage === totalPages ? 'opacity-25 cursor-not-allowed' : ''}">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                
                <div class="pdf-container h-screen relative pt-10">
                    <div id="pdf-loading" class="hidden">
                        <div class="flex items-center">
                            <div class="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-600 mr-2"></div>
                            <span>Loading PDF...</span>
                        </div>
                    </div>
                    <div id="pdf-viewer" class="h-full overflow-auto"></div>
                </div>
                
                <div class="absolute bottom-1 left-1 right-1 flex justify-between items-center z-20 bg-white bg-opacity-95 shadow-sm rounded p-2 text-xs">
                    <div class="flex items-center">
                        <button id="prev-page-btn" class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 mr-1 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span class="text-gray-700 mx-1">Page</span>
                        <select id="page-selector" class="bg-white border rounded px-2 py-1 text-xs">
                            ${Array.from({ length: totalPages }, (_, i) =>
                                `<option value="${i + 1}" ${i + 1 === currentPage ? 'selected' : ''}>
                                    ${i + 1}
                                </option>`
                            ).join('')}
                        </select>
                        <span class="text-gray-700 mx-1">of ${totalPages}</span>
                        <button id="next-page-btn" class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 ml-1 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button id="zoom-out-btn" class="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                            <i class="fas fa-search-minus"></i>
                        </button>
                        <span id="zoom-level">100%</span>
                        <button id="zoom-in-btn" class="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                            <i class="fas fa-search-plus"></i>
                        </button>
                        <button id="toggle-extracted-text" class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
                            <i class="fas fa-file-alt mr-1"></i> Show Text
                        </button>
                    </div>
                </div>
                
                <span id="selection-info" class="absolute top-12 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-75 px-2 py-1 rounded text-xs text-gray-500 hidden"></span>
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
            const prevPageBtn = document.getElementById('prev-page-btn');
            const nextPageBtn = document.getElementById('next-page-btn');
            const prevPageBtnBig = document.getElementById('prev-page-btn-big');
            const nextPageBtnBig = document.getElementById('next-page-btn-big');
            const pageSelector = document.getElementById('page-selector');

            if (toggleBtn && textContainer) {
                toggleBtn.addEventListener('click', () => {
                    const isHidden = textContainer.classList.contains('hidden');
                    textContainer.classList.toggle('hidden');
                    toggleBtn.innerHTML = isHidden
                        ? '<i class="fas fa-file-alt mr-1"></i> Hide Text'
                        : '<i class="fas fa-file-alt mr-1"></i> Show Text';
                });
            }

            const goToPrevPage = () => {
                if (this.currentPageId > 1) {
                    this.currentPageId--;
                    this.renderCurrentPage();
                    this.updateActiveThumbnail();
                    this.navigateToPdfPage(this.currentPageId);
                }
            };

            const goToNextPage = () => {
                if (this.currentPageId < this.documentData.pages.length) {
                    this.currentPageId++;
                    this.renderCurrentPage();
                    this.updateActiveThumbnail();
                    this.navigateToPdfPage(this.currentPageId);
                }
            };

            if (prevPageBtn) {
                prevPageBtn.addEventListener('click', goToPrevPage);
            }

            if (nextPageBtn) {
                nextPageBtn.addEventListener('click', goToNextPage);
            }

            if (prevPageBtnBig) {
                prevPageBtnBig.addEventListener('click', goToPrevPage);
            }

            if (nextPageBtnBig) {
                nextPageBtnBig.addEventListener('click', goToNextPage);
            }

            if (pageSelector) {
                pageSelector.addEventListener('change', () => {
                    const selectedPage = parseInt(pageSelector.value);
                    if (!isNaN(selectedPage) && selectedPage >= 1 && selectedPage <= this.documentData.pages.length) {
                        this.currentPageId = selectedPage;
                        this.renderCurrentPage();
                        this.updateActiveThumbnail();
                        this.navigateToPdfPage(selectedPage);
                    }
                });
            }
        }, 100);
    }

    updateRightPanel() {
        const page = this.getCurrentPage();
        if (!page) return;

        // Dispatch page changed event to notify other components
        const event = new CustomEvent('pageChanged', {
            detail: {
                page,
                pageId: String(this.currentPageId)
            }
        });
        document.dispatchEvent(event);
        console.log(`Dispatched pageChanged event for page ${this.currentPageId}`);
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

    // Add new method to navigate to a specific PDF page
    navigateToPdfPage(pageNumber) {
        if (!this.documentData || this.documentData.file_type !== 'pdf') {
            return; // Only apply to PDFs
        }

        console.log(`Navigating to PDF page ${pageNumber}`);

        // Get the PDF object element
        const pdfObject = this.elements.currentPageContent.querySelector('object');
        if (!pdfObject) {
            console.warn('PDF object not found in DOM');
            return;
        }

        // Create URL with page fragment
        const baseUrl = this.documentData.file_url.split('#')[0]; // Remove any existing fragments
        const newUrl = `${baseUrl}#page=${pageNumber}`;

        // Update the object data attribute to navigate to the page
        // We need to reload the object to force navigation
        pdfObject.data = newUrl;

        // If the above doesn't work consistently, try this alternate approach
        setTimeout(() => {
            // Sometimes we need to reload the object to force the browser to navigate
            if (pdfObject.data === newUrl) {
                pdfObject.data = '';
                setTimeout(() => {
                    pdfObject.data = newUrl;
                }, 50);
            }
        }, 100);
    }

    // Add a method to monitor PDF page changes made by the user directly in the PDF viewer
    monitorPdfPageChange() {
        // Since we're not using scroll detection, we'll only monitor for hash changes
        // from navigation initiated by our buttons
        const pdfObject = document.getElementById('pdf-viewer-object');
        if (!pdfObject) return;

        // We still monitor hash changes since they could come from our page navigation buttons
        const checkInterval = setInterval(() => {
            if (!this.documentData) {
                clearInterval(checkInterval);
                return;
            }

            const objectData = pdfObject.data;
            if (!objectData) {
                clearInterval(checkInterval);
                return;
            }

            // Extract page number from hash if present
            if (objectData.includes('#page=')) {
                const hashPageMatch = objectData.match(/#page=(\d+)/);
                if (hashPageMatch && hashPageMatch[1]) {
                    const pdfPageNum = parseInt(hashPageMatch[1], 10);

                    // Only update if it was initiated by our navigation buttons and doesn't match current page
                    if (pdfPageNum !== this.currentPageId) {
                        console.log(`PDF navigation detected to page ${pdfPageNum}`);
                        this.currentPageId = pdfPageNum;
                        this.updateRightPanel();
                        this.updateActiveThumbnail();
                        // Don't call renderCurrentPage() to avoid refreshing the PDF
                    }
                }
            }
        }, 1000); // Check every second

        // Store the interval ID so we can clear it if needed
        this.pdfCheckInterval = checkInterval;

        // Clear the interval when the page changes or component unloads
        document.addEventListener('pageChanged', () => {
            clearInterval(this.pdfCheckInterval);
        }, { once: true });
    }

    // Add cleanup method
    cleanupPdfMonitoring() {
        if (this.pdfCheckInterval) {
            clearInterval(this.pdfCheckInterval);
            this.pdfCheckInterval = null;
        }
        
        if (this.pdfDocument) {
        }
    }

    setupTextActionButtons() {
        const explainButton = document.getElementById('explain-button');
        const discussButton = document.getElementById('discuss-button');
        const summarizeButton = document.getElementById('summarize-button');
        const clarifyButton = document.getElementById('clarify-button');
    
        if (!explainButton || !discussButton || !summarizeButton || !clarifyButton) {
            return;
        }
    
        [explainButton, discussButton, summarizeButton, clarifyButton].forEach(btn => {
            btn.disabled = false;
        });
    
        async function copyTextToClipboard(text) {
            if (!text) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(text);
                    console.log("Copied using navigator.clipboard!");
                    return;
                } catch (e) {
                    console.warn("Could not copy with Clipboard API, falling back:", e);
                }
            }
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = text;
            tempTextArea.style.position = 'fixed';
            tempTextArea.style.left = '-99999px';
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            try {
                document.execCommand('copy');
                console.log("Copied using document.execCommand('copy') fallback!");
            } catch (err) {
                console.error("Fallback copy failed", err);
            }
            document.body.removeChild(tempTextArea);
        }
        
    
        function getUserSelectedText() {
            const selection = window.getSelection();
            return selection.toString().trim() || "";
        }
    
        const handleActionClick = async (actionName) => {
            const selectedText = getUserSelectedText();
    
            await copyTextToClipboard(selectedText);
    
            let prompt;
            switch (actionName) {
                case 'explain':
                    prompt = `Explain this:\n\n${selectedText}`;
                    break;
                case 'discuss':
                    prompt = `Discuss this:\n\n${selectedText}`;
                    break;
                case 'summarize':
                    prompt = `Summarize this:\n\n${selectedText}`;
                    break;
                case 'clarify':
                    prompt = `I need clarification on:\n\n${selectedText}`;
                    break;
                default:
                    prompt = selectedText;
            }
    
            this.sendToQATab(prompt);
        };
    
        explainButton.addEventListener('click', () => handleActionClick('explain'));
        discussButton.addEventListener('click', () => handleActionClick('discuss'));
        summarizeButton.addEventListener('click', () => handleActionClick('summarize'));
        clarifyButton.addEventListener('click', () => handleActionClick('clarify'));
    }

    sendToQATab(text) {
        console.log("sendToQATab called with text length:", text.length);
        if (!text.trim()) {
            console.warn('No text to send to QA tab');
            return;
        }

        // First, click the QA tab to switch to it
        const qaTabButton = document.getElementById('tab-qa');
        if (qaTabButton) {
            qaTabButton.click();
        } else {
            console.warn("QA tab button not found");
            return; // Exit early if we can't find the tab
        }

        // Set the text in the question input
        const questionInput = document.getElementById('question-input');
        if (questionInput) {
            questionInput.value = text;
            questionInput.focus();

            // Now automatically click the ask button
            const askButton = document.getElementById('ask-button');
            if (askButton) {
                // Use setTimeout to ensure UI is updated before clicking
                setTimeout(() => {
                    console.log("Auto-clicking Ask button");
                    askButton.click();
                }, 100);
            } else {
                console.warn("Ask button not found");
            }
        } else {
            console.warn("Question input element not found");
        }
    }

    setupGlobalClipboardListener() {
        console.log("Setting up global clipboard listener");
        document.addEventListener('copy', async (e) => {
            console.log("Copy event detected");
            const selectButton = document.getElementById('select-text-button');
            if (!selectButton || !selectButton.classList.contains('active')) {
                console.log("Not in selection mode, ignoring copy event");
                return;
            }

            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            console.log("Selected text length:", selectedText.length);

            if (!selectedText) {
                console.log("No text selected, ignoring copy event");
                return;
            }

            const statusContainer = document.getElementById('selection-status');
            if (statusContainer) {
                statusContainer.textContent = 'Sending text to server...';
            }

            try {
                const response = await fetch('/api/select-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'copy',
                        text: selectedText
                    })
                });

                if (!response.ok) throw new Error(`Server returned ${response.status}`);
                const data = await response.json();
                if (data.success) {
                    if (statusContainer) {
                        statusContainer.textContent = 'Text copied! Click the button again to send to Q&A';
                        statusContainer.classList.add('bg-green-100', 'text-green-800');
                        setTimeout(() => {
                            statusContainer.classList.remove('bg-green-100', 'text-green-800');
                            statusContainer.textContent = 'Select text in the PDF, then press Ctrl+C to copy';
                        }, 3000);
                    }
                    console.log('Text stored on server successfully.');
                }
            } catch (error) {
                console.error('Error sending text to server:', error);
                if (statusContainer) {
                    statusContainer.textContent = 'Error sending text to server';
                    statusContainer.classList.add('bg-red-100', 'text-red-800');
                    setTimeout(() => {
                        statusContainer.classList.remove('bg-red-100', 'text-red-800');
                        statusContainer.textContent = 'Select text in the PDF, then press Ctrl+C to copy';
                    }, 3000);
                }
            }
        });
    }

    async renderPdf(pageNumber) {
        if (!this.documentData || this.documentData.file_type !== 'pdf') {
            return;
        }
    
        const pdfContainer = document.getElementById('pdf-viewer');
        if (!pdfContainer) {
            console.error('PDF container not found');
            return;
        }
    
        const loadingIndicator = document.getElementById('pdf-loading');
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    
        pdfContainer.innerHTML = '';
    
        try {
            if (!this.pdfDocument) {
                const loadingTask = pdfjsLib.getDocument(this.documentData.file_url);
                this.pdfDocument = await loadingTask.promise;
                console.log(`PDF loaded with ${this.pdfDocument.numPages} pages`);
            }
    
            if (pageNumber < 1 || pageNumber > this.pdfDocument.numPages) {
                throw new Error(`Invalid page number: ${pageNumber}`);
            }
    
            if (this.pdfPageRendering) {
                this.pdfPagePending = pageNumber;
                return;
            }
    
            this.pdfPageRendering = true;
    
            const page = await this.pdfDocument.getPage(pageNumber);
    
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.dataset.pageNumber = pageNumber;
            pdfContainer.appendChild(pageContainer);
    
            const viewportOriginal = page.getViewport({ scale: 1.0 });
            const containerWidth = pdfContainer.clientWidth - 20;
            const containerHeight = pdfContainer.clientHeight - 60;
    
            // This calculation is correct and should be preserved
            const widthScale = containerWidth / viewportOriginal.width;
            const heightScale = containerHeight / viewportOriginal.height;
            const scale = Math.min(widthScale, heightScale) * this.pdfCurrentZoom;
    
            const viewport = page.getViewport({ scale });
    
            pageContainer.style.width = `${viewport.width}px`;
            pageContainer.style.height = `${viewport.height}px`;
    
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            pageContainer.appendChild(canvas);
    
            const context = canvas.getContext('2d');
            const outputScale = window.devicePixelRatio || 1;
    
            // Set physical canvas size to handle high-DPI
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
    
            // Set display size through CSS
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
    
            // FIXED: Don't apply the scale transformation twice
            // Remove either this transform array OR the context.scale call below
            const renderContext = {
                canvasContext: context,
                viewport,
                // transform: [outputScale, 0, 0, outputScale, 0, 0] // Remove this line
            };
    
            // Apply the pixel ratio scale to the context before rendering
            context.scale(outputScale, outputScale);
    
            const renderTask = page.render(renderContext);
    
            // 🎯 Improved Text Layer (Aligned with High-Res Scaling)
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'text-layer';
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
    
            pageContainer.appendChild(textLayerDiv);
    
            const textContent = await page.getTextContent();
            pdfjsLib.renderTextLayer({
                textContent,
                container: textLayerDiv,
                viewport,
                textDivs: [],
                enhanceTextSelection: true
            });
    
            await renderTask.promise;
    
            this.enableTextActionButtons();
    
            const zoomLevelEl = document.getElementById('zoom-level');
            if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(this.pdfCurrentZoom * 100)}%`;
    
            this.pdfPageRendering = false;
    
            if (this.pdfPagePending !== null) {
                const pendingPage = this.pdfPagePending;
                this.pdfPagePending = null;
                this.renderPdf(pendingPage);
            }
    
        } catch (error) {
            console.error('Error rendering PDF:', error);
            pdfContainer.innerHTML = `
                <div class="p-4 bg-red-100 text-red-700 rounded">
                    <p>Error loading PDF: ${error.message}</p>
                    <a href="${this.documentData.file_url}" target="_blank" class="text-indigo-600 hover:underline">
                        <i class="fas fa-external-link-alt mr-1"></i> Open PDF in new tab
                    </a>
                </div>
            `;
        } finally {
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
        }
    }
    

    enableTextActionButtons() {
        const actionButtons = [
            document.getElementById('explain-button'),
            document.getElementById('discuss-button'),
            document.getElementById('summarize-button'),
            document.getElementById('clarify-button')
        ];
        
        actionButtons.forEach(btn => {
            if (btn) btn.disabled = false;
        });
    }

    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.pdfCurrentZoom = Math.min(this.pdfCurrentZoom + 0.2, 3.0);
                this.renderPdf(this.currentPageId);
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.pdfCurrentZoom = Math.max(this.pdfCurrentZoom - 0.2, 0.5);
                this.renderPdf(this.currentPageId);
            });
        }
    }
}
