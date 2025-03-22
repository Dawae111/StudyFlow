import { FileUploadHandler } from './modules/fileUpload.js';
import { DocumentViewer } from './modules/documentViewer.js';
import { StudyTools } from './modules/studyTools.js';

// Declare these at the top of the file, outside any functions
let documentData = null;
let currentFileId = null;
let currentPageId = 1;

document.addEventListener('DOMContentLoaded', function () {
    const elements = {
        // File Upload elements
        dropArea: document.getElementById('drop-area'),
        fileInput: document.getElementById('file-input'),
        uploadSection: document.getElementById('upload-section'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingMessage: document.getElementById('loading-message'),

        // Document Viewer elements
        documentViewer: document.getElementById('document-viewer'),
        pageThumbnails: document.getElementById('page-thumbnails'),
        currentPageContent: document.getElementById('current-page-content'),

        // Study Tools elements
        summaryContent: document.getElementById('summary-content'),
        qaContent: document.getElementById('qa-content'),
        notesContent: document.getElementById('notes-content'),
        tabSummary: document.getElementById('tab-summary'),
        tabQA: document.getElementById('tab-qa'),
        tabNotes: document.getElementById('tab-notes'),
        questionInput: document.getElementById('question-input'),
        askButton: document.getElementById('ask-button'),
        qaHistory: document.getElementById('qa-history'),
        notesTextarea: document.getElementById('notes-textarea'),
        saveNotesButton: document.getElementById('save-notes')
    };

    const viewer = new DocumentViewer(elements);
    const studyTools = new StudyTools(elements);

    const fileHandler = new FileUploadHandler(elements, (documentData, fileId) => {
        elements.uploadSection.classList.add('hidden');
        elements.documentViewer.classList.remove('hidden');

        const currentPage = viewer.renderDocument(documentData);
        studyTools.setFileId(fileId);

        if (currentPage) {
            studyTools.updateContent(currentPage);
        }
    });

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
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Tab Switching
    tabSummary.addEventListener('click', () => switchTab('summary'));
    tabQA.addEventListener('click', () => switchTab('qa'));
    tabNotes.addEventListener('click', () => switchTab('notes'));

    // Q&A Functionality
    askButton.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        if (!question) return;

        // Add the question to the history
        const questionElement = document.createElement('div');
        questionElement.className = 'question-container p-4 bg-gray-50 rounded-lg';
        questionElement.innerHTML = `
            <p class="font-semibold">You: ${question}</p>
            <div class="answer mt-2">
                <p class="text-gray-500">Loading answer...</p>
            </div>
        `;
        qaHistory.appendChild(questionElement);

        // Clear the input
        questionInput.value = '';

        // Scroll to the bottom of the history
        qaHistory.scrollTop = qaHistory.scrollHeight;

        try {
            // Make API call to get the answer
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: question,
                    file_id: currentFileId,
                    page_id: currentPageId  // Include the current page ID
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get answer');
            }

            const data = await response.json();
            const answerElement = questionElement.querySelector('.answer');
            answerElement.innerHTML = `<p>${data.answer}</p>`;

        } catch (error) {
            console.error('Error asking question:', error);
            const answerElement = questionElement.querySelector('.answer');
            answerElement.innerHTML = `<p class="text-red-500">Error: Failed to get an answer. Please try again.</p>`;
        }
    });

    // Save Notes
    saveNotesButton.addEventListener('click', saveNotes);

    // Functions
    function handleFile(file) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a PDF or image file (JPEG, PNG).');
            return;
        }

        // Show loading overlay
        showLoading('Uploading and processing file...');

        // Create form data for file upload
        const formData = new FormData();
        formData.append('file', file);

        // Upload file
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Upload successful:', data);

                // Store the file ID for future API calls
                if (data.file_id) {
                    currentFileId = data.file_id;
                    console.log(`Set currentFileId to ${currentFileId}`);
                } else if (data.fileId) {
                    // Handle camelCase variant if that's what the server returns
                    currentFileId = data.fileId;
                    console.log(`Set currentFileId to ${currentFileId} (from fileId)`);
                } else {
                    console.error('No file_id or fileId found in response:', data);
                }

                // Reset the loading state
                fileInput.value = '';
                uploadSection.classList.remove('uploading');
                loadingOverlay.classList.remove('hidden');

                // Get and display document data
                fetchAndDisplayDocument(data.file_id || data.fileId);
            })
            .catch(error => {
                console.error('Error uploading file:', error);
                fileInput.value = '';
                uploadSection.classList.remove('uploading');

                // Show error message
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message p-4 bg-red-100 text-red-800 rounded-lg mb-4';
                errorMsg.textContent = 'Error uploading file. Please try again.';
                uploadSection.appendChild(errorMsg);

                // Remove error message after 5 seconds
                setTimeout(() => {
                    errorMsg.remove();
                }, 5000);
            });
    }

    function fetchDocumentData() {
        fetch(`/api/summaries/${currentFileId}`)
            .then(response => response.json())
            .then(data => {
                documentData = data;
                hideLoading();
                renderDocument();
                uploadSection.classList.add('hidden');
                documentViewer.classList.remove('hidden');
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoading();
                alert('An error occurred while fetching document data.');
            });
    }

    function renderDocument() {
        // Clear previous content
        pageThumbnails.innerHTML = '';

        // Container for thumbnails
        const thumbnailsContainer = document.createElement('div');
        thumbnailsContainer.className = 'thumbnails-container overflow-y-auto max-h-[calc(100vh-80px)]';
        pageThumbnails.appendChild(thumbnailsContainer);

        // Add page thumbnails
        documentData.pages.forEach(page => {
            const pageElement = document.createElement('div');
            pageElement.className = 'page-thumbnail p-1 mb-1 border rounded cursor-pointer hover:bg-gray-100 transition text-xs';
            pageElement.dataset.pageId = page.page_number;

            if (page.page_number === currentPageId) {
                pageElement.classList.add('bg-indigo-100', 'border-indigo-300');
            }

            pageElement.innerHTML = `
                <div class="flex items-center">
                    <div class="page-number font-semibold mr-1 text-indigo-600">P${page.page_number}</div>
                    <div class="page-preview text-xs text-gray-500 truncate">${page.text.substring(0, 10)}...</div>
                </div>
            `;

            pageElement.addEventListener('click', () => {
                // Update current page ID
                currentPageId = parseInt(page.page_number);
                console.log(`Clicked on page ${currentPageId}`);

                // For PDFs, scroll to the page
                if (documentData.file_type === 'pdf') {
                    const pdfObject = currentPageContent.querySelector('.pdf-container object');
                    if (pdfObject) {
                        // Try to scroll to the page
                        try {
                            const scrollPercent = (currentPageId - 1) / (documentData.pages.length - 1);
                            const scrollableHeight = currentPageContent.scrollHeight - currentPageContent.clientHeight;
                            currentPageContent.scrollTop = scrollPercent * scrollableHeight;
                            console.log(`Scrolled to ${scrollPercent * 100}% of content`);
                        } catch (e) {
                            console.error("Error scrolling to page:", e);
                        }
                    } else {
                        // If can't scroll, re-render the current page
                        renderCurrentPage();
                    }
                } else {
                    // For non-PDFs, re-render the page
                    renderCurrentPage();
                }

                // Always update the right panel and active thumbnail
                updateRightPanel();
                updateActiveThumbnail();
            });

            thumbnailsContainer.appendChild(pageElement);
        });

        // Add keyboard navigation and scroll handling for pages
        document.addEventListener('keydown', handleKeyboardNavigation);

        // Add scroll event listener for PDF container
        currentPageContent.addEventListener('scroll', handleDocumentScroll);

        // Render first page by default
        renderCurrentPage();
    }

    function handleDocumentScroll(e) {
        // Only handle if document is loaded and it's a PDF with multiple pages
        if (!documentData || documentData.pages.length <= 1 ||
            documentData.file_type !== 'pdf' || !currentPageContent.querySelector('.pdf-container')) {
            return;
        }

        // Get all visible page elements in the PDF container
        const pdfContainer = currentPageContent.querySelector('.pdf-container');
        const containerHeight = pdfContainer.clientHeight;
        const scrollTop = currentPageContent.scrollTop;
        const scrollPosition = scrollTop / (pdfContainer.scrollHeight - containerHeight);

        // Calculate which page should be visible based on scroll position
        const totalPages = documentData.pages.length;
        const newPageId = Math.max(1, Math.min(totalPages, Math.ceil(scrollPosition * totalPages)));

        // Update current page if changed
        if (newPageId !== currentPageId) {
            currentPageId = newPageId;
            // Update the right panel without re-rendering the PDF
            updateRightPanel();
            updateActiveThumbnail();
        }
    }

    function updateRightPanel() {
        const page = documentData.pages.find(p => p.page_number === currentPageId);
        if (!page) return;

        // Update summary
        summaryContent.innerHTML = `
            <div class="p-4 bg-indigo-50 rounded-lg">
                <h4 class="font-semibold mb-2">Summary for Page ${page.page_number}</h4>
                <p>${page.summary}</p>
            </div>
        `;

        // Update notes
        notesTextarea.value = page.notes || '';
    }

    function renderCurrentPage() {
        const page = documentData.pages.find(p => p.page_number === currentPageId);

        if (!page) return;

        // Render page content
        if (documentData.file_type && documentData.file_url) {
            if (['jpg', 'jpeg', 'png'].includes(documentData.file_type.toLowerCase())) {
                // For images, show the image as the main content
                currentPageContent.innerHTML = `
                    <div class="mb-2 overflow-auto max-h-[calc(100vh-90px)]">
                        <img src="${documentData.file_url}" class="max-w-full h-auto rounded" alt="Uploaded image">
                    </div>
                `;
            } else if (documentData.file_type.toLowerCase() === 'pdf') {
                // For PDFs, embed a PDF viewer with options
                currentPageContent.innerHTML = `
                    <div class="relative mb-1 overflow-auto max-h-[calc(100vh-60px)]">
                        <div class="absolute top-1 left-1 right-1 flex justify-between items-center z-10 bg-white bg-opacity-80 rounded p-1 text-xs">
                            <p class="text-gray-500 italic">PDF - ${documentData.pages.length} pages</p>
                            <a href="${documentData.download_url}" download class="text-indigo-600 hover:underline flex items-center">
                                <i class="fas fa-download mr-1"></i> Download
                            </a>
                        </div>
                        <div class="pdf-container h-[calc(100vh-65px)]">
                            <object data="${documentData.file_url}" 
                                type="application/pdf" width="100%" height="100%" class="border rounded">
                                <div class="p-4 bg-gray-100 rounded">
                                    <p>It seems your browser doesn't support embedded PDFs.</p>
                                    <a href="${documentData.file_url}" target="_blank" class="text-indigo-600 hover:underline">
                                        <i class="fas fa-external-link-alt mr-1"></i> Open PDF in new tab
                                    </a>
                                </div>
                            </object>
                        </div>
                        <div class="absolute bottom-1 left-1 right-1 flex justify-between items-center z-10 bg-white bg-opacity-80 rounded p-1 text-xs">
                            <span class="text-gray-500">Page ${page.page_number} of ${documentData.pages.length}</span>
                            <button id="toggle-extracted-text" class="px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                                <i class="fas fa-file-alt mr-1"></i> Show Text
                            </button>
                        </div>
                    </div>
                    <div id="extracted-text-container" class="mt-1 p-2 border rounded text-xs whitespace-pre-wrap bg-gray-50 hidden max-h-[20vh] overflow-auto">
                        ${page.text}
                    </div>
                `;

                // Add event listener for toggle button
                setTimeout(() => {
                    const toggleBtn = document.getElementById('toggle-extracted-text');
                    const textContainer = document.getElementById('extracted-text-container');

                    if (toggleBtn && textContainer) {
                        toggleBtn.addEventListener('click', () => {
                            if (textContainer.classList.contains('hidden')) {
                                textContainer.classList.remove('hidden');
                                toggleBtn.innerHTML = '<i class="fas fa-file-alt mr-1"></i> Hide Text';
                            } else {
                                textContainer.classList.add('hidden');
                                toggleBtn.innerHTML = '<i class="fas fa-file-alt mr-1"></i> Show Text';
                            }
                        });
                    }
                }, 100);
            } else {
                // Fallback for other file types
                currentPageContent.innerHTML = `
                    <div class="overflow-auto max-h-[calc(100vh-90px)]">
                        <p class="text-gray-500 italic mb-2">Unsupported File Type</p>
                    <div class="text-sm whitespace-pre-wrap">${page.text}</div>
                    </div>
                `;
            }
        } else {
            // No file info, just show text
            currentPageContent.innerHTML = `
                <div class="overflow-auto max-h-[calc(100vh-90px)]">
                <div class="text-sm whitespace-pre-wrap">${page.text}</div>
                </div>
            `;
        }

        // Update page indicator
        if (!documentData.file_type || documentData.file_type.toLowerCase() !== 'pdf') {
            const pageIndicator = document.createElement('div');
            pageIndicator.className = 'text-center text-xs text-gray-500 mt-1';
            pageIndicator.textContent = `Page ${page.page_number} of ${documentData.pages.length}`;
            currentPageContent.appendChild(pageIndicator);
        }

        // Update right panel
        updateRightPanel();
    }

    function switchTab(tab) {
        // Hide all content
        summaryContent.classList.add('hidden');
        qaContent.classList.add('hidden');
        notesContent.classList.add('hidden');

        // Reset tab styles
        tabSummary.classList.remove('bg-indigo-600', 'text-white');
        tabQA.classList.remove('bg-indigo-600', 'text-white');
        tabNotes.classList.remove('bg-indigo-600', 'text-white');

        tabSummary.classList.add('bg-gray-200', 'text-gray-700');
        tabQA.classList.add('bg-gray-200', 'text-gray-700');
        tabNotes.classList.add('bg-gray-200', 'text-gray-700');

        // Show selected content and highlight tab
        if (tab === 'summary') {
            summaryContent.classList.remove('hidden');
            tabSummary.classList.remove('bg-gray-200', 'text-gray-700');
            tabSummary.classList.add('bg-indigo-600', 'text-white');
        } else if (tab === 'qa') {
            qaContent.classList.remove('hidden');
            tabQA.classList.remove('bg-gray-200', 'text-gray-700');
            tabQA.classList.add('bg-indigo-600', 'text-white');
        } else if (tab === 'notes') {
            notesContent.classList.remove('hidden');
            tabNotes.classList.remove('bg-gray-200', 'text-gray-700');
            tabNotes.classList.add('bg-indigo-600', 'text-white');
        }
    }

    function saveNotes() {
        const notes = notesTextarea.value.trim();

        // Update locally
        const page = documentData.pages.find(p => p.page_number === currentPageId);
        if (page) {
            page.notes = notes;
        }

        // Save to server
        fetch(`/api/notes/${currentPageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userNotes: notes
            })
        })
            .then(response => response.json())
            .then(data => {
                // Show success message
                const saveBtn = saveNotesButton;
                const originalText = saveBtn.textContent;

                saveBtn.textContent = 'Saved!';
                saveBtn.classList.add('bg-green-600');

                setTimeout(() => {
                    saveBtn.textContent = originalText;
                    saveBtn.classList.remove('bg-green-600');
                }, 2000);
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while saving your notes.');
            });
    }

    function showLoading(message) {
        loadingMessage.textContent = message || 'Loading...';
        loadingOverlay.classList.remove('hidden');
    }

    function updateLoadingMessage(message) {
        loadingMessage.textContent = message;
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function updateActiveThumbnail() {
        // Update active page thumbnail
        document.querySelectorAll('.page-thumbnail').forEach(el => {
            el.classList.remove('bg-indigo-100', 'border-indigo-300');
            if (parseInt(el.dataset.pageId) === currentPageId) {
                el.classList.add('bg-indigo-100', 'border-indigo-300');
                // Scroll the thumbnail into view if needed
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    function handleKeyboardNavigation(e) {
        // Only handle if document is loaded
        if (!documentData) return;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            // Next page
            if (currentPageId < documentData.pages.length) {
                currentPageId++;
                renderCurrentPage();
                updateActiveThumbnail();
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            // Previous page
            if (currentPageId > 1) {
                currentPageId--;
                renderCurrentPage();
                updateActiveThumbnail();
            }
        }
    }
}); 
