import { api } from './api.js';

export class DocumentViewer {
    constructor(elements) {
        this.elements = elements;
        this.currentPageId = 1;
        this.documentData = null;

        this.setupEventListeners();

        this.setupGlobalClipboardListener();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
    }

    renderDocument(documentData) {
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
        `;
        thumbnailsContainer.appendChild(controlsContainer);

        controlsContainer.querySelector('#add-page-btn').addEventListener('click', () => this.addNewPage());

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

        // FIX: Make sure we initialize the text-action buttons after the PDF is in the DOM
        this.setupToggleTextButton();
        this.setupTextActionButtons(); // CHANGED: Call it so the "Explain" etc. buttons work

        // Notify other components about the page change
        this.updateRightPanel();

        console.log(`DocumentViewer rendered page ${this.currentPageId}`);

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
        const totalPages = this.documentData.pages.length;
        const currentPage = page.page_number;
        const pdfUrl = `${this.documentData.file_url.split('#')[0]}#page=${page.page_number}`;

        return `
            <div class="relative mb-1 h-full">
                <div class="absolute top-1 left-1 right-1 flex justify-between items-center z-10 bg-white bg-opacity-80 rounded p-1 text-xs">
                    <p class="text-gray-500 italic">${pdfLabel} - ${this.documentData.pages.length} pages</p>
                    <a href="${this.documentData.download_url}" download class="text-indigo-600 hover:underline flex items-center">
                        <i class="fas fa-download mr-1"></i> Download
                    </a>
                </div>
                
                <div class="absolute top-1/2 left-0 right-0 flex justify-between items-center z-20 px-2 pointer-events-none">
                    <button id="prev-page-btn-big" class="px-3 py-3 bg-gray-800 bg-opacity-50 text-white rounded-full hover:bg-opacity-70 pointer-events-auto ${currentPage === 1 ? 'opacity-25 cursor-not-allowed' : ''}">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button id="next-page-btn-big" class="px-3 py-3 bg-gray-800 bg-opacity-50 text-white rounded-full hover:bg-opacity-70 pointer-events-auto ${currentPage === totalPages ? 'opacity-25 cursor-not-allowed' : ''}">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                
                <div class="pdf-container h-full">
                    <object id="pdf-viewer-object" data="${pdfUrl}" 
                        type="application/pdf" width="100%" height="100%" class="border rounded h-full">
                        <div class="p-4 bg-gray-100 rounded">
                            <p>It seems your browser doesn't support embedded PDFs.</p>
                            <a href="${pdfUrl}" target="_blank" class="text-indigo-600 hover:underline">
                                <i class="fas fa-external-link-alt mr-1"></i> Open PDF in new tab
                            </a>
                        </div>
                    </object>
                </div>
                
                <!-- Text Action Buttons Bar -->
                <div id="text-action-bar" class="absolute top-14 left-1 right-1 flex justify-center items-center z-20 bg-white bg-opacity-95 shadow-sm rounded p-2 text-xs">
                    <div class="flex items-center space-x-2">
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
                        <span id="selection-info" class="text-gray-500 text-xs"></span>
                    </div>
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
                    <button id="toggle-extracted-text" class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
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
        let id = null;
        if (this.documentData.document_id) {
            id = this.documentData.document_id;
        } else if (this.documentData.file_id) {
            id = this.documentData.file_id;
        } else if (this.documentData.id) {
            id = this.documentData.id;
        } else if (this.documentData.file_url) {
            const urlParts = this.documentData.file_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            if (fileName && fileName.includes('.')) {
                id = fileName.split('.')[0];
            }
        }

        if (id) {
            if (id.includes('\\') || id.includes('/')) {
                const parts = id.split(/[\\\/]/);
                id = parts[parts.length - 1];
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

                    const docId = this.getDocumentId();
                    if (!docId) {
                        throw new Error('Missing document ID in current document data.');
                    }

                    if (file.type.includes('pdf')) {
                        this.updateLoadingMessage('Processing PDF pages...');
                    } else if (file.type.includes('image')) {
                        this.updateLoadingMessage('Analyzing image content...');
                    }

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('documentId', docId);

                    const result = await api.addPage(formData);
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to add page - server returned an error');
                    }

                    const pagesAdded = result.pages_added || 1;
                    this.updateLoadingMessage(`Added ${pagesAdded} page(s). Refreshing view...`);

                    const newDocData = await api.fetchDocumentData(docId);
                    if (!newDocData || !newDocData.pages) {
                        throw new Error('Retrieved invalid document data after page addition.');
                    }

                    this.documentData = newDocData;

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
        // Omitted for brevity; unchanged from your version
    }

    updateLoadingMessage(message) {
        if (this.elements.loadingMessage) {
            this.elements.loadingMessage.textContent = message;
        }
    }

    navigateToPdfPage(pageNumber) {
        if (!this.documentData || this.documentData.file_type !== 'pdf') {
            return;
        }
        console.log(`Navigating to PDF page ${pageNumber}`);
        const pdfObject = this.elements.currentPageContent.querySelector('object');
        if (!pdfObject) {
            console.warn('PDF object not found in DOM');
            return;
        }
        const baseUrl = this.documentData.file_url.split('#')[0];
        const newUrl = `${baseUrl}#page=${pageNumber}`;

        pdfObject.data = newUrl;
        setTimeout(() => {
            if (pdfObject.data === newUrl) {
                pdfObject.data = '';
                setTimeout(() => {
                    pdfObject.data = newUrl;
                }, 50);
            }
        }, 100);
    }

    monitorPdfPageChange() {
        const pdfObject = document.getElementById('pdf-viewer-object');
        if (!pdfObject) return;

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
            if (objectData.includes('#page=')) {
                const hashPageMatch = objectData.match(/#page=(\d+)/);
                if (hashPageMatch && hashPageMatch[1]) {
                    const pdfPageNum = parseInt(hashPageMatch[1], 10);
                    if (pdfPageNum !== this.currentPageId) {
                        console.log(`PDF navigation detected to page ${pdfPageNum}`);
                        this.currentPageId = pdfPageNum;
                        this.updateRightPanel();
                        this.updateActiveThumbnail();
                        // Intentionally not re-rendering entire page
                    }
                }
            }
        }, 1000);
        this.pdfCheckInterval = checkInterval;
        document.addEventListener('pageChanged', () => {
            clearInterval(this.pdfCheckInterval);
        }, { once: true });
    }

    cleanupPdfMonitoring() {
        if (this.pdfCheckInterval) {
            clearInterval(this.pdfCheckInterval);
            this.pdfCheckInterval = null;
        }
    }

    setupTextActionButtons() {
        // Get the four buttons
        const explainButton = document.getElementById('explain-button');
        const discussButton = document.getElementById('discuss-button');
        const summarizeButton = document.getElementById('summarize-button');
        const clarifyButton = document.getElementById('clarify-button');
    
        if (!explainButton || !discussButton || !summarizeButton || !clarifyButton) {
            return; // no PDF or page loaded
        }
    
        // We can re-enable them so user can click
        [explainButton, discussButton, summarizeButton, clarifyButton].forEach(btn => {
            btn.disabled = false;
        });
    
        // Helper to actually do the copy:
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
            // Fallback to older document.execCommand approach
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = text;
            // Place it off-screen so it's not visible
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
        
    
        // For demonstration, let's say we always read user-selected text from the DOM
        // (If you prefer to "GET" from the server instead, you can do that.)
        function getUserSelectedText() {
            const selection = window.getSelection();
            return selection.toString().trim() || "";
        }
    
        // This function gets called by any of the 4 buttons
        const handleActionClick = async (actionName) => {
            // 1) Get the text the user has highlighted
            const selectedText = getUserSelectedText();
            // if (!selectedText) {
            //     alert("No text is selected in the document. Highlight something first!");
            //     return;
            // }
    
            // 2) "Press Ctrl+C" in spirit by programmatically copying
            await copyTextToClipboard(selectedText);
    
            // 3) Format the final text/prompt
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
    
            // 4) Insert it into the QA tab (just like your sendToQATab method)
            this.sendToQATab(prompt);
        };
    
        // Finally, hook each button to the handler
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
        const qaTabButton = document.getElementById('tab-qa');
        if (qaTabButton) {
            qaTabButton.click();
        } else {
            console.warn("QA tab button not found");
        }
        const questionInput = document.getElementById('question-input');
        if (questionInput) {
            questionInput.value = text;
            questionInput.focus();
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
}
