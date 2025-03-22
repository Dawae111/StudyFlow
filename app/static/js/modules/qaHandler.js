import { api } from './api.js';

export class QAHandler {
    constructor(elements, appController) {
        this.elements = elements;
        this.appController = appController;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.elements.askButton.addEventListener('click', () => this.askQuestion());
        this.elements.questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });
    }

    async askQuestion() {
        const question = this.elements.questionInput.value.trim();
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
        this.elements.qaHistory.appendChild(questionElement);

        // Clear the input
        this.elements.questionInput.value = '';

        // Scroll to the bottom of the history
        this.elements.qaHistory.scrollTop = this.elements.qaHistory.scrollHeight;

        try {
            // Make API call to get the answer
            const fileId = this.appController.currentFileId;
            const pageId = this.appController.documentViewer?.currentPageId || 1;

            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: question,
                    file_id: fileId,
                    page_id: pageId
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
    }
} 