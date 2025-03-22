document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadSection = document.getElementById('upload-section');
    const documentViewer = document.getElementById('document-viewer');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    const pageThumbnails = document.getElementById('page-thumbnails');
    const currentPageContent = document.getElementById('current-page-content');
    const summaryContent = document.getElementById('summary-content');
    const qaContent = document.getElementById('qa-content');
    const notesContent = document.getElementById('notes-content');
    const tabSummary = document.getElementById('tab-summary');
    const tabQA = document.getElementById('tab-qa');
    const tabNotes = document.getElementById('tab-notes');
    const questionInput = document.getElementById('question-input');
    const askButton = document.getElementById('ask-button');
    const qaHistory = document.getElementById('qa-history');
    const notesTextarea = document.getElementById('notes-textarea');
    const saveNotesButton = document.getElementById('save-notes');

    // Current state
    let currentFileId = null;
    let currentPageId = 1;
    let documentData = null;

    // Event Listeners for file upload
    dropArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', function () {
        if (this.files.length) {
            handleFile(this.files[0]);
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
    askButton.addEventListener('click', askQuestion);
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') askQuestion();
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
            .then(response => response.json())
            .then(data => {
                if (data.file_id) {
                    currentFileId = data.file_id;
                    // Trigger analysis (in a real app, this might be handled by the server)
                    return fetch(`/api/analyze/${currentFileId}`, {
                        method: 'POST'
                    });
                } else {
                    throw new Error('File upload failed');
                }
            })
            .then(response => response.json())
            .then(data => {
                updateLoadingMessage('Processing document...');
                // Poll for document processing status
                // In a hackathon, we'll just simulate with a timeout
                setTimeout(() => {
                    fetchDocumentData();
                }, 2000);
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoading();
                alert('An error occurred while uploading the file.');
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

        // Add page thumbnails
        documentData.pages.forEach(page => {
            const pageElement = document.createElement('div');
            pageElement.className = 'page-thumbnail p-2 border rounded cursor-pointer hover:bg-gray-100';
            pageElement.dataset.pageId = page.page_number;

            if (page.page_number === currentPageId) {
                pageElement.classList.add('bg-indigo-100', 'border-indigo-300');
            }

            pageElement.innerHTML = `
                <div class="flex items-center">
                    <div class="page-number font-semibold mr-2">Page ${page.page_number}</div>
                    <div class="page-preview text-sm text-gray-500 truncate">${page.text.substring(0, 30)}...</div>
                </div>
            `;

            pageElement.addEventListener('click', () => {
                currentPageId = page.page_number;
                renderCurrentPage();

                // Update active page thumbnail
                document.querySelectorAll('.page-thumbnail').forEach(el => {
                    el.classList.remove('bg-indigo-100', 'border-indigo-300');
                });
                pageElement.classList.add('bg-indigo-100', 'border-indigo-300');
            });

            pageThumbnails.appendChild(pageElement);
        });

        // Render first page by default
        renderCurrentPage();
    }

    function renderCurrentPage() {
        const page = documentData.pages.find(p => p.page_number === currentPageId);

        if (!page) return;

        // Render page content
        currentPageContent.innerHTML = `
            <div class="text-sm whitespace-pre-wrap">${page.text}</div>
        `;

        // Render summary
        summaryContent.innerHTML = `
            <div class="p-4 bg-indigo-50 rounded-lg">
                <h4 class="font-semibold mb-2">Summary</h4>
                <p>${page.summary}</p>
            </div>
        `;

        // Load notes
        notesTextarea.value = page.notes || '';
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

    function askQuestion() {
        const question = questionInput.value.trim();

        if (!question) return;

        // Add question to history
        const questionEl = document.createElement('div');
        questionEl.className = 'question-item mb-2';
        questionEl.innerHTML = `
            <div class="question p-2 bg-indigo-100 rounded-lg">
                <span class="font-semibold">Q:</span> ${question}
            </div>
            <div class="answer p-2 mt-1 bg-gray-100 rounded-lg">
                <span class="font-semibold">A:</span> <span class="loading-dots">...</span>
            </div>
        `;

        qaHistory.appendChild(questionEl);

        // Clear input
        questionInput.value = '';

        // Scroll to bottom of Q&A history
        qaHistory.scrollTop = qaHistory.scrollHeight;

        // Send question to API
        fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                fileId: currentFileId,
                pageId: currentPageId
            })
        })
            .then(response => response.json())
            .then(data => {
                // Update answer in history
                const answerEl = questionEl.querySelector('.answer');
                answerEl.innerHTML = `
                <span class="font-semibold">A:</span> ${data.answer}
            `;

                // Add references if available
                if (data.references && data.references.length) {
                    const refsEl = document.createElement('div');
                    refsEl.className = 'references mt-1 text-xs text-gray-500';
                    refsEl.innerHTML = `
                    <span class="font-semibold">References:</span> ${data.references.join(', ')}
                `;
                    answerEl.appendChild(refsEl);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                const answerEl = questionEl.querySelector('.answer');
                answerEl.innerHTML = `
                <span class="font-semibold">A:</span> Sorry, an error occurred while processing your question.
            `;
            });
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
}); 