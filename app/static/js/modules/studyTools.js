import { api } from './api.js';

export class StudyTools {
    constructor(elements) {
        this.elements = elements;
        this.currentFileId = null;
        this.currentPageId = 1;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const { tabSummary, tabQA, tabNotes, askButton, questionInput, saveNotesButton } = this.elements;

        tabSummary.addEventListener('click', () => this.switchTab('summary'));
        tabQA.addEventListener('click', () => this.switchTab('qa'));
        tabNotes.addEventListener('click', () => this.switchTab('notes'));

        askButton.addEventListener('click', () => this.askQuestion());
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });

        saveNotesButton.addEventListener('click', () => this.saveNotes());
    }

    setFileId(fileId) {
        this.currentFileId = fileId;
    }

    setCurrentPageId(pageId) {
        this.currentPageId = pageId;
    }

    switchTab(tab) {
        const { summaryContent, qaContent, notesContent, tabSummary, tabQA, tabNotes } = this.elements;

        // Hide all content
        [summaryContent, qaContent, notesContent].forEach(content => 
            content.classList.add('hidden')
        );

        // Reset tab styles
        [tabSummary, tabQA, tabNotes].forEach(tab => {
            tab.classList.remove('bg-indigo-600', 'text-white');
            tab.classList.add('bg-gray-200', 'text-gray-700');
        });

        // Show selected content and highlight tab
        const contentMap = {
            summary: { content: summaryContent, tab: tabSummary },
            qa: { content: qaContent, tab: tabQA },
            notes: { content: notesContent, tab: tabNotes }
        };

        const selected = contentMap[tab];
        selected.content.classList.remove('hidden');
        selected.tab.classList.remove('bg-gray-200', 'text-gray-700');
        selected.tab.classList.add('bg-indigo-600', 'text-white');
    }

    async askQuestion() {
        const { questionInput, qaHistory } = this.elements;
        const question = questionInput.value.trim();
        if (!question) return;

        const questionEl = this.createQuestionElement(question);
        qaHistory.appendChild(questionEl);
        questionInput.value = '';
        qaHistory.scrollTop = qaHistory.scrollHeight;

        try {
            const data = await api.askQuestion(question, this.currentFileId, this.currentPageId);
            this.updateAnswer(questionEl, data);
        } catch (error) {
            console.error('Error:', error);
            this.showAnswerError(questionEl);
        }
    }

    createQuestionElement(question) {
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
        return questionEl;
    }

    updateAnswer(questionEl, data) {
        const answerEl = questionEl.querySelector('.answer');
        answerEl.innerHTML = `<span class="font-semibold">A:</span> ${data.answer}`;

        if (data.references?.length) {
            const refsEl = document.createElement('div');
            refsEl.className = 'references mt-1 text-xs text-gray-500';
            refsEl.innerHTML = `
                <span class="font-semibold">References:</span> ${data.references.join(', ')}
            `;
            answerEl.appendChild(refsEl);
        }
    }

    showAnswerError(questionEl) {
        const answerEl = questionEl.querySelector('.answer');
        answerEl.innerHTML = `
            <span class="font-semibold">A:</span> Sorry, an error occurred while processing your question.
        `;
    }

    async saveNotes() {
        const { notesTextarea, saveNotesButton } = this.elements;
        const notes = notesTextarea.value.trim();

        try {
            await api.saveNotes(this.currentPageId, notes);
            this.showSaveSuccess(saveNotesButton);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while saving your notes.');
        }
    }

    showSaveSuccess(saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.classList.add('bg-green-600');

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.classList.remove('bg-green-600');
        }, 2000);
    }

    updateSummary(summary) {
        this.elements.summaryContent.innerHTML = `
            <div class="p-4 bg-indigo-50 rounded-lg">
                <h4 class="font-semibold mb-2">Summary</h4>
                <p>${summary}</p>
            </div>
        `;
    }

    updateNotes(notes) {
        this.elements.notesTextarea.value = notes || '';
    }
}