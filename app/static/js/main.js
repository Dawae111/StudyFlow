import { FileUploadHandler } from './modules/fileUpload.js';
import { DocumentViewer } from './modules/documentViewer.js';
import { StudyTools } from './modules/studyTools.js';

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
            studyTools.updateSummary(currentPage.summary);
            studyTools.updateNotes(currentPage.notes);
        }
    });
});