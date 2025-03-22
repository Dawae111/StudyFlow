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

        // Tab switching
        tabSummary.addEventListener('click', () => this.switchTab('summary'));
        tabQA.addEventListener('click', () => this.switchTab('qa'));
        tabNotes.addEventListener('click', () => this.switchTab('notes'));

        // Q&A functionality
        askButton.addEventListener('click', () => this.askQuestion());
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });

        // Notes functionality
        saveNotesButton.addEventListener('click', () => this.saveNotes());

        // Listen for page changes
        document.addEventListener('pageChanged', (e) => {
            this.updateContent(e.detail.page);
        });
    }

    setFileId(fileId) {
        this.currentFileId = fileId;
    }

    setCurrentPageId(pageId) {
        this.currentPageId = pageId;
    }

    updateContent(page) {
        this.updateSummary(page.summary);
        this.updateNotes(page.notes);
    }

    switchTab(tab) {
        const contents = {
            summary: this.elements.summaryContent,
            qa: this.elements.qaContent,
            notes: this.elements.notesContent
        };

        const tabs = {
            summary: this.elements.tabSummary,
            qa: this.elements.tabQA,
            notes: this.elements.tabNotes
        };

        Object.values(contents).forEach(content => content.classList.add('hidden'));
        Object.values(tabs).forEach(tab => {
            tab.classList.remove('bg-indigo-600', 'text-white');
            tab.classList.add('bg-gray-200', 'text-gray-700');
        });

        contents[tab].classList.remove('hidden');
        tabs[tab].classList.remove('bg-gray-200', 'text-gray-700');
        tabs[tab].classList.add('bg-indigo-600', 'text-white');

        // Show/hide Q&A input based on active tab
        const qaInputContainer = document.getElementById('qa-input-container');
        if (qaInputContainer) {
            qaInputContainer.classList.toggle('hidden', tab !== 'qa');
        }
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

    async askQuestion() {
        const question = this.elements.questionInput.value.trim();
        if (!question) return;

        const questionEl = this.createQuestionElement(question);
        this.elements.qaHistory.appendChild(questionEl);
        this.elements.questionInput.value = '';

        // Ensure the new question is visible by scrolling to it
        this.scrollToBottom();

        try {
            const data = await api.askQuestion(question, this.currentFileId, this.currentPageId);
            this.updateAnswer(questionEl, data);

            // Scroll to show the answer after it's loaded
            this.scrollToBottom();
        } catch (error) {
            console.error('Error:', error);
            this.showAnswerError(questionEl);
        }
    }

    createQuestionElement(question) {
        const questionEl = document.createElement('div');
        questionEl.className = 'question-item bg-white rounded-lg shadow-sm mb-4';
        questionEl.innerHTML = `
            <div class="question p-3 bg-indigo-50 rounded-t-lg border-b">
                <span class="font-semibold">Q:</span> ${question}
            </div>
            <div class="answer p-3 bg-white rounded-b-lg">
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
            refsEl.className = 'references mt-2 text-xs text-gray-500';
            refsEl.innerHTML = `
                <span class="font-semibold">References:</span> ${data.references.join(', ')}
            `;
            answerEl.appendChild(refsEl);
        }

        // Ensure the answer is visible
        this.scrollToBottom();
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            const qaHistory = this.elements.qaHistory;
            qaHistory.scrollTop = qaHistory.scrollHeight;
        });
    }

    showAnswerError(questionEl) {
        const answerEl = questionEl.querySelector('.answer');
        answerEl.innerHTML = `
            <span class="font-semibold">A:</span> Sorry, an error occurred while processing your question.
        `;
    }

    async saveNotes() {
        const notes = this.elements.notesTextarea.value.trim();

        try {
            await api.saveNotes(this.currentPageId, notes);
            this.showSaveSuccess();
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while saving your notes.');
        }
    }

    showSaveSuccess() {
        const saveBtn = this.elements.saveNotesButton;
        const originalText = saveBtn.textContent;

        saveBtn.textContent = 'Saved!';
        saveBtn.classList.add('bg-green-600');

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.classList.remove('bg-green-600');
        }, 2000);
    }
}