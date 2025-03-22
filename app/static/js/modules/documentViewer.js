export class DocumentViewer {
    constructor(elements) {
        this.elements = elements;
        this.currentPageId = 1;
        this.documentData = null;
    }

    renderDocument(documentData) {
        this.documentData = documentData;
        this.elements.pageThumbnails.innerHTML = '';
        
        if (documentData.pages.length > 1) {
            this.addNavigationControls();
        }
        
        this.addPageThumbnails();
        return this.renderCurrentPage();
    }

    addNavigationControls() {
        const navControls = document.createElement('div');
        navControls.className = 'flex justify-between items-center mb-4 pb-2 border-b';
        navControls.innerHTML = this.getNavigationHTML();
        this.elements.pageThumbnails.appendChild(navControls);
        this.setupNavigationListeners(navControls);
    }

    getNavigationHTML() {
        return `
            <div class="text-gray-700">Total Pages: ${this.documentData.pages.length}</div>
            <div class="flex space-x-2">
                <button id="prev-page" class="px-3 py-1 bg-indigo-600 text-white rounded-md disabled:bg-gray-400" 
                    ${this.currentPageId === 1 ? 'disabled' : ''}>Previous</button>
                <button id="next-page" class="px-3 py-1 bg-indigo-600 text-white rounded-md disabled:bg-gray-400" 
                    ${this.currentPageId === this.documentData.pages.length ? 'disabled' : ''}>Next</button>
            </div>
        `;
    }

    setupNavigationListeners(navControls) {
        navControls.querySelector('#prev-page').addEventListener('click', () => {
            if (this.currentPageId > 1) {
                this.currentPageId--;
                this.renderCurrentPage();
                this.updateNavigationControls();
            }
        });

        navControls.querySelector('#next-page').addEventListener('click', () => {
            if (this.currentPageId < this.documentData.pages.length) {
                this.currentPageId++;
                this.renderCurrentPage();
                this.updateNavigationControls();
            }
        });
    }

    addPageThumbnails() {
        this.documentData.pages.forEach(page => {
            const pageElement = this.createPageThumbnail(page);
            this.elements.pageThumbnails.appendChild(pageElement);
        });
    }

    createPageThumbnail(page) {
        const pageElement = document.createElement('div');
        pageElement.className = 'page-thumbnail p-2 border rounded cursor-pointer hover:bg-gray-100';
        pageElement.dataset.pageId = page.page_number;

        if (page.page_number === this.currentPageId) {
            pageElement.classList.add('bg-indigo-100', 'border-indigo-300');
        }

        pageElement.innerHTML = `
            <div class="flex items-center">
                <div class="page-number font-semibold mr-2">Page ${page.page_number}</div>
                <div class="page-preview text-sm text-gray-500 truncate">${page.text.substring(0, 30)}...</div>
            </div>
        `;

        pageElement.addEventListener('click', () => this.handlePageClick(page, pageElement));
        return pageElement;
    }

    handlePageClick(page, pageElement) {
        this.currentPageId = page.page_number;
        this.renderCurrentPage();

        document.querySelectorAll('.page-thumbnail').forEach(el => {
            el.classList.remove('bg-indigo-100', 'border-indigo-300');
        });
        pageElement.classList.add('bg-indigo-100', 'border-indigo-300');

        this.updateNavigationControls();
    }

    updateNavigationControls() {
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');

        if (prevButton) prevButton.disabled = this.currentPageId === 1;
        if (nextButton) nextButton.disabled = this.currentPageId === this.documentData.pages.length;
    }

    renderCurrentPage() {
        const page = this.documentData.pages.find(p => p.page_number === this.currentPageId);
        if (!page) return null;

        this.elements.currentPageContent.innerHTML = this.getPageContentHTML(page);
        return page;
    }

    getPageContentHTML(page) {
        if (!this.documentData.file_type || !this.documentData.file_url) {
            return `<div class="text-sm whitespace-pre-wrap">${page.text}</div>`;
        }

        const fileType = this.documentData.file_type.toLowerCase();
        if (['jpg', 'jpeg', 'png'].includes(fileType)) {
            return this.getImageContentHTML(page);
        } else if (fileType === 'pdf') {
            return this.getPDFContentHTML(page);
        }

        return `<div class="text-sm whitespace-pre-wrap">${page.text}</div>`;
    }

    getImageContentHTML(page) {
        return `
            <div class="mb-4">
                <img src="${this.documentData.file_url}" class="max-w-full h-auto rounded" alt="Uploaded image">
            </div>
            <div class="text-sm whitespace-pre-wrap">${page.text}</div>
        `;
    }

    getPDFContentHTML(page) {
        return `
            <div class="mb-4">
                <p class="text-gray-500 italic">PDF page ${page.page_number}</p>
                <a href="${this.documentData.file_url}" target="_blank" class="text-indigo-600 hover:underline">View original PDF</a>
            </div>
            <div class="text-sm whitespace-pre-wrap">${page.text}</div>
        `;
    }
}