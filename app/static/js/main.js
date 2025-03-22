import { AppController } from './modules/appController.js';

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

    // Initialize the app controller
    const app = new AppController(elements);
    app.init();

    // Keep these tab switching event listeners
    elements.tabSummary.addEventListener('click', () => switchTab('summary'));
    elements.tabQA.addEventListener('click', () => switchTab('qa'));
    elements.tabNotes.addEventListener('click', () => switchTab('notes'));

    // Q&A Functionality
    elements.askButton.addEventListener('click', async () => {
        const question = elements.questionInput.value.trim();
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
        elements.qaHistory.appendChild(questionElement);

        // Clear the input
        elements.questionInput.value = '';

        // Scroll to the bottom of the history
        elements.qaHistory.scrollTop = elements.qaHistory.scrollHeight;

        try {
            // Make API call to get the answer
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: question,
                    file_id: app.currentFileId,
                    page_id: app.documentViewer?.currentPageId || 1
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
    elements.saveNotesButton.addEventListener('click', saveNotes);

    // Functions
    function switchTab(tab) {
        // Remove active class from all tabs and content
        elements.tabSummary.classList.remove('active-tab');
        elements.tabQA.classList.remove('active-tab');
        elements.tabNotes.classList.remove('active-tab');
        elements.summaryContent.classList.add('hidden');
        elements.qaContent.classList.add('hidden');
        elements.notesContent.classList.add('hidden');

        // Add active class to selected tab and show content
        if (tab === 'summary') {
            elements.tabSummary.classList.add('active-tab');
            elements.summaryContent.classList.remove('hidden');
        } else if (tab === 'qa') {
            elements.tabQA.classList.add('active-tab');
            elements.qaContent.classList.remove('hidden');
        } else if (tab === 'notes') {
            elements.tabNotes.classList.add('active-tab');
            elements.notesContent.classList.remove('hidden');
        }
    }

    // Default to summary tab
    switchTab('summary');

    function showLoading(message) {
        elements.loadingOverlay.classList.remove('hidden');
        elements.loadingMessage.textContent = message || 'Loading...';
    }

    function updateLoadingMessage(message) {
        elements.loadingMessage.textContent = message;
    }

    function hideLoading() {
        elements.loadingOverlay.classList.add('hidden');
    }

    // Expose these utility functions globally
    window.showLoading = showLoading;
    window.updateLoadingMessage = updateLoadingMessage;
    window.hideLoading = hideLoading;

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

    async function saveNotes() {
        const notes = elements.notesTextarea.value;
        const pageId = app.documentViewer?.currentPageId || 1;

        try {
            const response = await fetch(`/api/notes/${pageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userNotes: notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save notes');
            }

            // Show success message
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message p-2 mb-2 bg-green-100 text-green-800 rounded';
            successMsg.textContent = 'Notes saved successfully!';

            // Insert at the top of the notes section
            const notesContainer = elements.notesContent;
            notesContainer.insertBefore(successMsg, notesContainer.firstChild);

            // Remove after 3 seconds
            setTimeout(() => {
                successMsg.remove();
            }, 3000);

        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Failed to save notes. Please try again.');
        }
    }
}); 
