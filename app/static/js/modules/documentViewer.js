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

        pageElement.innerHTML = `
            <div class="flex items-center">
                <div class="page-number font-semibold mr-1 text-indigo-600">P${page.page_number}</div>
                <div class="page-preview text-xs text-gray-500 truncate">${page.text.substring(0, 10)}...</div>
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
        return `
            <div class="relative mb-1 overflow-auto h-screen">
                <div class="absolute top-1 left-1 right-1 flex justify-between items-center z-10 bg-white bg-opacity-80 rounded p-1 text-xs">
                    <p class="text-gray-500 italic">PDF - ${this.documentData.pages.length} pages</p>
                    <a href="${this.documentData.download_url}" download class="text-indigo-600 hover:underline flex items-center">
                        <i class="fas fa-download mr-1"></i> Download
                    </a>
                </div>
                <div class="pdf-container h-screen">
                    <object data="${this.documentData.file_url}" 
                        type="application/pdf" width="100%" height="100%" class="border rounded h-screen">
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
}